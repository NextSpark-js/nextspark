/**
 * What a consent grants is decided on the server (#541): the scopes the client asked for, that the user accepted,
 * and that the user's role in the team can hold, whatever the browser sent.
 */
const mockGetSession = jest.fn();
jest.mock('better-auth/api', () => ({
  createAuthMiddleware: (handler: unknown) => handler,
  getSessionFromCtx: (...args: unknown[]) => mockGetSession(...args),
}));
const mockValidateScopes = jest.fn();
jest.mock('@/core/lib/api/auth', () => ({ validateScopesForUser: (...args: unknown[]) => mockValidateScopes(...args) }));
const mockSelectedTeam = jest.fn();
jest.mock('@/core/lib/mcp/oauth/team-selection', () => ({
  isAuthorizationKey: (value: unknown) => typeof value === 'string' && value.length >= 43,
  selectedTeam: (...args: unknown[]) => mockSelectedTeam(...args),
}));

import { consentedScopes, consentWithinRolePlugin } from '@/core/lib/mcp/oauth/consent-plugin';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const REQUESTED = 'openid offline_access tasks:read tasks:write tasks:delete customers:read';
const signedQuery = (scope = REQUESTED, challenge = CHALLENGE) => new URLSearchParams({ scope, code_challenge: challenge, client_id: 'client' }).toString();

type Hook = { matcher: (ctx: { path: string }) => boolean; handler: (ctx: { path: string; body: unknown }) => Promise<{ context: { body: { scope: string } } } | undefined> };
const hook = (consentWithinRolePlugin().hooks!.before as unknown as Hook[])[0];
const consent = (body: Record<string, unknown>) => hook.handler({ path: '/oauth2/consent', body });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, session: { id: 'session-1' } });
  mockSelectedTeam.mockResolvedValue('team-1');
  // the role in the team can read and write tasks and read customers; it cannot delete
  mockValidateScopes.mockImplementation(async (_user: string, _team: string, scopes: string[]) => ({ allowedScopes: scopes.filter(scope => scope !== 'tasks:delete') }));
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
    expect(mockValidateScopes).toHaveBeenCalledWith('user-1', 'team-1', ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read']);
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
