/**
 * The scopes MCP browser sign-in works with are data `nextspark prepare` generates (#541), so that `lib/auth` loads
 * neither the entity registry nor the project's `mcp.ts` files. The `/api/mcp` route, which has both, checks the
 * data against the running app.
 */
jest.mock('@nextsparkjs/registries/mcp-scopes', () => ({
  MCP_SCOPES: {
    apiEntities: ['customers', 'patterns', 'tasks'],
    toolScopes: ['customers:delete', 'customers:read', 'customers:write', 'tasks:read', 'tasks:write'],
  },
}));

import type { EntityConfig } from '@/core/lib/entities/types';
import type { McpEntityOverride } from '@/core/lib/mcp/types';
import { mcpApiEntities, mcpScopeDrift, mcpToolScopes } from '@/core/lib/mcp/oauth/tool-scopes';

const entity = (slug: string, extra: Record<string, unknown> = {}) =>
  ({ slug, enabled: true, access: { api: true }, names: { singular: slug, plural: slug }, fields: [], ...extra }) as unknown as EntityConfig;

const entities = (): Record<string, EntityConfig> => ({
  customers: entity('customers'),
  tasks: entity('tasks'),
  patterns: entity('patterns'),
  notes: entity('notes', { access: { api: false } }),
});
const overrides = (): Record<string, McpEntityOverride> => ({ tasks: { excludeOperations: ['delete'] } });

describe('the scopes some tool of the app needs (#541)', () => {
  it('are the generated list', () => {
    expect(mcpToolScopes()).toEqual(['customers:delete', 'customers:read', 'customers:write', 'tasks:read', 'tasks:write']);
    expect(mcpApiEntities()).toEqual(['customers', 'patterns', 'tasks']);
  });

  it('are handed out as a copy: a caller cannot change the list of the next one', () => {
    mcpToolScopes().push('tasks:delete');
    expect(mcpToolScopes()).not.toContain('tasks:delete');
  });
});

describe('the generated lists against the registries of the running app', () => {
  it('agree when the sources were read as the code runs', () => {
    expect(mcpScopeDrift(entities(), overrides())).toEqual([]);
  });

  it('a tool the app has and the list does not is named', () => {
    // the override no longer excludes delete: the registries are older than the code
    expect(mcpScopeDrift(entities(), {})).toEqual(['tool scopes: the app has tasks:delete, the generated list does not']);
  });

  it('a scope the list has and no tool needs is named', () => {
    expect(mcpScopeDrift(entities(), { ...overrides(), customers: { excludeOperations: ['delete'] } })).toEqual([
      'tool scopes: the generated list has customers:delete, the app does not',
    ]);
  });

  it('an entity the API serves and the list does not have is named, and one it no longer serves too', () => {
    const running = { ...entities(), notes: entity('notes'), patterns: entity('patterns', { access: { api: false } }) };
    expect(mcpScopeDrift(running, overrides())).toEqual([
      'tool scopes: the app has notes:delete, notes:read, notes:write, the generated list does not',
      'API entities: the app has notes, the generated list does not',
      'API entities: the generated list has patterns, the app does not',
    ]);
  });
});
