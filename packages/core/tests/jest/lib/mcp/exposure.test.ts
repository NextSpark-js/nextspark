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

  it('a project declares the scopes of its hand-written tools; nothing of the project runs to find them out', () => {
    const extraTools = jest.fn(() => [tool('app_archive_task', { entitySlug: 'tasks', operation: 'workflow', requiredScopes: ['tasks:read', 'tasks:delete'] })]);
    const utilityTools = jest.fn(() => [tool('app_export', { requiredScopes: ['patterns:read'] })]);
    const overrides: Record<string, McpEntityOverride> = {
      ...OVERRIDES,
      tasks: { excludeOperations: ['delete'], extraTools, extraToolScopes: ['tasks:delete'] },
    };
    expect(toolScopesOf(REGISTRY, { overrides })).toContain('tasks:delete');
    expect(toolScopesOf(REGISTRY, { overrides, utilityTools, utilityToolScopes: ['patterns:read'] })).toContain('patterns:read');
    expect(extraTools).not.toHaveBeenCalled();
    expect(utilityTools).not.toHaveBeenCalled();
  });

  it('a declaration counts only next to the tools it is for', () => {
    // no extraTools, an entity kept out by slug (the engine does not build its extra tools), no utilityTools
    expect(toolScopesOf(REGISTRY, { overrides: { tasks: { excludeOperations: ['delete'], extraToolScopes: ['tasks:delete'] } } })).not.toContain('tasks:delete');
    expect(
      toolScopesOf(REGISTRY, { overrides: { patterns: { extraTools: () => [], extraToolScopes: ['patterns:write'] } } })
    ).not.toContain('patterns:write');
    expect(toolScopesOf(REGISTRY, { utilityToolScopes: ['patterns:read'] })).not.toContain('patterns:read');
  });

  describe('against the engine built from the same registry and options', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => warn.mockRestore());

    const build = (options: Record<string, unknown>) =>
      createMcpEngine(REGISTRY, { toolPrefix: 'acme', ...options } as Parameters<typeof createMcpEngine>[1]);

    it('is exactly what the tools need when the hand-written ones are declared', () => {
      const overrides: Record<string, McpEntityOverride> = {
        ...OVERRIDES,
        customers: {
          extraTools: api => [
            tool(`${api.toolPrefix}_customer_merge`, { entitySlug: 'customers', operation: 'workflow', requiredScopes: ['customers:read', 'tasks:delete'] }),
            tool(`${api.toolPrefix}_customer_purge`, { entitySlug: 'customers', operation: 'delete' }),
          ],
          extraToolScopes: ['tasks:delete'],
        },
      };
      const utilityTools = () => [tool('acme_export', { requiredScopes: ['readonly:read', 'hidden:read'] })];
      for (const options of [
        { overrides: OVERRIDES },
        { overrides, utilityTools, utilityToolScopes: ['hidden:read'] },
        { overrides, utilityTools, utilityToolScopes: ['hidden:read'], excludeSlugs: ['tasks'] },
        { overrides: OVERRIDES, defaultOperations: ['list', 'delete'] },
      ]) {
        expect(toolScopesOf(REGISTRY, options as Parameters<typeof toolScopesOf>[1])).toEqual(build(options).toolScopes);
      }
      expect(warn).not.toHaveBeenCalled();
    });

    it('the engine says so when a hand-written tool needs a scope that is not declared, and still builds it', () => {
      const overrides: Record<string, McpEntityOverride> = {
        tasks: {
          excludeOperations: ['delete'],
          extraTools: () => [tool('acme_archive_task', { entitySlug: 'tasks', operation: 'workflow', requiredScopes: ['tasks:read', 'tasks:delete'] })],
        },
      };
      const engine = build({ overrides });
      expect(engine.tools.map(t => t.name)).toContain('acme_archive_task');
      expect(engine.requiredScopesFor('acme_archive_task')).toEqual(['tasks:read', 'tasks:delete']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/"acme_archive_task" needs tasks:delete.*extraToolScopes/);
      // what sign-in publishes does not have it: no connection can be granted it until it is declared
      expect(toolScopesOf(REGISTRY, { overrides })).not.toContain('tasks:delete');
    });

    it('a tool whose scopes depend on what the engine hands it is held to the declaration, not guessed', () => {
      // the scenario of the review: requiredScopes chosen from api.toolPrefix
      const overrides: Record<string, McpEntityOverride> = {
        customers: {
          extraTools: api => [tool(`${api.toolPrefix}_report`, { requiredScopes: [api.toolPrefix === 'acme' ? 'readonly:read' : 'patterns:read'] })],
          extraToolScopes: ['readonly:read'],
        },
      };
      expect(build({ overrides }).toolScopes).toContain('readonly:read');
      expect(toolScopesOf(REGISTRY, { overrides })).toContain('readonly:read');
      expect(toolScopesOf(REGISTRY, { overrides })).not.toContain('patterns:read');
      expect(warn).not.toHaveBeenCalled();
      createMcpEngine(REGISTRY, { toolPrefix: 'other', overrides } as Parameters<typeof createMcpEngine>[1]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/"other_report" needs patterns:read/);
    });
  });
});
