import { createMcpEngine } from '@/core/lib/mcp/engine';
import type { EntityConfig, EntityField } from '@/core/lib/entities/types';
import type { EntityApiResult, EntityExecutor, ToolExecutionContext, McpEntityOverride } from '@/core/lib/mcp/types';

function field(overrides: Partial<EntityField> & { name: string; type: EntityField['type'] }): EntityField {
  return {
    required: false,
    display: { label: overrides.name, showInList: true, showInDetail: true, showInForm: true, order: 0 },
    api: { searchable: false, sortable: false, filterable: true, readOnly: false },
    ...overrides,
  } as unknown as EntityField;
}

function makeEntity(overrides: Partial<EntityConfig> & { slug: string }): EntityConfig {
  return {
    enabled: true,
    access: { api: true },
    names: { singular: overrides.slug.slice(0, -1) || overrides.slug, plural: overrides.slug },
    fields: [field({ name: 'name', type: 'text' })],
    ...overrides,
  } as unknown as EntityConfig;
}

const CTX: ToolExecutionContext = {
  userId: 'user-1',
  userRole: 'member',
  teamId: 'team-1',
  authHeader: 'Bearer sk_live_abc',
  apiKeyId: 'key-1',
  scopes: ['*'],
};

function ok(data: unknown = { id: '1' }): EntityApiResult {
  return { status: 200, body: { success: true, data } };
}

function req(id: string | number, method: string, params?: unknown) {
  return { jsonrpc: '2.0', id, method, params };
}

async function listTools(engine: ReturnType<typeof createMcpEngine>) {
  const response = (await engine.handleJsonRpc(req(1, 'tools/list'), CTX)) as {
    result: { tools: Array<{ name: string; description: string }> };
  };
  return response.result.tools;
}

async function callTool(engine: ReturnType<typeof createMcpEngine>, name: string, args: Record<string, unknown>) {
  const response = (await engine.handleJsonRpc(req(2, 'tools/call', { name, arguments: args }), CTX)) as {
    result: { content: Array<{ type: string; text: string }>; structuredContent?: unknown; isError?: boolean };
  };
  return response.result;
}

