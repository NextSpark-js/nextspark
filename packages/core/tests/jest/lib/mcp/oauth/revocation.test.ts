const mockQueryOne = jest.fn();
jest.mock('@/core/lib/db', () => ({ queryOne: (...args: unknown[]) => mockQueryOne(...args) }));

import { isRevokedSince, latestRevocation } from '@/core/lib/mcp/oauth/revocation';

beforeEach(() => mockQueryOne.mockReset());

describe('ending an MCP connection before its access token expires (#541)', () => {
  it('a token is issued after the newest revocation that covers its user and team', async () => {
    mockQueryOne.mockResolvedValue({ latest: '42' });
    expect(await latestRevocation('user-1', 'team-1')).toBe(42);
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(sql).toMatch(/"teamId" IS NULL OR "teamId" = \$2/); // a user-wide revocation covers every team
    expect(params).toEqual(['user-1', 'team-1']);
  });

  it('is 0 when nothing was ever revoked', async () => {
    mockQueryOne.mockResolvedValue({ latest: '0' });
    expect(await latestRevocation('user-1', 'team-1')).toBe(0);
  });

  it('a token is refused once a newer revocation covers it, and not before', async () => {
    mockQueryOne.mockResolvedValueOnce({ revoked: false }).mockResolvedValueOnce({ revoked: true });
    expect(await isRevokedSince('user-1', 'team-1', 42)).toBe(false);
    expect(await isRevokedSince('user-1', 'team-1', 42)).toBe(true);
    expect(mockQueryOne.mock.calls[0][1]).toEqual(['user-1', 'team-1', 42]);
    expect(mockQueryOne.mock.calls[0][0]).toMatch(/id > \$3/);
  });

  it.each([undefined, null, '42', -1, 1.5, Number.NaN])('a token without a usable revocation number (%p) is refused without asking the database', async value => {
    expect(await isRevokedSince('user-1', 'team-1', value)).toBe(true);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('fails closed when the database gives no answer', async () => {
    mockQueryOne.mockResolvedValue(null);
    expect(await isRevokedSince('user-1', 'team-1', 0)).toBe(true);
  });
});
