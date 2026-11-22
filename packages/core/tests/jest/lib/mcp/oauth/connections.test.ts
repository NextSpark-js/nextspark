const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockQueryRows = jest.fn();
const mockTransaction = jest.fn(async (fn: () => Promise<unknown>) => fn());
jest.mock('@/core/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
  withServiceTransaction: (fn: () => Promise<unknown>) => mockTransaction(fn),
}));
// The permission decision of the framework, with a project's own role in it: `curator` manages integrations,
// `admin` had the permission taken away, and the app role `developer` skips team permissions
const mockHasTeamPermission = jest.fn((appRole: string | null | undefined, teamRole: string | null | undefined, permission: string) => {
  if (!teamRole || permission !== 'settings.integrations') return false;
  return appRole === 'developer' || ['owner', 'curator'].includes(teamRole);
});
jest.mock('@/core/lib/permissions/app-role-bypass', () => ({
  hasTeamPermission: (...args: [string | null | undefined, string | null | undefined, string]) => mockHasTeamPermission(...args),
}));

import { disconnect, disconnectManaged, managedConnections, userConnections } from '@/core/lib/mcp/oauth/connections';

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

  it('other members\' connections are listed for the teams whose integrations the user manages, by the permission and not by a role name', async () => {
    mockQueryRows
      .mockResolvedValueOnce([{ teamId: 'team-owner', role: 'owner' }, { teamId: 'team-curator', role: 'curator' }, { teamId: 'team-admin', role: 'admin' }, { teamId: 'team-member', role: 'member' }])
      .mockResolvedValueOnce([row({ userId: 'user-2', teamId: 'team-curator' })]);
    const managed = await managedConnections('user-1', 'member');
    expect(managed.map(connection => connection.teamId)).toEqual(['team-curator']);
    const [sql, params] = mockQueryRows.mock.calls[1];
    expect(sql).toMatch(/rt\."userId" <> \$1 AND rt\."referenceId" = ANY\(\$2::text\[\]\)/);
    // a project's own role that holds the permission counts; `admin` without it does not
    expect(params).toEqual(['user-1', ['team-owner', 'team-curator']]);
    expect(sql).not.toMatch(/'owner'|'admin'/);
  });

  it('an app role that skips team permissions manages every team it is a member of', async () => {
    mockQueryRows.mockResolvedValueOnce([{ teamId: 'team-member', role: 'member' }]).mockResolvedValueOnce([]);
    await managedConnections('user-dev', 'developer');
    expect(mockQueryRows.mock.calls[1][1]).toEqual(['user-dev', ['team-member']]);
  });

  it('a user who manages no team is asked for nothing more', async () => {
    mockQueryRows.mockResolvedValueOnce([{ teamId: 'team-member', role: 'member' }]);
    expect(await managedConnections('user-1', 'member')).toEqual([]);
    expect(mockQueryRows).toHaveBeenCalledTimes(1);
  });
});

describe('ending a connection (#541)', () => {
  const sqlOf = (call: unknown[]) => String(call[0]).replace(/\s+/g, ' ');

  it('removes its consent and then its refresh tokens, for that user, client and team only, in one transaction', async () => {
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockResolvedValueOnce([{ live: false }, { live: true }]);
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const [consent, tokens] = mockQueryRows.mock.calls;
    // the consent first: a renewal in flight needs it to write its new token (migration 048), so it either wrote
    // the token already, and the next statement removes it, or it is refused
    expect(sqlOf(consent)).toMatch(/^DELETE FROM "oauthConsent" WHERE "userId" = \$1 AND "clientId" = \$2 AND "referenceId" = \$3/);
    expect(sqlOf(tokens)).toMatch(/^DELETE FROM "oauthRefreshToken" WHERE "userId" = \$1 AND "clientId" = \$2 AND "referenceId" = \$3 RETURNING/);
    // deleted and not marked revoked: a revoked token presented again would end the client's other connections
    expect(sqlOf(tokens)).not.toMatch(/UPDATE/);
    expect(consent[1]).toEqual(['user-1', CLIENT, 'team-1']);
    expect(tokens[1]).toEqual(['user-1', CLIENT, 'team-1']);
    // the trigger of migration 048 recorded the revocation for the live token deleted: none is written here
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('when no live refresh token went, the revocation is written here, so an access token still out is refused', async () => {
    // a consent alone (no offline access), and tokens that were all replaced already (a renewal refused in flight)
    for (const [consents, tokens] of [[[{ id: 'consent-1' }], []], [[{ id: 'consent-1' }], [{ live: false }]], [[], [{ live: false }]]] as const) {
      jest.clearAllMocks();
      mockQueryRows.mockResolvedValueOnce([...consents]).mockResolvedValueOnce([...tokens]);
      await disconnect('user-1', CLIENT, 'team-1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO "oauthRevocation" \("userId", "clientId", "teamId"\)/);
      expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', CLIENT, 'team-1']);
    }
  });

  it('answers false when there was nothing to end', async () => {
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('a failure rolls the whole of it back: the error leaves the transaction', async () => {
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockRejectedValueOnce(new Error('connection lost'));
    await expect(disconnect('user-1', CLIENT, 'team-1')).rejects.toThrow('connection lost');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('a manager ends another member\'s connection: the permission is read, locked and decided in the same transaction', async () => {
    mockQueryOne.mockResolvedValueOnce({ role: 'curator' });
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockResolvedValueOnce([{ live: true }]);
    expect(await disconnectManaged('manager-1', 'member', 'user-2', CLIENT, 'team-1')).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const [membership, params] = mockQueryOne.mock.calls[0];
    expect(sqlOf([membership])).toMatch(/^SELECT role FROM "team_members" WHERE "userId" = \$1 AND "teamId" = \$2 FOR SHARE$/);
    expect(params).toEqual(['manager-1', 'team-1']);
    expect(mockHasTeamPermission).toHaveBeenLastCalledWith('member', 'curator', 'settings.integrations');
    // the connection ended is the other member's
    expect(mockQueryRows.mock.calls[0][1]).toEqual(['user-2', CLIENT, 'team-1']);
  });

  it('who does not hold the permission in the team ends nothing: a plain member, a non-member whatever the app role', async () => {
    for (const [appRole, membership] of [['member', { role: 'member' }], ['member', { role: 'admin' }], ['developer', null]] as const) {
      jest.clearAllMocks();
      mockQueryOne.mockResolvedValueOnce(membership);
      expect(await disconnectManaged('actor', appRole, 'user-2', CLIENT, 'team-1')).toBe(false);
      expect(mockQueryRows).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });
});
