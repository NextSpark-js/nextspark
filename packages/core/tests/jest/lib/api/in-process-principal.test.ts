/**
 * #541: a principal the MCP endpoint verified from an OAuth access token reaches `authenticateRequest` through the
 * request object, never through a header, and gets the scope enforcement of an API key.
 */
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn().mockResolvedValue(null) } } }));
jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn().mockResolvedValue(null) }));
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn() }));
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }));
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }));

import { NextRequest } from 'next/server';
import { authenticateRequest, type DualAuthResult } from '@/core/lib/api/auth/dual-auth';
import { attachInProcessPrincipal } from '@/core/lib/api/auth/in-process-principal';
import { validateApiKey } from '@/core/lib/api/auth';

const principal: DualAuthResult = {
  success: true,
  type: 'api-key',
  oauth: { clientId: 'https://client.example/metadata.json', tokenId: 'jti-1', teamId: 'team-1' },
  user: { id: 'user-1', email: 'u@example.test', role: 'member', defaultTeamId: 'team-1' },
  scopes: ['tasks:read'],
};
const request = () => new NextRequest('http://mcp.internal/api/v1/tasks', { headers: { 'x-team-id': 'team-1' } });

describe('in-process principal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('authenticates the request it is attached to, with the scope it holds', async () => {
    const req = request();
    attachInProcessPrincipal(req, principal);
    const result = await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(result).toMatchObject({ success: true, type: 'api-key', oauth: principal.oauth, scopes: ['tasks:read'] });
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('is refused for a scope it does not hold, as an API key is', async () => {
    const req = request();
    attachInProcessPrincipal(req, principal);
    const result = await authenticateRequest(req, { requiredScope: 'tasks:write' });
    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 403 });
    expect(result.user?.id).toBe('user-1');
  });

  it('is refused on a route that declares no scope (fails closed)', async () => {
    const req = request();
    attachInProcessPrincipal(req, principal);
    const result = await authenticateRequest(req);
    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 403 });
  });

  it('counts against the per-credential limit of its OAuth client and user, once per request', async () => {
    const { checkRateLimit } = jest.requireActual('@/core/lib/api/rate-limit');
    const key = 'oauth:https://client.example/metadata.json:user-1:team-1';
    const before = checkRateLimit(key).remaining;
    const req = request();
    attachInProcessPrincipal(req, principal);
    await authenticateRequest(req, { requiredScope: 'tasks:read' });
    await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(checkRateLimit(key).remaining).toBe(before - 2); // one for the request, one for this read
  });

  it('is refused for a team other than the one the connection was approved for, whatever the caller is a member of', async () => {
    // What a tool written by a project does when it hands `api.execute` a context with another team
    const req = new NextRequest('http://mcp.internal/api/v1/tasks', { headers: { 'x-team-id': 'team-2' } });
    attachInProcessPrincipal(req, principal);
    const result = await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 403, code: 'TEAM_NOT_IN_CONNECTION' });
    expect(result.user?.id).toBe('user-1');
  });

  it('with no team header the request is the bound team\'s: nothing else can be resolved for it', async () => {
    const req = new NextRequest('http://mcp.internal/api/v1/tasks');
    attachInProcessPrincipal(req, principal);
    const result = await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({ success: true, user: { defaultTeamId: 'team-1' } });
  });

  it('an OAuth principal that names no team is refused (fails closed)', async () => {
    const req = request();
    attachInProcessPrincipal(req, { ...principal, oauth: { clientId: 'c' } as DualAuthResult['oauth'] });
    const result = await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(result.error).toMatchObject({ status: 403, code: 'TEAM_NOT_IN_CONNECTION' });
  });

  it('two connections of one client and user, to two teams, are counted apart', async () => {
    const { checkRateLimit } = jest.requireActual('@/core/lib/api/rate-limit');
    const other = 'oauth:https://client.example/metadata.json:user-1:team-2';
    const before = checkRateLimit(other).remaining;
    const req = request();
    attachInProcessPrincipal(req, principal);
    await authenticateRequest(req, { requiredScope: 'tasks:read' });
    expect(checkRateLimit(other).remaining).toBe(before - 1); // only the read this line makes
  });

  it('does not exist for any other request: an identical one is anonymous', async () => {
    attachInProcessPrincipal(request(), principal);
    const result = await authenticateRequest(request(), { requiredScope: 'tasks:read' });
    expect(result).toMatchObject({ success: false, type: 'none', user: null });
  });
});
