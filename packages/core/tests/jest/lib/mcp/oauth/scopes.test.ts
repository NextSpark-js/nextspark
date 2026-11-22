jest.mock('@/core/lib/services/scope.service', () => ({
  ScopeService: {
    getBaseScopes: () => [],
    getRoles: () => ['owner', 'viewer'],
    getRoleScopes: (role: string) => (role === 'owner' ? ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', '*'] : ['tasks:read']),
  },
}));

import { mcpOAuthDefaultScopes, mcpOAuthResourceScopes, mcpOAuthStepUpScopes } from '@/core/lib/mcp/oauth/scopes';

describe('the scopes of MCP browser sign-in (#541)', () => {
  it('are the ones a team role can hold, without wildcards', () => {
    expect(mcpOAuthResourceScopes()).toEqual(['customers:read', 'tasks:delete', 'tasks:read', 'tasks:write']);
  });

  it('a connecting client is told to ask for read access and a refresh token, not for writes or deletes', () => {
    expect(mcpOAuthDefaultScopes()).toEqual(['offline_access', 'customers:read', 'tasks:read']);
  });

  it('a client that needs more is told to ask for what it has plus what is missing, keeping the refresh token', () => {
    expect(mcpOAuthStepUpScopes(['tasks:read', 'customers:read'], ['tasks:write'])).toEqual(['offline_access', 'customers:read', 'tasks:read', 'tasks:write']);
    expect(mcpOAuthStepUpScopes(['tasks:read'], ['tasks:read'])).toEqual(['offline_access', 'tasks:read']);
  });
});
