const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
const mockQuery = jest.fn();

jest.mock('@/core/lib/db-pool', () => ({
  createPool: () => ({ connect: async () => ({ query: mockClientQuery, release: mockRelease }) })
}));
jest.mock('@/core/lib/db', () => ({
  parseSSLConfig: () => false,
  query: mockQuery,
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn()
}));

const { TransactionalMetaService } = require('@/core/lib/services/transactional-meta.service');

describe('TransactionalMetaService - parent column of the metas table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientQuery.mockResolvedValue({ rows: [{ metaValue: { n: 1 } }] });
  });

  test('updateWithLock reads and upserts through the foreign key column of pages_metas', async () => {
    mockQuery.mockResolvedValue({ rows: [{ column: 'pageId' }], rowCount: 1 });

    await TransactionalMetaService.updateWithLock('pages', 'page-1', 'counter', (c: { n: number } | null) => ({ n: (c?.n ?? 0) + 1 }), 'user-1');

    const sql = mockClientQuery.mock.calls.map(([text]) => String(text)).join('\n');
    expect(sql).toContain('WHERE "pageId" = $1 AND "metaKey" = $2');
    expect(sql).toContain('("pageId", "metaKey"');
    expect(sql).toContain('ON CONFLICT ("pageId", "metaKey")');
    expect(sql).not.toContain('"entityId"');
  });

  test('the RLS user and the lock timeout are bound parameters of set_config', async () => {
    mockQuery.mockResolvedValue({ rows: [{ column: 'pageId' }], rowCount: 1 });

    await TransactionalMetaService.updateWithLock('pages', 'page-1', 'counter', () => ({ n: 1 }), "u'1", { lockTimeout: 1500 });

    const calls = mockClientQuery.mock.calls;
    expect(calls).toContainEqual(["SELECT set_config('app.user_id', $1, true)", ["u'1"]]);
    expect(calls).toContainEqual(["SELECT set_config('lock_timeout', $1, true)", ['1500ms']]);
    expect(calls.map(([text]) => String(text)).join('\n')).not.toContain('SET LOCAL');
  });
});
