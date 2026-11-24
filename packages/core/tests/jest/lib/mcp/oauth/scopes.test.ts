// The permissions of two team roles, as the permissions registry holds them. `notes` is not served by the API and
// `billing.manage` is not an entity permission: neither gives a scope.
jest.mock('@nextsparkjs/registries/permissions-registry', () => ({
  AVAILABLE_ROLES: ['owner', 'viewer'],
  PERMISSIONS_BY_ROLE: {
    owner: new Set(['tasks.read', 'tasks.create', 'tasks.delete', 'customers.list', 'notes.read', 'billing.manage']),
    viewer: new Set(['tasks.read']),
  },
}));

const toolScopes = { current: ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', 'pages:read'] };
jest.mock('@/core/lib/mcp/oauth/tool-scopes', () => ({
  mcpToolScopes: () => toolScopes.current,
  mcpApiEntities: () => ['customers', 'pages', 'tasks'],
}));

import { activeScopes, entityScope, isPreselectedScope, mcpOAuthAcceptedScopes, mcpOAuthDefaultScopes, mcpOAuthResourceScopes, mcpOAuthRoleScopes, mcpOAuthStepUpScopes } from '@/core/lib/mcp/oauth/scopes';

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

  describe('when the tool of a scope is retired', () => {
    beforeEach(() => { toolScopes.current = ['tasks:read', 'tasks:write', 'customers:read']; });
    afterEach(() => { toolScopes.current = ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read', 'pages:read']; });

    it('the server still accepts it, so a client with an older list and a connection that holds it are not cut off', () => {
      expect(mcpOAuthAcceptedScopes()).toEqual(['customers:read', 'tasks:delete', 'tasks:read', 'tasks:write']);
    });

    it('it is no longer published, asked for by the challenge or offered', () => {
      expect(mcpOAuthResourceScopes()).toEqual(['customers:read', 'tasks:read', 'tasks:write']);
      expect(mcpOAuthDefaultScopes()).toEqual(['offline_access', 'customers:read', 'tasks:read', 'tasks:write']);
    });

    it('of a list of scopes, the active ones are the entity scopes with a tool and everything that is not an entity scope', () => {
      expect(activeScopes(['openid', 'offline_access', 'tasks:read', 'tasks:delete', 'patterns:write'])).toEqual(['openid', 'offline_access', 'tasks:read']);
    });

    it('a step-up challenge does not name it, even when the connection still holds it', () => {
      expect(mcpOAuthStepUpScopes(['tasks:read', 'tasks:delete'], ['tasks:write'])).toEqual(['offline_access', 'tasks:read', 'tasks:write']);
    });
  });

  it('a team role holds the scopes of its permissions, for the entities the API serves and no other', () => {
    expect(mcpOAuthRoleScopes('owner')).toEqual(['customers:read', 'tasks:read', 'tasks:write', 'tasks:delete']);
    expect(mcpOAuthRoleScopes('viewer')).toEqual(['tasks:read']);
    expect(mcpOAuthRoleScopes('nobody')).toEqual([]);
  });

  it('what is accepted is never a wildcard or a scope that is not an entity permission', () => {
    expect(mcpOAuthAcceptedScopes().every(scope => /^[a-z0-9-]+:(read|write|delete)$/.test(scope))).toBe(true);
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
