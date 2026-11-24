/**
 * What a consent grants is decided on the server (#541): the scopes the client asked for, that the user accepted,
 * and that the user's role in the team can hold, whatever the browser sent.
 */
const mockGetSession = jest.fn();
jest.mock('better-auth/api', () => ({
  createAuthMiddleware: (handler: unknown) => handler,
  getSessionFromCtx: (...args: unknown[]) => mockGetSession(...args),
}));
const mockQueryOne = jest.fn();
jest.mock('@/core/lib/db', () => ({ queryOne: (...args: unknown[]) => mockQueryOne(...args) }));
const mockAllowedHosts = jest.fn<unknown, []>();
jest.mock('@/core/lib/mcp/oauth/config', () => ({ allowedClientHosts: () => mockAllowedHosts() }));
const mockValidateScopes = jest.fn();
// The rule API keys are held to (lib/api/auth/user-scopes), here with the role's scopes taken from generated data
jest.mock('@/core/lib/api/auth/user-scopes', () => ({ scopesAllowedForUser: (...args: unknown[]) => mockValidateScopes(...args) }));
const mockRoleScopes = (role: string) => [`role:${role}`];
// The scopes whose tool was retired: accepted when asked for, never granted
const mockRetired = new Set<string>();
jest.mock('@/core/lib/mcp/oauth/scopes', () => ({
  activeScopes: (scopes: string[]) => scopes.filter(scope => !mockRetired.has(scope)),
  mcpOAuthRoleScopes: (role: string) => mockRoleScopes(role),
}));
const mockGateRefuses = jest.fn<Promise<boolean>, []>();
jest.mock('@/core/lib/mcp/oauth/production-gate', () => ({
  NOT_AVAILABLE: 'MCP browser sign-in is not available on this server.',
  mcpOAuthRefusedByGate: () => mockGateRefuses(),
}));
const mockSelectedTeam = jest.fn();
jest.mock('@/core/lib/mcp/oauth/team-selection', () => ({
  isAuthorizationKey: (value: unknown) => typeof value === 'string' && value.length >= 43,
  selectedTeam: (...args: unknown[]) => mockSelectedTeam(...args),
}));

import { consentedScopes, consentWithinRolePlugin, isHeldByProductionGate, refuseConsentSkippingClient, refuseUnlistedClient } from '@/core/lib/mcp/oauth/consent-plugin';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const REQUESTED = 'openid offline_access tasks:read tasks:write tasks:delete customers:read';
const signedQuery = (scope = REQUESTED, challenge = CHALLENGE) => new URLSearchParams({ scope, code_challenge: challenge, client_id: 'client' }).toString();

type Hook = { matcher: (ctx: { path: string }) => boolean; handler: (ctx: { path: string; body: unknown }) => Promise<{ context: { body: { scope: string } } } | undefined> };
const hooks = consentWithinRolePlugin().hooks!.before as unknown as Hook[];
// the production gate, the gate of the endpoints used after authorization, the direct update of a consent, then the consent endpoint
const productionGate = hooks[0] as unknown as { matcher: (ctx: { path?: string }) => boolean; handler: (ctx: { path: string }) => Promise<void> };
const gate = hooks[1] as unknown as { matcher: (ctx: { path?: string }) => boolean; handler: (ctx: { path: string; body?: unknown; headers?: Headers }) => Promise<void> };
const update = hooks[2] as unknown as { matcher: (ctx: { path?: string }) => boolean; handler: (ctx: { path: string; body?: unknown }) => Promise<{ context: { body: { update: { scopes: string[] } } } } | undefined> };
const hook = hooks[3];
const consent = (body: Record<string, unknown>) => hook.handler({ path: '/oauth2/consent', body });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, session: { id: 'session-1' } });
  mockSelectedTeam.mockResolvedValue('team-1');
  mockGateRefuses.mockResolvedValue(false);
  // the role in the team can read and write tasks and read customers; it cannot delete
  mockValidateScopes.mockImplementation(async (_user: string, _team: string, scopes: string[]) => ({ allowedScopes: scopes.filter(scope => scope !== 'tasks:delete') }));
});

