/**
 * The scopes MCP browser sign-in works with are the ones some tool of this app's MCP server needs (#541): the
 * same registries the /api/mcp route builds its tools from.
 */
jest.mock('@nextsparkjs/registries/entity-registry', () => {
  const entity = (slug: string, extra: Record<string, unknown> = {}) => ({
    name: slug,
    config: { slug, enabled: true, access: { api: true }, names: { singular: slug, plural: slug }, fields: [], ...extra },
  });
  return {
    ENTITY_REGISTRY: {
      customers: entity('customers'),
      tasks: entity('tasks'),
      patterns: entity('patterns'),
      notes: entity('notes', { access: { api: false } }),
    },
  };
});
jest.mock('@nextsparkjs/registries/mcp-registry', () => ({
  MCP_OVERRIDES: { tasks: { excludeOperations: ['delete'] } },
}));

import { mcpToolScopes, mcpToolScopesKnown } from '@/core/lib/mcp/oauth/tool-scopes';

describe('the scopes some tool of the app needs (#541)', () => {
  it('come from the entity registry and the MCP overrides of the app', () => {
    expect(mcpToolScopes()).toEqual(['customers:delete', 'customers:read', 'customers:write', 'tasks:read', 'tasks:write']);
  });

  it('are computed once', () => {
    expect(mcpToolScopes()).toBe(mcpToolScopes());
  });

  it('are known: the registries were read', () => {
    expect(mcpToolScopesKnown()).toBe(true);
  });
});
