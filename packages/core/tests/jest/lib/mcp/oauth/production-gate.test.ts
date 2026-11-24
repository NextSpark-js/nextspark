/**
 * The production gate of MCP browser sign-in (#541): in production it does not start without Redis and serves no
 * OAuth request while the database role skips row-level security, unless the deployment accepts each by name.
 */
let built = true;
jest.mock('@nextsparkjs/registries/features', () => ({
  get FEATURES() {
    return { billing: true, superadmin: true, mcpOAuth: built };
  },
}));
const mockPoolQuery = jest.fn();
jest.mock('@/core/lib/db', () => ({ pool: { query: (...args: unknown[]) => mockPoolQuery(...args) } }));

import { isMcpOAuthEnabled } from '@/core/lib/mcp/oauth/config';
import { GATE_RECHECK_MS, mcpOAuthRefusedByGate, resetProductionGate } from '@/core/lib/mcp/oauth/production-gate';
import { acceptedRisks, sharedRateLimitGate } from '@/core/lib/mcp/oauth/production-risks';
import type { RlsRuntimeRow } from '@/core/lib/rls-runtime';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const REDIS = { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'token' };
const PRODUCTION = { NODE_ENV: 'production', MCP_ENABLED: 'true' };

const row = (overrides: Partial<RlsRuntimeRow> = {}): RlsRuntimeRow => ({ role: 'nextspark_app', superuser: false, bypassRls: false, ownedTables: 0, rlsTables: 40, ...overrides });
const answering = (...rows: RlsRuntimeRow[]) => jest.fn(async () => ({ rows }));

let logged: string[];
let spy: jest.SpyInstance;
beforeEach(() => {
  built = true;
  logged = [];
  spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { logged.push(args.join(' ')); });
  resetProductionGate();
  // each test says its lines again
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('nextspark.mcpOAuthProductionGateSaid')];
  mockPoolQuery.mockReset();
});
afterEach(() => spy.mockRestore());

describe('what a deployment accepts', () => {
  it('is what MCP_OAUTH_ACCEPT_RISKS names, one by one', () => {
    expect([...acceptedRisks(env({}))]).toEqual([]);
    expect([...acceptedRisks(env({ MCP_OAUTH_ACCEPT_RISKS: 'no-shared-rate-limit' }))]).toEqual(['no-shared-rate-limit']);
    expect([...acceptedRisks(env({ MCP_OAUTH_ACCEPT_RISKS: ' rls-not-enforced, no-shared-rate-limit ' }))]).toEqual(['rls-not-enforced', 'no-shared-rate-limit']);
  });

  it('a name that is not a risk accepts nothing, and is said once', () => {
    for (const value of ['true', '1', 'all', '*', 'yes']) {
      expect([...acceptedRisks(env({ MCP_OAUTH_ACCEPT_RISKS: value }))]).toEqual([]);
    }
    acceptedRisks(env({ MCP_OAUTH_ACCEPT_RISKS: 'true' }));
    expect(logged.filter(line => /names true, which is not a risk/.test(line))).toHaveLength(1);
  });
});

describe('without Redis', () => {
  it('nothing changes outside production', () => {
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(sharedRateLimitGate(env({ NODE_ENV: 'test' }))).toBe(true);
    expect(logged).toEqual([]);
  });

  it('in production sign-in does not start, and the log says why and how to accept it', () => {
    expect(isMcpOAuthEnabled(env(PRODUCTION))).toBe(false);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/NOT started: in production it needs Redis \(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN\)/);
    expect(logged[0]).toMatch(/MCP_OAUTH_ACCEPT_RISKS=no-shared-rate-limit/);
    // said once, however often the switch is read
    isMcpOAuthEnabled(env(PRODUCTION));
    expect(logged).toHaveLength(1);
  });

  it('one of the two variables is not Redis', () => {
    expect(isMcpOAuthEnabled(env({ ...PRODUCTION, UPSTASH_REDIS_REST_URL: 'https://redis.example' }))).toBe(false);
  });

  it('with Redis it starts and says nothing', () => {
    expect(isMcpOAuthEnabled(env({ ...PRODUCTION, ...REDIS }))).toBe(true);
    expect(logged).toEqual([]);
  });

  it('accepted by name it starts, and the log keeps saying what it runs without', () => {
    expect(isMcpOAuthEnabled(env({ ...PRODUCTION, MCP_OAUTH_ACCEPT_RISKS: 'no-shared-rate-limit' }))).toBe(true);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/running WITHOUT a shared rate limit/);
  });

  it('accepting the other risk does not accept this one', () => {
    expect(isMcpOAuthEnabled(env({ ...PRODUCTION, MCP_OAUTH_ACCEPT_RISKS: 'rls-not-enforced' }))).toBe(false);
  });

  it('the switches that were there still come first: a project without the feature is told nothing', () => {
    built = false;
    expect(isMcpOAuthEnabled(env(PRODUCTION))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(logged).toEqual([]);
  });

  it('the build of a production server decides the same and logs nothing', () => {
    expect(isMcpOAuthEnabled(env({ ...PRODUCTION, NEXT_PHASE: 'phase-production-build' }))).toBe(false);
    expect(logged).toEqual([]);
  });
});