describe('the production gate on the authorization server', () => {
  it('holds every endpoint of the OAuth provider and its discovery documents', () => {
    for (const path of ['/oauth2/authorize', '/oauth2/token', '/oauth2/register', '/oauth2/consent', '/oauth2/continue', '/oauth2/userinfo', '/oauth2/introspect',
      '/oauth2/update-consent', '/oauth2/get-consents', '/admin/oauth2/create-client', '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration',
      '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp']) {
      expect([path, productionGate.matcher({ path })]).toEqual([path, true]);
    }
  });

  it('lets through the two that only take access away, and everything that is not the authorization server', () => {
    for (const path of ['/oauth2/revoke', '/oauth2/delete-consent', '/sign-in/email', '/get-session', '/jwks', '/oauth2', undefined]) {
      expect([path, isHeldByProductionGate(path)]).toEqual([path, false]);
    }
  });

  it('answers 503 temporarily_unavailable while the gate refuses, and nothing while it does not', async () => {
    await expect(productionGate.handler({ path: '/oauth2/authorize' })).resolves.toBeUndefined();
    mockGateRefuses.mockResolvedValue(true);
    await expect(productionGate.handler({ path: '/oauth2/authorize' })).rejects.toMatchObject({
      body: { error: 'temporarily_unavailable', error_description: 'MCP browser sign-in is not available on this server.' },
    });
  });
});

describe('the scopes a consent grants', () => {
  it('are the requested ones that were accepted and that the role can hold', () => {
    const requested = REQUESTED.split(' ');
    const held = ['tasks:read', 'tasks:write', 'customers:read'];
    expect(consentedScopes(requested, ['openid', 'offline_access', 'tasks:read'], held)).toEqual(['openid', 'offline_access', 'tasks:read']);
    // nothing named: all that was requested, still within the role
    expect(consentedScopes(requested, undefined, held)).toEqual(['openid', 'offline_access', 'tasks:read', 'tasks:write', 'customers:read']);
    // accepted but never requested: not granted
    expect(consentedScopes(requested, ['tasks:read', 'posts:delete'], held)).toEqual(['tasks:read']);
    // accepted and requested, but the role cannot hold it: not granted
    expect(consentedScopes(requested, ['tasks:read', 'tasks:delete'], held)).toEqual(['tasks:read']);
    // a scope that is not an entity permission is not the role's to limit
    expect(consentedScopes(requested, ['offline_access'], [])).toEqual(['offline_access']);
  });
});