describe('createMcpEngine', () => {
  it('exposes tools only for entities with access.api and enabled:true, skipping default-excluded slugs', async () => {
    const registry: Record<string, EntityConfig> = {
      customers: makeEntity({ slug: 'customers' }),
      internal: makeEntity({ slug: 'internal', access: { api: false } }),
      disabled: makeEntity({ slug: 'disabled', enabled: false }),
      patterns: makeEntity({ slug: 'patterns' }),
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    const names = engine.tools.map((t) => t.name);
    expect(names.some((n) => n.includes('customer'))).toBe(true);
    expect(names.some((n) => n.includes('internal'))).toBe(false);
    expect(names.some((n) => n.includes('disabled'))).toBe(false);
    expect(names.some((n) => n.includes('pattern'))).toBe(false);
  });

  it('override.exclude removes the whole entity; excludeOperations removes only specific tools', () => {
    const registry: Record<string, EntityConfig> = {
      customers: makeEntity({ slug: 'customers' }),
      invoices: makeEntity({ slug: 'invoices' }),
    };
    const overrides: Record<string, McpEntityOverride> = {
      customers: { exclude: true },
      invoices: { excludeOperations: ['delete'] },
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn(), overrides });
    const names = engine.tools.map((t) => t.name);
    expect(names.some((n) => n.includes('customer'))).toBe(false);
    expect(names).toContain('acme_list_invoices');
    expect(names).not.toContain('acme_delete_invoice');
  });

  it('tools/list handshake returns every generated tool with its description', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    const tools = await listTools(engine);
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['acme_list_customers', 'acme_get_customer', 'acme_create_customer', 'acme_update_customer', 'acme_delete_customer'].sort()
    );
    expect(tools.every((t) => typeof t.description === 'string' && t.description.length > 0)).toBe(true);
  });

  it('tools/call executes the tool and audits the call with entity metadata', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ id: 'c1', name: 'Acme' }));
    const audit = jest.fn().mockResolvedValue(undefined);
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });

    const result = await callTool(engine, 'acme_get_customer', { id: 'c1' });
    expect(result.isError).toBeUndefined();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toMatchObject({
      tool: 'acme_get_customer',
      entitySlug: 'customers',
      operation: 'get',
      teamId: 'team-1',
      apiKeyId: 'key-1',
      statusCode: 200,
    });
  });

  it('audits a failed tool call with the status the API answered', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const executor: EntityExecutor = jest.fn().mockResolvedValue({
      status: 403,
      body: { success: false, code: 'HTTP_403' },
    });
    const audit = jest.fn().mockResolvedValue(undefined);
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });

    const result = await callTool(engine, 'acme_get_customer', { id: 'c1' });
    expect(result.isError).toBe(true);
    expect(audit.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('joins override.extraTools and options.utilityTools into the final tool set', () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: () => [
          {
            name: 'acme_bulk_import_customers',
            title: 'Bulk import',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
          },
        ],
      },
    };
    const engine = createMcpEngine(registry, {
      toolPrefix: 'acme',
      executor: jest.fn(),
      overrides,
      utilityTools: () => [
        {
          name: 'acme_list_team_members',
          title: 'List team members',
          description: 'x',
          inputSchema: {},
          strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
          handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
        },
      ],
    });
    const names = engine.tools.map((t) => t.name);
    expect(names).toContain('acme_bulk_import_customers');
    expect(names).toContain('acme_list_team_members');
  });

  it('throws at construction time on a duplicate tool name', () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: () => [
          {
            name: 'acme_list_customers', // collides with the generated list tool
            title: 'dup',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
          },
        ],
      },
    };
    expect(() =>
      createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn(), overrides })
    ).toThrow('Duplicate MCP tool name');
  });

  it('normalizes DATE fields and applies override.transformOutput for every caller (generated tools and extraTools alike)', async () => {
    const registry = {
      mealplans: makeEntity({
        slug: 'mealplans',
        names: { singular: 'mealplan', plural: 'Mealplans' },
        fields: [field({ name: 'weekStart', type: 'date' })],
      }),
    };
    const executor: EntityExecutor = jest
      .fn()
      .mockResolvedValue(ok({ id: 'm1', weekStart: '2026-01-05T00:00:00.000Z' }));
    const overrides: Record<string, McpEntityOverride> = {
      mealplans: {
        transformOutput: (_op, data) => ({ ...(data as Record<string, unknown>), tagged: true }),
      },
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, overrides, audit: jest.fn() });
    const result = await callTool(engine, 'acme_get_mealplan', { id: 'm1' });
    expect(result.structuredContent).toEqual({ data: { id: 'm1', weekStart: '2026-01-05', tagged: true } });
  });

  it('defaults executor and audit when not provided, without invoking them at construction time', () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    expect(() => createMcpEngine(registry, { toolPrefix: 'acme' })).not.toThrow();
  });

  it('normalizes an array of rows returned by list, not just a single object', async () => {
    const registry = {
      mealplans: makeEntity({
        slug: 'mealplans',
        names: { singular: 'mealplan', plural: 'Mealplans' },
        fields: [field({ name: 'weekStart', type: 'date' })],
      }),
    };
    const executor: EntityExecutor = jest.fn().mockResolvedValue(
      ok([
        { id: 'm1', weekStart: '2026-01-05T00:00:00.000Z' },
        { id: 'm2', weekStart: '2026-01-12T00:00:00.000Z' },
      ])
    );
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit: jest.fn() });
    const result = await callTool(engine, 'acme_list_mealplans', {});
    expect(result.structuredContent).toEqual({
      data: [
        { id: 'm1', weekStart: '2026-01-05' },
        { id: 'm2', weekStart: '2026-01-12' },
      ],
      info: {},
    });
  });

  it('api.entitySchemas throws for a slug not present in the registry', () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    expect(() => engine.api.entitySchemas('does-not-exist')).toThrow('Unknown entity for MCP schemas');
  });

  it('an entity whose excludeOperations removes every default operation contributes zero tools', () => {
    const registry = {
      customers: makeEntity({ slug: 'customers' }),
      invoices: makeEntity({ slug: 'invoices' }),
    };
    const overrides: Record<string, McpEntityOverride> = {
      invoices: { excludeOperations: ['list', 'get', 'create', 'update', 'delete'] },
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn(), overrides });
    expect(engine.tools.some((t) => t.name.includes('invoice'))).toBe(false);
    expect(engine.tools.some((t) => t.name.includes('customer'))).toBe(true);
  });

  it('extraTools defined for an excluded (excludeSlugs) entity are skipped, not just its generated CRUD tools', () => {
    const registry = { patterns: makeEntity({ slug: 'patterns' }) };
    const overrides: Record<string, McpEntityOverride> = {
      patterns: {
        extraTools: () => [
          {
            name: 'acme_patterns_extra',
            title: 'x',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
          },
        ],
      },
    };
    // 'patterns' is in the DEFAULT_EXCLUDED_SLUGS set, so it never gets generated CRUD
    // tools — this asserts the extraTools loop also respects that exclusion.
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn(), overrides });
    expect(engine.tools).toHaveLength(0);
  });

  it('api.entitySchemas builds schemas with the registered override + translateOption context', () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const overrides: Record<string, McpEntityOverride> = {
      customers: { describe: { fields: { name: 'Custom label' } } },
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn(), overrides });
    const schemas = engine.api.entitySchemas('customers');
    expect(schemas.createShape.name.description).toBe('Custom label');
  });

  it("catches a tool handler that throws directly (defense in depth beyond tool-generator's own try/catch)", async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: () => [
          {
            name: 'acme_explode',
            title: 'Explode',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => {
              throw new Error('boom');
            },
          },
        ],
      },
    };
    const engine = createMcpEngine(registry, {
      toolPrefix: 'acme',
      executor: jest.fn(),
      overrides,
      audit: jest.fn(),
    });
    const result = await callTool(engine, 'acme_explode', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unexpected error: boom');
  });

  it('a tool handler that throws a non-Error value is still stringified safely at the engine catch', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: () => [
          {
            name: 'acme_explode_plain',
            title: 'Explode plainly',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => {
              // eslint-disable-next-line @typescript-eslint/only-throw-error
              throw 'plain string blowup';
            },
          },
        ],
      },
    };
    const engine = createMcpEngine(registry, {
      toolPrefix: 'acme',
      executor: jest.fn(),
      overrides,
      audit: jest.fn(),
    });
    const result = await callTool(engine, 'acme_explode_plain', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('plain string blowup');
  });

  it('normalizingExecutor tolerates a slug with no matching entity in the registry (extraTools calling api.execute for a workflow-only op)', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ id: '1' }));
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: (api) => [
          {
            name: 'acme_workflow_unknown_slug',
            title: 'Workflow',
            description: 'x',
            inputSchema: {},
            strictSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
            handler: async () => {
              const r = await api.execute({ slug: 'not-a-real-entity', operation: 'get', id: '1' }, {
                userId: 'u', userRole: 'member', teamId: 't', authHeader: '', apiKeyId: null, scopes: [],
              });
              return { content: [{ type: 'text' as const, text: JSON.stringify(r.body.data) }] };
            },
          },
        ],
      },
    };
    const engine = createMcpEngine(registry, {
      toolPrefix: 'acme',
      executor,
      overrides,
      audit: jest.fn(),
    });
    const result = await callTool(engine, 'acme_workflow_unknown_slug', {});
    expect(result.isError).toBeUndefined();
  });

  it('a batch where every message is a notification returns null, not an empty array', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    const responses = await engine.handleJsonRpc(
      [
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', method: 'notifications/cancelled' },
      ],
      CTX
    );
    expect(responses).toBeNull();
  });

  it('a JSON-RPC notification (no id) yields a null response', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    const response = await engine.handleJsonRpc(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      CTX
    );
    expect(response).toBeNull();
  });

  it('processes a batch (array) of messages and returns only the responses', async () => {
    const registry = { customers: makeEntity({ slug: 'customers' }) };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor: jest.fn() });
    const responses = (await engine.handleJsonRpc(
      [req(1, 'tools/list'), { jsonrpc: '2.0', method: 'notifications/initialized' }],
      CTX
    )) as unknown[];
    expect(responses).toHaveLength(1);
  });
});

