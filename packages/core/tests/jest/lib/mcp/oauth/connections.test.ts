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

import { disconnect, disconnectManaged, grantedScopes, managedConnections, narrowConnection, userConnections } from '@/core/lib/mcp/oauth/connections';

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

  it('removing the consent is what ends the connection: the database records it, and nothing is written here', async () => {
    // the consent went and its tokens with it (migration 048), so the second statement finds none
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockResolvedValueOnce([]);
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('tokens left with no consent and none of them live get their revocation written here', async () => {
    mockQueryRows.mockResolvedValueOnce([]).mockResolvedValueOnce([{ live: false }]);
    expect(await disconnect('user-1', CLIENT, 'team-1')).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO "oauthRevocation" \("userId", "clientId", "teamId"\)/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', CLIENT, 'team-1']);
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

  it('a manager ends another member\'s connection: both roles are read, locked and decided in the same transaction', async () => {
    mockQueryOne.mockResolvedValueOnce({ teamRole: 'curator', appRole: 'member' });
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockResolvedValueOnce([{ live: true }]);
    expect(await disconnectManaged('manager-1', 'user-2', CLIENT, 'team-1')).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const [membership, params] = mockQueryOne.mock.calls[0];
    // the role in the team and the role in the app, as the database has them now and locked until this ends
    expect(sqlOf([membership])).toMatch(/^SELECT tm\.role AS "teamRole", u\.role AS "appRole" FROM "team_members" tm JOIN "users" u ON u\.id = tm\."userId" WHERE tm\."userId" = \$1 AND tm\."teamId" = \$2 FOR SHARE$/);
    expect(params).toEqual(['manager-1', 'team-1']);
    expect(mockHasTeamPermission).toHaveBeenLastCalledWith('member', 'curator', 'settings.integrations');
    // the connection ended is the other member's
    expect(mockQueryRows.mock.calls[0][1]).toEqual(['user-2', CLIENT, 'team-1']);
  });

  it('an app role that skips team permissions counts as the database has it at that moment', async () => {
    mockQueryOne.mockResolvedValueOnce({ teamRole: 'member', appRole: 'developer' });
    mockQueryRows.mockResolvedValueOnce([{ id: 'consent-1' }]).mockResolvedValueOnce([{ live: true }]);
    expect(await disconnectManaged('dev-1', 'user-2', CLIENT, 'team-1')).toBe(true);
    expect(mockHasTeamPermission).toHaveBeenLastCalledWith('developer', 'member', 'settings.integrations');
  });

  it('who does not hold the permission in the team ends nothing: a plain member, an admin without it, a non-member', async () => {
    for (const actor of [{ teamRole: 'member', appRole: 'member' }, { teamRole: 'admin', appRole: 'member' }, null]) {
      jest.clearAllMocks();
      mockQueryOne.mockResolvedValueOnce(actor);
      expect(await disconnectManaged('actor', 'user-2', CLIENT, 'team-1')).toBe(false);
      expect(mockQueryRows).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });
});

describe('taking permissions away from a connection (#541)', () => {
  const sqlOf = (call: unknown[]) => String(call[0]).replace(/\s+/g, ' ');
  const CONSENT = { id: 'consent-1', scopes: ['openid', 'offline_access', 'tasks:read', 'tasks:write', 'customers:read', 'customers:delete'] };

  it('keeps of its entity permissions only the ones named: the consent is written, with its row locked', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    expect(await narrowConnection('user-1', CLIENT, 'team-1', ['tasks:read', 'customers:read'])).toBe('narrowed');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // the consent row is locked: a renewal in flight waits for this, as it does for a disconnection
    expect(sqlOf(mockQueryOne.mock.calls[0])).toMatch(/^SELECT id, scopes FROM "oauthConsent" WHERE "userId" = \$1 AND "clientId" = \$2 AND "referenceId" = \$3 FOR UPDATE$/);
    // one statement: the database cuts the live tokens down and records the revocation when the consent narrows
    // (migration 048, exercised in tests/node/oauth-connections-pg.test.ts)
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(sqlOf(mockQuery.mock.calls[0])).toMatch(/^UPDATE "oauthConsent" SET scopes = \$2::jsonb, "updatedAt" = now\(\) WHERE id = \$1$/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['consent-1', JSON.stringify(['openid', 'offline_access', 'tasks:read', 'customers:read'])]);
  });

  it('never adds: a permission named that the connection does not hold is not given to it', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    await narrowConnection('user-1', CLIENT, 'team-1', ['tasks:read', 'posts:delete', 'admin:everything']);
    expect(mockQuery.mock.calls[0][1]).toEqual(['consent-1', JSON.stringify(['openid', 'offline_access', 'tasks:read'])]);
  });

  it('the scopes that are not entity permissions stay whatever is named', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    await narrowConnection('user-1', CLIENT, 'team-1', ['tasks:write']);
    expect(mockQuery.mock.calls[0][1]).toEqual(['consent-1', JSON.stringify(['openid', 'offline_access', 'tasks:write'])]);
  });

  it('keeping everything changes nothing, and writes nothing', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    expect(await narrowConnection('user-1', CLIENT, 'team-1', ['tasks:read', 'tasks:write', 'customers:read', 'customers:delete'])).toBe('unchanged');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('keeping nothing is not done here: it is ending the connection', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    expect(await narrowConnection('user-1', CLIENT, 'team-1', [])).toBe('nothing-left');
    mockQueryOne.mockResolvedValueOnce(CONSENT);
    expect(await narrowConnection('user-1', CLIENT, 'team-1', ['posts:read'])).toBe('nothing-left');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('a connection that is not there is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    expect(await narrowConnection('user-1', CLIENT, 'team-1', ['tasks:read'])).toBe('not-found');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('what a connection holds is the entity permissions of its consent, and null when it has none', async () => {
    mockQueryOne.mockResolvedValueOnce(CONSENT).mockResolvedValueOnce(null);
    expect(await grantedScopes('user-1', CLIENT, 'team-1')).toEqual(['tasks:read', 'tasks:write', 'customers:read', 'customers:delete']);
    expect(await grantedScopes('user-1', CLIENT, 'team-2')).toBeNull();
  });
});

describe('a connection as it is shown (#541)', () => {
  it('lists the permissions that do something: a scope whose tool was retired is left out', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withActiveScopes } = require('@/core/lib/mcp/oauth/connections') as typeof import('@/core/lib/mcp/oauth/connections');
    // the registries of the test have no entity served by MCP, so no entity scope is active
    const shown = withActiveScopes([{ clientId: 'c', teamId: 't', scopes: ['tasks:read', 'patterns:write'] } as never]);
    expect(shown).toEqual([{ clientId: 'c', teamId: 't', scopes: [] }]);
  });
});