describe('the consent endpoint, before Better Auth handles it', () => {
  it('only the consent endpoint is touched', () => {
    expect(hook.matcher({ path: '/oauth2/consent' })).toBe(true);
    expect(hook.matcher({ path: '/oauth2/token' })).toBe(false);
  });

  it('a scope the role cannot hold is taken out of what the browser sent', async () => {
    const result = await consent({ accept: true, scope: 'openid offline_access tasks:read tasks:delete', oauth_query: signedQuery() });
    expect(result?.context.body.scope).toBe('openid offline_access tasks:read');
    expect(mockSelectedTeam).toHaveBeenCalledWith('session-1', CHALLENGE, 'user-1');
    expect(mockValidateScopes).toHaveBeenCalledWith('user-1', 'team-1', ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read'], expect.any(Function));
    // what a role holds comes from the generated data of MCP sign-in, not from the scope registry: `lib/auth` must not load it
    expect(mockValidateScopes.mock.calls[0][3]('admin')).toEqual(['role:admin']);
  });

  it('a scope whose tool was retired is taken out too, whatever the role and whatever the browser sent', async () => {
    mockRetired.add('tasks:write');
    try {
      const sent = await consent({ accept: true, scope: 'openid offline_access tasks:read tasks:write', oauth_query: signedQuery() });
      expect(sent?.context.body.scope).toBe('openid offline_access tasks:read');
      // and with no scope named, which the endpoint would read as everything that was requested
      const unnamed = await consent({ accept: true, oauth_query: signedQuery() });
      expect(unnamed?.context.body.scope).toBe('openid offline_access tasks:read customers:read');
      // the role is not even asked about it
      expect(mockValidateScopes).toHaveBeenLastCalledWith('user-1', 'team-1', ['tasks:read', 'tasks:delete', 'customers:read'], expect.any(Function));
    } finally {
      mockRetired.clear();
    }
  });

  it('a consent that names no scope is still held to the role: the endpoint would otherwise grant all that was requested', async () => {
    const result = await consent({ accept: true, oauth_query: signedQuery() });
    expect(result?.context.body.scope).toBe('openid offline_access tasks:read tasks:write customers:read');
  });

  it('a scope the client never asked for is not added', async () => {
    const result = await consent({ accept: true, scope: 'tasks:read posts:write', oauth_query: signedQuery() });
    expect(result?.context.body.scope).toBe('tasks:read');
  });

  it('with no session, or no team chosen for the authorization, no entity permission is let through', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    expect((await consent({ accept: true, scope: REQUESTED, oauth_query: signedQuery() }))?.context.body.scope).toBe('openid offline_access');
    mockSelectedTeam.mockResolvedValueOnce(undefined);
    expect((await consent({ accept: true, scope: REQUESTED, oauth_query: signedQuery() }))?.context.body.scope).toBe('openid offline_access');
    expect(mockValidateScopes).not.toHaveBeenCalled();
  });

  it('a refusal and a body without the signed query are left to the endpoint', async () => {
    expect(await consent({ accept: false, oauth_query: signedQuery() })).toBeUndefined();
    expect(await consent({ accept: true, scope: 'tasks:read' })).toBeUndefined();
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});

describe('a client that skips consent', () => {
  it('is refused: the consent is where the user chooses the permissions', async () => {
    mockQueryOne.mockResolvedValueOnce({ skipConsent: true });
    await expect(refuseConsentSkippingClient('first-party')).rejects.toMatchObject({ body: { error: 'access_denied' } });
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('"skipConsent" FROM "oauthClient"'), ['first-party']);
  });

  it('a client that asks for consent, one not registered yet and a request that names none go on', async () => {
    mockQueryOne.mockResolvedValueOnce({ skipConsent: false }).mockResolvedValueOnce({ skipConsent: null }).mockResolvedValueOnce(null);
    await expect(refuseConsentSkippingClient('a')).resolves.toBeUndefined();
    await expect(refuseConsentSkippingClient('b')).resolves.toBeUndefined();
    await expect(refuseConsentSkippingClient('c')).resolves.toBeUndefined();
    await expect(refuseConsentSkippingClient(undefined)).resolves.toBeUndefined();
    expect(mockQueryOne).toHaveBeenCalledTimes(3);
  });
});

describe('an application the project does not accept', () => {
  it('is refused when it asks for authorization', () => {
    mockAllowedHosts.mockReturnValue(['claude.ai']);
    expect(() => refuseUnlistedClient('https://evil.example/oauth/client.json')).toThrow(expect.objectContaining({ body: expect.objectContaining({ error: 'access_denied' }) }));
    expect(() => refuseUnlistedClient('https://claude.ai/oauth/mcp-oauth-client-metadata')).not.toThrow();
  });

  const jwt = (payload: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

  it('exchanges no code, renews no token and reads no identity once it is off the list', async () => {
    mockAllowedHosts.mockReturnValue(['claude.ai']);
    expect(['/oauth2/token', '/oauth2/userinfo'].map(path => gate.matcher({ path }))).toEqual([true, true]);
    expect(['/oauth2/consent', '/oauth2/authorize', '/oauth2/revoke', undefined].map(path => gate.matcher({ path }))).toEqual([false, false, false, false]);
    const refused = expect.objectContaining({ body: expect.objectContaining({ error: 'invalid_client' }) });
    await expect(gate.handler({ path: '/oauth2/token', body: { grant_type: 'refresh_token', client_id: 'https://evil.example/client.json' } })).rejects.toEqual(refused);
    await expect(gate.handler({ path: '/oauth2/token', body: { grant_type: 'authorization_code', client_id: 'opaque-id' } })).rejects.toEqual(refused);
    await expect(gate.handler({ path: '/oauth2/userinfo', headers: new Headers({ authorization: `Bearer ${jwt({ azp: 'https://evil.example/client.json' })}` }) })).rejects.toEqual(refused);
    // the access token sent as a form field is read too
    await expect(gate.handler({ path: '/oauth2/userinfo', body: { access_token: jwt({ azp: 'https://evil.example/client.json' }) } })).rejects.toEqual(refused);
    // a request whose client cannot be read is refused, not let through: an opaque token says nothing of its client
    await expect(gate.handler({ path: '/oauth2/userinfo', headers: new Headers({ authorization: 'Bearer opaque-token' }) })).rejects.toEqual(refused);
    await expect(gate.handler({ path: '/oauth2/userinfo', body: { access_token: 'opaque-token' } })).rejects.toEqual(refused);
    await expect(gate.handler({ path: '/oauth2/token', body: {} })).rejects.toEqual(refused);
    // an accepted client named in the body beside a refused one in HTTP Basic: the endpoint would authenticate the
    // Basic one, so the request is refused; and the other way round, for the same reason
    const basicOf = (id: string) => new Headers({ authorization: `Basic ${Buffer.from(`${encodeURIComponent(id)}:secret`).toString('base64')}` });
    const accepted = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
    for (const grant_type of ['authorization_code', 'refresh_token']) {
      await expect(gate.handler({ path: '/oauth2/token', body: { grant_type, client_id: accepted }, headers: basicOf('https://evil.example/client.json') })).rejects.toEqual(refused);
      await expect(gate.handler({ path: '/oauth2/token', body: { grant_type, client_id: 'https://evil.example/client.json' }, headers: basicOf(accepted) })).rejects.toEqual(refused);
      await expect(gate.handler({ path: '/oauth2/token', body: { grant_type, client_id: accepted }, headers: basicOf(accepted) })).resolves.toBeUndefined();
    }
    // the accepted application goes on, by any way of naming itself
    await expect(gate.handler({ path: '/oauth2/token', body: { client_id: 'https://claude.ai/oauth/mcp-oauth-client-metadata' } })).resolves.toBeUndefined();
    await expect(gate.handler({ path: '/oauth2/userinfo', body: { access_token: jwt({ azp: 'https://claude.ai/oauth/mcp-oauth-client-metadata' }) } })).resolves.toBeUndefined();
  });

  it('with no list, nothing after authorization is refused', async () => {
    mockAllowedHosts.mockReturnValue(undefined);
    await expect(gate.handler({ path: '/oauth2/token', body: { client_id: 'opaque-id' } })).resolves.toBeUndefined();
    await expect(gate.handler({ path: '/oauth2/userinfo', headers: new Headers({ authorization: 'Bearer opaque-token' }) })).resolves.toBeUndefined();
    await expect(gate.handler({ path: '/oauth2/token', body: {} })).resolves.toBeUndefined();
  });

  it('every application goes on while the project sets no list', () => {
    mockAllowedHosts.mockReturnValue(undefined);
    expect(() => refuseUnlistedClient('https://anything.example/client.json')).not.toThrow();
    expect(() => refuseUnlistedClient('opaque-id')).not.toThrow();
  });
});

describe('a consent rewritten directly (the authorization server lets the signed-in user do it)', () => {
  beforeEach(() => {
    mockAllowedHosts.mockReturnValue(undefined);
  });

  it('is held to what the role can hold in the team of that consent', async () => {
    mockQueryOne.mockResolvedValueOnce({ userId: 'user-1', referenceId: 'team-9' });
    expect(update.matcher({ path: '/oauth2/update-consent' })).toBe(true);
    const result = await update.handler({ path: '/oauth2/update-consent', body: { id: 'consent-1', update: { scopes: ['offline_access', 'tasks:read', 'tasks:delete'] } } });
    expect(result?.context.body.update.scopes).toEqual(['offline_access', 'tasks:read']);
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('FROM "oauthConsent" WHERE id = $1'), ['consent-1']);
    expect(mockValidateScopes).toHaveBeenCalledWith('user-1', 'team-9', ['tasks:read', 'tasks:delete'], expect.any(Function));
  });

  it('cannot write back a scope whose tool was retired', async () => {
    mockRetired.add('tasks:read');
    try {
      mockQueryOne.mockResolvedValueOnce({ userId: 'user-1', referenceId: 'team-9' });
      const result = await update.handler({ path: '/oauth2/update-consent', body: { id: 'consent-1', update: { scopes: ['offline_access', 'tasks:read', 'customers:read'] } } });
      expect(result?.context.body.update.scopes).not.toContain('tasks:read');
      expect(mockValidateScopes).toHaveBeenLastCalledWith('user-1', 'team-9', ['customers:read'], expect.any(Function));
    } finally {
      mockRetired.clear();
    }
  });

  it('another user\'s consent, one of no team and a body that names no scopes are left to the endpoint', async () => {
    mockQueryOne.mockResolvedValueOnce({ userId: 'user-2', referenceId: 'team-9' }).mockResolvedValueOnce({ userId: 'user-1', referenceId: null }).mockResolvedValueOnce(null);
    for (let i = 0; i < 3; i++) expect(await update.handler({ path: '/oauth2/update-consent', body: { id: 'c', update: { scopes: ['tasks:delete'] } } })).toBeUndefined();
    expect(await update.handler({ path: '/oauth2/update-consent', body: { id: 'c', update: {} } })).toBeUndefined();
    expect(await update.handler({ path: '/oauth2/update-consent', body: { update: { scopes: ['tasks:read'] } } })).toBeUndefined();
    expect(mockValidateScopes).not.toHaveBeenCalled();
  });
});
