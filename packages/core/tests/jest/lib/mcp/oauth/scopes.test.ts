jest.mock('@/core/lib/services/scope.service', () => ({
  ScopeService: {
    getBaseScopes: () => [],
    getRoles: () => ['owner', 'viewer'],
    getRoleScopes: (role: string) => (role === 'owner' ? ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', '*'] : ['tasks:read']),
  },
}));

const toolScopes = { current: ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', 'pages:read'] };
jest.mock('@/core/lib/mcp/oauth/tool-scopes', () => ({ mcpToolScopes: () => toolScopes.current }));

import { entityScope, isPreselectedScope, mcpOAuthDefaultScopes, mcpOAuthResourceScopes, mcpOAuthStepUpScopes } from '@/core/lib/mcp/oauth/scopes';

describe('the scopes of MCP browser sign-in (#541)', () => {
  it('are the ones a team role can hold, without wildcards', () => {
    expect(mcpOAuthResourceScopes()).toEqual(['customers:read', 'tasks:delete', 'tasks:read', 'tasks:write']);
  });

  it('and only the ones some tool of the server needs: a permission that would do nothing is not published, offered or granted', () => {
    toolScopes.current = ['tasks:read', 'tasks:write', 'pages:read'];
    try {
      expect(mcpOAuthResourceScopes()).toEqual(['tasks:read', 'tasks:write']);
      expect(mcpOAuthDefaultScopes()).toEqual(['offline_access', 'tasks:read', 'tasks:write']);
    } finally {
      toolScopes.current = ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', 'pages:read'];
    }
  });

  it('a connecting client is told to ask for every scope and a refresh token; the consent screen decides', () => {
    expect(mcpOAuthDefaultScopes()).toEqual(['offline_access', 'customers:read', 'tasks:delete', 'tasks:read', 'tasks:write']);
  });

  it('a scope no tool of the server needs is not asked for', () => {
    expect(mcpOAuthDefaultScopes(['tasks:read', 'tasks:write', 'customers:read', 'pages:read'])).toEqual(['offline_access', 'customers:read', 'tasks:read', 'tasks:write']);
  });

  it('reading and writing come ticked on the consent screen, deleting does not', () => {
    expect(['tasks:read', 'tasks:write', 'tasks:delete'].map(isPreselectedScope)).toEqual([true, true, false]);
  });

  it('an entity permission is told apart from any other scope', () => {
    expect(entityScope('tasks:write')).toEqual({ entity: 'tasks', action: 'write' });
    expect(entityScope('blog-posts:delete')).toEqual({ entity: 'blog-posts', action: 'delete' });
    expect(entityScope('offline_access')).toBeNull();
    expect(entityScope('admin:api-keys')).toBeNull();
  });

  it('a client that needs more is told to ask for what it has plus what is missing, keeping the refresh token', () => {
    expect(mcpOAuthStepUpScopes(['tasks:read', 'customers:read'], ['tasks:write'])).toEqual(['offline_access', 'customers:read', 'tasks:read', 'tasks:write']);
    expect(mcpOAuthStepUpScopes(['tasks:read'], ['tasks:read'])).toEqual(['offline_access', 'tasks:read']);
  });
});
