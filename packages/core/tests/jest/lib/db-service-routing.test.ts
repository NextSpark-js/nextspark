/**
 * DB service-context routing tests (RLS Enforcement Layer, beta.167)
 *
 * Validates the two-pool routing that makes the RLS cutover possible:
 * - calls WITH a userId  -> app pool (RLS), and a `SET LOCAL app.user_id` is set
 * - calls WITHOUT userId  -> service pool (bypass), no GUC
 * - `{ service: true }`   -> service pool even when a userId is present (no GUC)
 * - bare query/queryOne/queryRows -> service pool (system ops)
 *
 * The two pools are distinguished by giving DATABASE_URL and DATABASE_SERVICE_URL
 * different values, so db.ts creates two distinct `new Pool()` instances.
 */

type MockClient = {
  query: jest.Mock;
  release: jest.Mock;
};
type MockPool = {
  connect: jest.Mock;
  query: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
  options: { max: number };
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  __client: MockClient;
};

function loadDb(): {
  db: typeof import('@/core/lib/db');
  pools: MockPool[];
} {
  const pools: MockPool[] = [];

  jest.resetModules();
  jest.doMock('pg', () => ({
    Pool: jest.fn(() => {
      const client: MockClient = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn(),
      };
      const inst: MockPool = {
        connect: jest.fn().mockResolvedValue(client),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        options: { max: 20 },
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
        __client: client,
      };
      pools.push(inst);
      return inst;
    }),
  }));
  jest.doMock('@/core/lib/api/helpers', () => ({
    isValidUUID: (uuid: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('@/core/lib/db') as typeof import('@/core/lib/db');
  return { db, pools };
}

describe('db.ts service-context routing', () => {
  const ORIGINAL_ENV = { ...process.env };
  const USER_ID = 'test-user-001';

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://app:pw@localhost:5432/db';
    // Distinct value -> db.ts creates a separate servicePool instance.
    process.env.DATABASE_SERVICE_URL = 'postgresql://service:pw@localhost:5432/db';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  /** pools[0] = app pool (created first), pools[1] = service pool. */
  const APP = 0;
  const SVC = 1;

  function setLocalCalls(client: MockClient): string[] {
    return client.query.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('SET LOCAL app.user_id'));
  }

  test('two distinct pools are created (app + service)', () => {
    const { pools } = loadDb();
    expect(pools.length).toBe(2);
  });

  test('queryWithRLS WITH userId -> app pool + sets the GUC', async () => {
    const { db, pools } = loadDb();
    await db.queryWithRLS('SELECT 1', [], USER_ID);

    expect(pools[APP].connect).toHaveBeenCalledTimes(1);
    expect(pools[SVC].connect).not.toHaveBeenCalled();
    expect(setLocalCalls(pools[APP].__client)).toHaveLength(1);
  });

  test('queryWithRLS WITHOUT userId -> service pool + NO GUC', async () => {
    const { db, pools } = loadDb();
    await db.queryWithRLS('SELECT 1', [], null);

    expect(pools[SVC].connect).toHaveBeenCalledTimes(1);
    expect(pools[APP].connect).not.toHaveBeenCalled();
    expect(setLocalCalls(pools[SVC].__client)).toHaveLength(0);
  });

  test('queryWithRLS with { service: true } forces service pool even WITH userId', async () => {
    const { db, pools } = loadDb();
    await db.queryWithRLS('SELECT 1', [], USER_ID, { service: true });

    expect(pools[SVC].connect).toHaveBeenCalledTimes(1);
    expect(pools[APP].connect).not.toHaveBeenCalled();
    // bypass pool must NOT set the GUC
    expect(setLocalCalls(pools[SVC].__client)).toHaveLength(0);
  });

  test('mutateWithRLS routes the same way (userId -> app, service flag -> service)', async () => {
    const { db, pools } = loadDb();
    await db.mutateWithRLS('UPDATE t SET x=1', [], USER_ID);
    expect(pools[APP].connect).toHaveBeenCalledTimes(1);

    await db.mutateWithRLS('UPDATE t SET x=1', [], USER_ID, { service: true });
    expect(pools[SVC].connect).toHaveBeenCalledTimes(1);
  });

  test('getServiceTransactionClient uses the service pool with no GUC', async () => {
    const { db, pools } = loadDb();
    const tx = await db.getServiceTransactionClient();
    await tx.query('INSERT INTO team_members VALUES (1)');
    await tx.commit();

    expect(pools[SVC].connect).toHaveBeenCalledTimes(1);
    expect(pools[APP].connect).not.toHaveBeenCalled();
    expect(setLocalCalls(pools[SVC].__client)).toHaveLength(0);
  });

  test('bare query/queryOne/queryRows go to the service pool (system ops)', async () => {
    const { db, pools } = loadDb();
    await db.query('SELECT 1');
    await db.queryOne('SELECT 1');
    await db.queryRows('SELECT 1');

    expect(pools[SVC].query).toHaveBeenCalledTimes(3);
    expect(pools[APP].query).not.toHaveBeenCalled();
  });
});