describe('the scopes a tool call needs (#541)', () => {
  it('is <entity>:read, :write or :delete for the generated entity tools, as the API handler declares it', () => {
    const engine = createMcpEngine({ customers: makeEntity({ slug: 'customers' }) }, { toolPrefix: 'acme', executor: jest.fn() });
    const scopes = Object.fromEntries(engine.tools.map(tool => [tool.name, engine.requiredScopesFor(tool.name)]));
    expect(scopes).toEqual({
      acme_list_customers: ['customers:read'],
      acme_get_customer: ['customers:read'],
      acme_create_customer: ['customers:write'],
      acme_update_customer: ['customers:write'],
      acme_delete_customer: ['customers:delete'],
    });
  });

  it('is what a composite tool declares, and none for one that declares nothing or an unknown name', () => {
    const tool = (name: string, meta: object) => ({ name, description: name, inputSchema: {}, handler: jest.fn(), meta });
    const overrides = {
      customers: {
        extraTools: () => [
          tool('acme_customer_report', { entitySlug: 'customers', operation: 'workflow' }),
          tool('acme_customer_merge', { entitySlug: 'customers', operation: 'workflow', requiredScopes: ['customers:read', 'customers:delete'] }),
        ],
      },
    };
    const engine = createMcpEngine({ customers: makeEntity({ slug: 'customers' }) }, { toolPrefix: 'acme', executor: jest.fn(), overrides: overrides as never });
    expect(engine.requiredScopesFor('acme_customer_report')).toEqual([]);
    expect(engine.requiredScopesFor('acme_customer_merge')).toEqual(['customers:read', 'customers:delete']);
    expect(engine.requiredScopesFor('no_such_tool')).toEqual([]);
  });
});