describe('the role of the database', () => {
  const production = env({ ...PRODUCTION, ...REDIS });

  it('is not asked outside production', async () => {
    const run = answering(row({ ownedTables: 40 }));
    expect(await mcpOAuthRefusedByGate(env({ NODE_ENV: 'development' }), run)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('a role subject to row-level security is served, and the catalogs are not read on every request', async () => {
    const run = answering(row());
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(false);
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(logged).toEqual([]);
  });

  it('a verdict is read again after a minute: a role that stops being subject to row-level security is refused then', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const run = jest.fn()
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [row({ bypassRls: true })] })
      .mockResolvedValueOnce({ rows: [row()] });
    expect(await mcpOAuthRefusedByGate(production, run, now)).toBe(false);
    clock += GATE_RECHECK_MS - 1;
    expect(await mcpOAuthRefusedByGate(production, run, now)).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    // ALTER ROLE ... BYPASSRLS while the process lives: the requests of a token issued before it are refused too
    clock += 1;
    expect(await mcpOAuthRefusedByGate(production, run, now)).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(logged.join('\n')).toMatch(/has BYPASSRLS/);
    // and one that was fixed is served again without a restart
    clock += GATE_RECHECK_MS - 1;
    expect(await mcpOAuthRefusedByGate(production, run, now)).toBe(true);
    clock += 1;
    expect(await mcpOAuthRefusedByGate(production, run, now)).toBe(false);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['owns the tables', row({ role: 'owner', ownedTables: 12 }), /\(owner\) owns 12 of the tables with row-level security/],
    ['is a superuser', row({ role: 'postgres', superuser: true }), /\(postgres\) is a superuser/],
    ['has BYPASSRLS', row({ role: 'svc', bypassRls: true }), /\(svc\) has BYPASSRLS/],
  ])('a role that %s is refused, and the log says why and how to fix or accept it', async (_name, answer, why) => {
    const run = answering(answer);
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(true);
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/REFUSES every OAuth request/);
    expect(logged[0]).toMatch(why);
    expect(logged[0]).toMatch(/Connect as nextspark_app/);
    expect(logged[0]).toMatch(/MCP_OAUTH_ACCEPT_RISKS=rls-not-enforced/);
  });

  it('accepted by name it is served, and the log keeps saying what it runs without', async () => {
    const accepted = env({ ...PRODUCTION, ...REDIS, MCP_OAUTH_ACCEPT_RISKS: 'rls-not-enforced' });
    expect(await mcpOAuthRefusedByGate(accepted, answering(row({ role: 'owner', ownedTables: 12 })))).toBe(false);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/running WITHOUT row-level security behind it/);
  });

  it('accepting the other risk does not accept this one', async () => {
    const other = env({ ...PRODUCTION, MCP_OAUTH_ACCEPT_RISKS: 'no-shared-rate-limit' });
    expect(await mcpOAuthRefusedByGate(other, answering(row({ ownedTables: 1 })))).toBe(true);
  });

  it('a database with no table under row-level security has not been migrated: refused', async () => {
    expect(await mcpOAuthRefusedByGate(production, answering(row({ rlsTables: 0 })))).toBe(true);
    expect(logged[0]).toMatch(/the migrations have not run/);
  });

  it('a failure to read the catalogs refuses that request and is asked again on the next', async () => {
    const run = jest.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED postgres://user:secret@host/db'))
      .mockResolvedValueOnce({ rows: [row()] });
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(true);
    // nothing of the error is logged: it can carry the connection string
    expect(logged.join('\n')).not.toMatch(/secret|ECONNREFUSED/);
    expect(await mcpOAuthRefusedByGate(production, run)).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('by default it asks on the app pool, the connection the requests use', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [row()] });
    expect(await mcpOAuthRefusedByGate(production)).toBe(false);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(String(mockPoolQuery.mock.calls[0][0])).toMatch(/rolbypassrls/);
  });
});
