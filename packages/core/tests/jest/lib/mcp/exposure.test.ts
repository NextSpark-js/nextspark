/**
 * What the MCP server exposes of the entity registry, computed in one place (#541): the engine builds its tools
 * from it, and MCP browser sign-in takes from it the scopes it publishes, offers on the consent screen and grants.
 */
jest.mock('@/core/lib/mcp/executor', () => ({ executeEntityOperation: jest.fn() }));
jest.mock('@/core/lib/mcp/audit', () => ({ auditToolCall: jest.fn() }));

import { createMcpEngine } from '@/core/lib/mcp/engine';
import { DEFAULT_EXCLUDED_SLUGS, exposedEntities, operationScope, toolScopesOf } from '@/core/lib/mcp/exposure';
import type { EntityConfig, EntityField } from '@/core/lib/entities/types';
import type { McpEntityOverride, McpToolDefinition } from '@/core/lib/mcp/types';

function field(name: string): EntityField {
  return {
    name,
    type: 'text',
    required: false,
    display: { label: name, showInList: true, showInDetail: true, showInForm: true, order: 0 },
    api: { searchable: false, sortable: false, filterable: true, readOnly: false },
  } as unknown as EntityField;
}

function entity(slug: string, overrides: Partial<EntityConfig> = {}): EntityConfig {
  return {
    slug,
    enabled: true,
    access: { api: true },
    names: { singular: slug.slice(0, -1), plural: slug },
    fields: [field('name')],
    ...overrides,
  } as unknown as EntityConfig;
}

function tool(name: string, meta?: McpToolDefinition['meta']): McpToolDefinition {
  return { name, title: name, description: name, inputSchema: {}, handler: async () => ({ content: [] }), meta } as unknown as McpToolDefinition;
}

const REGISTRY: Record<string, EntityConfig> = {
  customers: entity('customers'),
  tasks: entity('tasks'),
  patterns: entity('patterns'),
  internal: entity('internal', { access: { api: false } } as Partial<EntityConfig>),
  disabled: entity('disabled', { enabled: false }),
  hidden: entity('hidden'),
  readonly: entity('readonly', { access: { api: { read: true } } } as unknown as Partial<EntityConfig>),
};

const OVERRIDES: Record<string, McpEntityOverride> = {
  tasks: { excludeOperations: ['delete'] },
  hidden: { exclude: true },
};

describe('what the MCP server exposes of the entity registry', () => {
  it('patterns is kept out by default', () => {
    expect(DEFAULT_EXCLUDED_SLUGS).toEqual(['patterns']);
  });

  it('an entity is exposed when it is enabled, served by the API, not excluded and has an operation left', () => {
    const exposed = exposedEntities(REGISTRY, { overrides: OVERRIDES });
    expect(exposed.map(entry => [entry.slug, entry.operations])).toEqual([
      ['customers', ['list', 'get', 'create', 'update', 'delete']],
      ['tasks', ['list', 'get', 'create', 'update']],
      ['readonly', ['list', 'get']],
    ]);
  });

  it('a project can keep other slugs out, and narrow the operations of every entity', () => {
    const exposed = exposedEntities(REGISTRY, { excludeSlugs: ['customers'], defaultOperations: ['list'] });
    expect(exposed.map(entry => [entry.slug, entry.operations])).toEqual([
      ['tasks', ['list']],
      ['patterns', ['list']],
      ['hidden', ['list']],
      ['readonly', ['list']],
    ]);
  });

  it('an operation needs the scope of the API handler it runs', () => {
    expect((['list', 'get', 'create', 'update', 'delete'] as const).map(op => operationScope('tasks', op))).toEqual([
      'tasks:read', 'tasks:read', 'tasks:write', 'tasks:write', 'tasks:delete',
    ]);
  });

  it('the scopes some tool needs leave out an entity kept out of MCP and an operation an override excludes', () => {
    expect(toolScopesOf(REGISTRY, { overrides: OVERRIDES })).toEqual([
      'customers:delete', 'customers:read', 'customers:write', 'readonly:read', 'tasks:read', 'tasks:write',
    ]);
  });

  it('a hand-written tool adds the scopes it declares, and only those', () => {
    const overrides: Record<string, McpEntityOverride> = {
      ...OVERRIDES,
      tasks: {
        excludeOperations: ['delete'],
        extraTools: () => [
          tool('app_archive_task', { entitySlug: 'tasks', operation: 'workflow', requiredScopes: ['tasks:read', 'tasks:delete'] }),
          tool('app_task_report', { entitySlug: 'tasks', operation: 'workflow' }),
        ],
      },
    };
    expect(toolScopesOf(REGISTRY, { overrides })).toContain('tasks:delete');
    const utilityTools = () => [tool('app_export', { requiredScopes: ['patterns:read'] })];
    expect(toolScopesOf(REGISTRY, { overrides, utilityTools })).toContain('patterns:read');
  });

  it('the extra tools of an entity kept out by slug are not counted, as the engine does not build them', () => {
    const overrides: Record<string, McpEntityOverride> = {
      patterns: { extraTools: () => [tool('app_pattern_tool', { requiredScopes: ['patterns:write'] })] },
    };
    expect(toolScopesOf(REGISTRY, { overrides })).not.toContain('patterns:write');
  });

  it('a tool factory that throws leaves its scopes out instead of failing the caller', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides: Record<string, McpEntityOverride> = {
      customers: { extraTools: () => { throw new Error('boom'); } },
    };
    expect(toolScopesOf(REGISTRY, { overrides })).toEqual([
      'customers:delete', 'customers:read', 'customers:write', 'hidden:delete', 'hidden:read', 'hidden:write',
      'readonly:read', 'tasks:delete', 'tasks:read', 'tasks:write',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('is exactly what the engine built from the same registry and options needs', () => {
    const overrides: Record<string, McpEntityOverride> = {
      ...OVERRIDES,
      customers: {
        extraTools: api => [
          tool(`${api.toolPrefix}_customer_merge`, { entitySlug: 'customers', operation: 'workflow', requiredScopes: ['customers:read', 'tasks:delete'] }),
          tool(`${api.toolPrefix}_customer_purge`, { entitySlug: 'customers', operation: 'delete' }),
        ],
      },
    };
    const utilityTools = () => [tool('acme_export', { requiredScopes: ['readonly:read', 'hidden:read'] })];
    for (const options of [
      { overrides: OVERRIDES },
      { overrides, utilityTools },
      { overrides, utilityTools, excludeSlugs: ['tasks'] },
      { overrides: OVERRIDES, defaultOperations: ['list', 'delete'] as const },
    ]) {
      const engine = createMcpEngine(REGISTRY, { toolPrefix: 'acme', ...options } as Parameters<typeof createMcpEngine>[1]);
      expect(toolScopesOf(REGISTRY, options as Parameters<typeof toolScopesOf>[1])).toEqual(engine.toolScopes);
    }
  });
});
