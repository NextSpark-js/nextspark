const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockQueryRows = jest.fn();
jest.mock('@/core/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

import { disconnect, managedConnections, managesTeam, userConnections } from '@/core/lib/mcp/oauth/connections';

const CLIENT = 'https://claude.ai/oauth/mcp-oauth-client-metadata';

function row(overrides: Record<string, unknown> = {}) {
  return {
    clientId: CLIENT,
    clientName: 'Claude',
    clientUri: 'https://claude.ai',
    teamId: 'team-1',
    teamName: 'One',
    userId: 'user-1',
    userName: 'Ana Pérez',
    userEmail: 'ana@example.com',
    scopes: ['offline_access', 'openid', 'tasks:write', 'tasks:read', 'customers:read'],
    connectedAt: new Date('2026-11-20T10:00:00Z'),
    lastRenewedAt: '2026-11-21T09:30:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryRows.mockResolvedValue([]);
});

describe('the applications connected by MCP browser sign-in (#541)', () => {
  it('a connection is listed with its client, team, entity permissions and dates', async () => {
    mockQueryRows.mockResolvedValueOnce([row()]);
    expect(await userConnections('user-1')).toEqual([
      {
        clientId: CLIENT,
        clientName: 'Claude',
        clientHost: 'claude.ai',
        teamId: 'team-1',
        teamName: 'One',
        userId: 'user-1',
        userName: 'Ana Pérez',
        userEmail: 'ana@example.com',
        // offline_access and the identity scopes are not permissions to show
        scopes: ['customers:read', 'tasks:read', 'tasks:write'],
        connectedAt: '2026-11-20T10:00:00.000Z',
        lastRenewedAt: '2026-11-21T09:30:00.000Z',
      },
    ]);
  });

  it('only live refresh tokens make a connection, and one row per connection: the newest', async () => {
    await userConnections('user-1');
    const [sql, params] = mockQueryRows.mock.calls[0];
    expect(sql).toMatch(/rt\.revoked IS NULL AND rt\."expiresAt" > now\(\)/);
    expect(sql).toMatch(/DISTINCT ON \(rt\."userId", rt\."clientId", rt\."referenceId"\)/);
    expect(sql).toMatch(/ORDER BY rt\."userId", rt\."clientId", rt\."referenceId", rt\."createdAt" DESC/);
    expect(sql).toMatch(/AND rt\."userId" = \$1/);
    expect(params).toEqual(['user-1']);
  });

  it('the host of a client comes from its uri, else from an id that is a URL, else there is none', async () => {
    mockQueryRows.mockResolvedValueOnce([
      row({ clientUri: null }),
      row({ clientUri: 'not a url', clientId: 'opaque-id' }),
      row({ clientUri: 'https://chatgpt.com/apps', clientId: 'opaque-id' }),
    ]);
    expect((await userConnections('user-1')).map(connection => connection.clientHost)).toEqual(['claude.ai', null, 'chatgpt.com']);
  });

  it('scopes that are not a list are no permissions', async () => {
    mockQueryRows.mockResolvedValueOnce([row({ scopes: null }), row({ scopes: ['tasks:read', 7] })]);
    expect((await userConnections('user-1')).map(connection => connection.scopes)).toEqual([[], ['tasks:read']]);
  });

  it('who owns or administers a team sees the other members\' connections to it, not their own again', async () => {
    await managedConnections('user-1');
    const [sql, params] = mockQueryRows.mock.calls[0];
    expect(sql).toMatch(/rt\."userId" <> \$1/);
    expect(sql).toMatch(/rt\."referenceId" IN \(SELECT "teamId" FROM "team_members" WHERE "userId" = \$1 AND role IN \('owner', 'admin'\)\)/);
    expect(params).toEqual(['user-1']);
  });

  it('managing a team is owning or administering it', async () => {
    mockQueryOne.mockResolvedValueOnce({ role: 'admin' }).mockResolvedValueOnce(null);
    expect(await managesTeam('user-1', 'team-1')).toBe(true);
    expect(await managesTeam('user-2', 'team-1')).toBe(false);
    expect(mockQueryOne.mock.calls[0][0]).toMatch(/role IN \('owner', 'admin'\)/);
  });
});

describe('ending a connection (#541)', () => {
  it('deletes its refresh tokens, for that user, client and team only, and removes its consent', async () => {
    mockQueryRows.mockResolvedValueOnce([{ live: false }, { live: true }]).mockResolvedValueOnce([{ id: 'consent-1' }]);
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(true);
    const [revoke, consent] = mockQueryRows.mock.calls;
    // deleted and not marked revoked: a revoked token presented again would end the client's other connections
    expect(revoke[0]).toMatch(/DELETE FROM "oauthRefreshToken"\s+WHERE "userId" = \$1 AND "clientId" = \$2 AND "referenceId" = \$3\s+RETURNING/);
    expect(revoke[0]).not.toMatch(/UPDATE/);
    expect(revoke[1]).toEqual(['user-1', CLIENT, 'team-1']);
    expect(consent[0]).toMatch(/DELETE FROM "oauthConsent" WHERE "userId" = \$1 AND "clientId" = \$2 AND "referenceId" = \$3/);
    expect(consent[1]).toEqual(['user-1', CLIENT, 'team-1']);
    // the trigger of migration 048 recorded the revocation for the live token deleted: none is written here
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('a consent with no live refresh token gets its revocation written, so its access token is refused too', async () => {
    mockQueryRows.mockResolvedValueOnce([{ live: false }]).mockResolvedValueOnce([{ id: 'consent-1' }]);
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO "oauthRevocation" \("userId", "clientId", "teamId"\)/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', CLIENT, 'team-1']);
  });

  it('answers false when there was nothing to end', async () => {
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