describe('the audit trail of what did not succeed (#541)', () => {
  const registry: Record<string, EntityConfig> = { customers: makeEntity({ slug: 'customers' }) };

  it('an error that never reached the API (arguments the tool rejects) is recorded as a 400', async () => {
    const executor: EntityExecutor = jest.fn();
    const audit = jest.fn().mockResolvedValue(undefined);
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });
    const result = await callTool(engine, 'acme_update_customer', { id: 'c-1' });
    expect(result.isError).toBe(true);
    expect(executor).not.toHaveBeenCalled();
    expect(audit.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });

  it('an API error is recorded with its own status, not as a 400', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue({ status: 404, body: { success: false, error: 'Not found' } });
    const audit = jest.fn().mockResolvedValue(undefined);
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });
    const result = await callTool(engine, 'acme_get_customer', { id: 'missing' });
    expect(result.isError).toBe(true);
    expect(audit.mock.calls[0][0]).toMatchObject({ statusCode: 404, recordId: 'missing' });
    // The status stays in the trail: the client is sent the result as before
    expect(Object.keys(result).sort()).toEqual(['content', 'isError']);
  });

  it('a generated tool whose API call throws is recorded as a 500 too', async () => {
    const executor: EntityExecutor = jest.fn().mockRejectedValue(new Error('pool exhausted'));
    const audit = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });
    const result = await callTool(engine, 'acme_get_customer', { id: 'c-1' });
    expect(result.isError).toBe(true);
    expect(audit.mock.calls[0][0]).toMatchObject({ tool: 'acme_get_customer', statusCode: 500 });
    (console.error as jest.Mock).mockRestore();
  });

  it('a handler that throws is recorded as a 500', async () => {
    const executor: EntityExecutor = jest.fn();
    const audit = jest.fn().mockResolvedValue(undefined);
    const overrides: Record<string, McpEntityOverride> = {
      customers: {
        extraTools: () => [{
          name: 'acme_broken', title: 'Broken', description: 'Throws', inputSchema: {},
          handler: async () => { throw new Error('boom'); },
        }] as never,
      },
    };
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit, overrides });
    await callTool(engine, 'acme_broken', {});
    expect(audit.mock.calls[0][0]).toMatchObject({ tool: 'acme_broken', statusCode: 500 });
  });

  it('calls refused for missing scopes are recorded one by one, with what each lacked, and nothing runs', async () => {
    const executor: EntityExecutor = jest.fn();
    const audit = jest.fn().mockResolvedValue(undefined);
    const engine = createMcpEngine(registry, { toolPrefix: 'acme', executor, audit });
    const ctx = { ...CTX, apiKeyId: null, principal: { oauth: { clientId: 'https://client.example/meta', tokenId: 'jti-1' } } } as unknown as ToolExecutionContext;
    await engine.auditRefused(
      [
        req(1, 'tools/call', { name: 'acme_delete_customer', arguments: { id: 'c-1' } }),
        req(2, 'tools/call', { name: 'acme_list_customers', arguments: {} }),
        req(3, 'tools/list'),
        req(4, 'tools/call', { name: 'acme_unknown', arguments: {} }),
        { method: 'tools/call', params: { name: 'acme_delete_customer' } },
      ],
      ctx,
      ['customers:read']
    );
    expect(executor).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[0][0]).toMatchObject({
      tool: 'acme_delete_customer', entitySlug: 'customers', operation: 'delete', recordId: 'c-1',
      statusCode: 403, missingScopes: ['customers:delete'], teamId: 'team-1', userId: 'user-1',
      oauth: { clientId: 'https://client.example/meta', tokenId: 'jti-1' },
    });
    // The call of the same batch that was allowed did not run either: recorded as refused, missing nothing itself
    expect(audit.mock.calls[1][0]).toMatchObject({ tool: 'acme_list_customers', statusCode: 403, missingScopes: [] });
  });
});
