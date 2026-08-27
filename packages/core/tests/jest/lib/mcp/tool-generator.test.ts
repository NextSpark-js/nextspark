import {
  generateEntityTools,
  toolToken,
  listArgsToQuery,
  normalizeDateFields,
} from '@/core/lib/mcp/tool-generator';
import type { EntityConfig, EntityField } from '@/core/lib/entities/types';
import { McpToolError } from '@/core/lib/mcp/types';
import type { EntityApiResult, EntityExecutor, McpOperation, ToolExecutionContext } from '@/core/lib/mcp/types';

function field(overrides: Partial<EntityField> & { name: string; type: EntityField['type'] }): EntityField {
  return {
    required: false,
    display: { label: overrides.name, showInList: true, showInDetail: true, showInForm: true, order: 0 },
    api: { searchable: false, sortable: false, filterable: true, readOnly: false },
    ...overrides,
  } as unknown as EntityField;
}

const CUSTOMERS: EntityConfig = {
  slug: 'customers',
  names: { singular: 'customer', plural: 'Customers' },
  fields: [field({ name: 'name', type: 'text', required: true })],
} as unknown as EntityConfig;

const CTX: ToolExecutionContext = {
  userId: 'user-1',
  userRole: 'member',
  teamId: 'team-1',
  authHeader: 'Bearer sk_live_abc',
  apiKeyId: 'key-1',
  scopes: ['customers:read', 'customers:write', 'customers:delete'],
};

const ALL_OPS: McpOperation[] = ['list', 'get', 'create', 'update', 'delete'];

function ok(data: unknown = {}, info: Record<string, unknown> = {}): EntityApiResult {
  return { status: 200, body: { success: true, data, info } };
}

function denied(): EntityApiResult {
  return { status: 403, body: { success: false, code: 'HTTP_403', error: 'forbidden' } };
}

function tools(
  executor: EntityExecutor,
  operations: McpOperation[] = ALL_OPS,
  config: EntityConfig = CUSTOMERS
) {
  return generateEntityTools(config, operations, undefined, { executor, toolPrefix: 'acme' });
}

describe('generateEntityTools', () => {
  it('generates one tool per requested operation with config-driven names', () => {
    const result = tools(jest.fn());
    expect(result.map((t) => t.name)).toEqual([
      'acme_list_customers',
      'acme_get_customer',
      'acme_create_customer',
      'acme_update_customer',
      'acme_delete_customer',
    ]);
  });

  it('only generates tools for the requested operations (excludeOperations happens upstream)', () => {
    const result = tools(jest.fn(), ['list', 'get']);
    expect(result.map((t) => t.name)).toEqual(['acme_list_customers', 'acme_get_customer']);
  });

  it('rejects a delete call without confirm:true, never reaching the executor', async () => {
    const executor = jest.fn();
    const [deleteTool] = tools(executor, ['delete']);
    const result = await deleteTool.handler({ id: 'rec-1', confirm: false }, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no confirmada');
    expect(executor).not.toHaveBeenCalled();
  });

  it('proceeds with delete when confirm:true', async () => {
    const executor = jest.fn().mockResolvedValue(ok());
    const [deleteTool] = tools(executor, ['delete']);
    const result = await deleteTool.handler({ id: 'rec-1', confirm: true }, CTX);
    expect(result.isError).toBeUndefined();
    expect(executor).toHaveBeenCalledWith({ slug: 'customers', operation: 'delete', id: 'rec-1' }, CTX);
  });

  it('formats a root-level (path-less) validation issue as a bare message, not "undefined: message"', async () => {
    const executor = jest.fn();
    const [listTool] = tools(executor, ['list']);
    // A non-object root value produces a Zod issue with an empty `path`.
    const result = await listTool.handler('not-an-object' as unknown as Record<string, unknown>, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain('undefined:');
  });

  it('rejects invalid args before ever calling the executor', async () => {
    const executor = jest.fn();
    const [, , createTool] = tools(executor, ['list', 'get', 'create']);
    // "name" is required per the fixture's field config.
    const result = await createTool.handler({}, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Argumentos inválidos');
    expect(executor).not.toHaveBeenCalled();
  });

  it('rejects update with no fields besides id', async () => {
    const executor = jest.fn();
    const [updateTool] = tools(executor, ['update']);
    const result = await updateTool.handler({ id: 'rec-1' }, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ningún campo');
    expect(executor).not.toHaveBeenCalled();
  });

  it('translates a denied executor result into a tool error (permission/scope denial surfaces here)', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(denied());
    const [, , createTool] = tools(executor, ['list', 'get', 'create']);
    const result = await createTool.handler({ name: 'Acme' }, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Sin permiso');
    expect(result.content[0].text).toContain('customers:write');
  });

  it('passes list pagination info through in structuredContent', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(
      ok([{ id: '1' }, { id: '2' }], { total: 2, page: 1, totalPages: 1 })
    );
    const [listTool] = tools(executor, ['list']);
    const result = await listTool.handler({}, CTX);
    expect(result.structuredContent).toEqual({
      data: [{ id: '1' }, { id: '2' }],
      info: { total: 2, page: 1, totalPages: 1 },
    });
    expect(result.content[0].text).toContain('2 Customers');
  });

  it('list/get/delete surface a failed executor result as a translated apiError, not a thrown error', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(denied());
    const [listTool, getTool, , , deleteTool] = tools(executor, ALL_OPS);

    const listResult = await listTool.handler({}, CTX);
    expect(listResult.isError).toBe(true);

    const getResult = await getTool.handler({ id: 'rec-1' }, CTX);
    expect(getResult.isError).toBe(true);

    const deleteResult = await deleteTool.handler({ id: 'rec-1', confirm: true }, CTX);
    expect(deleteResult.isError).toBe(true);
  });

  it('list falls back to "?" total when data is not an array and info.total is missing', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ weird: 'shape' }, {}));
    const [listTool] = tools(executor, ['list']);
    const result = await listTool.handler({}, CTX);
    expect(result.content[0].text).toBe('? Customers (página 1/1)');
  });

  it('update surfaces a failed executor result as a translated apiError', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(denied());
    const [updateTool] = tools(executor, ['update']);
    const result = await updateTool.handler({ id: 'c1', name: 'x' }, CTX);
    expect(result.isError).toBe(true);
  });

  it('list falls back to data.length and page 1 of 1 when the executor returns no info object', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok([{ id: '1' }, { id: '2' }], {}));
    const [listTool] = tools(executor, ['list']);
    const result = await listTool.handler({}, CTX);
    expect(result.content[0].text).toBe('2 Customers (página 1/1)');
  });

  it('an entity with neither an override description nor presets has an empty entity description', () => {
    const result = tools(jest.fn(), ['get']);
    // "Obtiene un registro de customer por ID. " with nothing appended after it.
    expect(result[0].description.trim().endsWith('por ID.')).toBe(true);
  });

  it('override.describe.entity is used as the entity description in every generated tool', () => {
    const result = generateEntityTools(CUSTOMERS, ['get'], { describe: { entity: 'A paying customer.' } }, {
      executor: jest.fn(),
      toolPrefix: 'acme',
    });
    expect(result[0].description).toContain('A paying customer.');
  });

  it('feeds a GET preset example (params, not payload) into the list tool description', () => {
    const result = generateEntityTools(CUSTOMERS, ['list'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
      presets: {
        summary: 'Customer records',
        presets: [{ id: 'active-only', method: 'GET', params: { status: 'active' }, title: 'Active customers' }],
      },
    });
    expect(result[0].description).toContain('Active customers');
    expect(result[0].description).toContain('"status":"active"');
  });

  it('a preset with no explicit `method` defaults to GET when matching examples for the list tool', () => {
    const result = generateEntityTools(CUSTOMERS, ['list'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
      presets: { summary: 'Customers', presets: [{ id: 'default-method', params: { limit: 5 } }] },
    });
    expect(result[0].description).toContain('Ejemplo (default-method)');
  });

  it('presetExamples falls back to the preset id when it has neither description nor title', () => {
    const result = generateEntityTools(CUSTOMERS, ['create'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
      presets: { summary: 'Customers', presets: [{ id: 'bare-example', method: 'POST', payload: { name: 'x' } }] },
    });
    expect(result[0].description).toContain('Ejemplo (bare-example)');
  });

  it('presets with no example for the relevant HTTP method add no example text', () => {
    const result = generateEntityTools(CUSTOMERS, ['create'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
      presets: { summary: 'Customers', presets: [{ id: 'list-only', method: 'GET', params: { limit: 10 } }] },
    });
    expect(result[0].description).not.toContain('Ejemplo');
  });

  it('override.describe.tools.delete replaces the entire delete tool description (not just an appended hint)', () => {
    const result = generateEntityTools(
      CUSTOMERS,
      ['delete'],
      { describe: { tools: { delete: 'Also removes linked invoices.' } } },
      { executor: jest.fn(), toolPrefix: 'acme' }
    );
    expect(result[0].description).toBe('Also removes linked invoices.');
  });

  it('the default (un-overridden) delete description carries the built-in destructive warning', () => {
    const result = generateEntityTools(CUSTOMERS, ['delete'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
    });
    expect(result[0].description).toContain('DESTRUCTIVO');
  });

  it('override.describe.tools overrides the default tool description', () => {
    const result = generateEntityTools(CUSTOMERS, ['list'], { describe: { tools: { list: 'Custom list desc' } } }, {
      executor: jest.fn(),
      toolPrefix: 'acme',
    });
    expect(result[0].description).toBe('Custom list desc');
  });

  it('feeds a preset payload example into the create tool description', () => {
    const result = generateEntityTools(CUSTOMERS, ['create'], undefined, {
      executor: jest.fn(),
      toolPrefix: 'acme',
      presets: {
        summary: 'Customer records',
        presets: [{ id: 'basic', method: 'POST', payload: { name: 'Acme' }, description: 'Basic customer' }],
      },
    });
    expect(result[0].description).toContain('Basic customer');
    expect(result[0].description).toContain('"name":"Acme"');
  });

  it('update succeeds with valid fields and returns structuredContent', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ id: 'c1', name: 'Acme Updated' }));
    const [updateTool] = tools(executor, ['update']);
    const result = await updateTool.handler({ id: 'c1', name: 'Acme Updated' }, CTX);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ data: { id: 'c1', name: 'Acme Updated' } });
    expect(executor).toHaveBeenCalledWith(
      { slug: 'customers', operation: 'update', id: 'c1', body: { name: 'Acme Updated' } },
      CTX
    );
  });

  it('applies override.transformInput before calling the executor on update', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ id: 'c1' }));
    const result = generateEntityTools(
      CUSTOMERS,
      ['update'],
      { transformInput: async (_op, input) => ({ ...input, name: `${input.name as string}!` }) },
      { executor, toolPrefix: 'acme' }
    );
    await result[0].handler({ id: 'c1', name: 'Acme' }, CTX);
    expect(executor).toHaveBeenCalledWith(
      { slug: 'customers', operation: 'update', id: 'c1', body: { name: 'Acme!' } },
      CTX
    );
  });

  it('create response with no id field omits the "(id: ...)" suffix', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ name: 'Acme' }));
    const [, , createTool] = tools(executor, ['list', 'get', 'create']);
    const result = await createTool.handler({ name: 'Acme' }, CTX);
    expect(result.content[0].text).toBe('customer creado.');
  });

  it('a thrown McpToolError from transformInput is surfaced as its own message, not a generic error', async () => {
    const result = generateEntityTools(
      CUSTOMERS,
      ['create'],
      {
        transformInput: async () => {
          throw new McpToolError('dueDate is required — never invent one.');
        },
      },
      { executor: jest.fn(), toolPrefix: 'acme' }
    );
    const outcome = await result[0].handler({ name: 'Acme' }, CTX);
    expect(outcome.isError).toBe(true);
    expect(outcome.content[0].text).toBe('dueDate is required — never invent one.');
  });

  it('handler treats undefined/null rawArgs as an empty object rather than throwing', async () => {
    const [listTool] = tools(jest.fn().mockResolvedValue(ok([])), ['list']);
    const result = await listTool.handler(undefined as unknown as Record<string, unknown>, CTX);
    expect(result.isError).toBeUndefined();
  });

  it('a thrown non-Error value (e.g. a string) is stringified rather than crashing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const executor: EntityExecutor = jest.fn().mockRejectedValue('plain string failure');
    const [, , createTool] = tools(executor, ['list', 'get', 'create']);
    const result = await createTool.handler({ name: 'Acme' }, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('plain string failure');
    errorSpy.mockRestore();
  });

  it('an unexpected thrown error (not McpToolError) is logged and surfaced as a generic message', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const executor: EntityExecutor = jest.fn().mockRejectedValue(new Error('db exploded'));
    const [, , createTool] = tools(executor, ['list', 'get', 'create']);
    const result = await createTool.handler({ name: 'Acme' }, CTX);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error inesperado');
    expect(result.content[0].text).toContain('db exploded');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('applies override.transformInput before calling the executor on create', async () => {
    const executor: EntityExecutor = jest.fn().mockResolvedValue(ok({ id: '1' }));
    const result = generateEntityTools(
      CUSTOMERS,
      ['create'],
      { transformInput: async (_op, input) => ({ ...input, name: `${input.name as string}!` }) },
      { executor, toolPrefix: 'acme' }
    );
    await result[0].handler({ name: 'Acme' }, CTX);
    expect(executor).toHaveBeenCalledWith(
      { slug: 'customers', operation: 'create', body: { name: 'Acme!' } },
      CTX
    );
  });
});

describe('toolToken', () => {
  it('lowercases, strips accents, and replaces non-alphanumerics with underscores', () => {
    expect(toolToken('Meal Plans')).toBe('meal_plans');
    expect(toolToken('Comidón')).toBe('comidon');
    expect(toolToken('  --Weird__Name!! ')).toBe('weird_name');
  });
});

describe('listArgsToQuery', () => {
  it('flattens filters into the query and joins fields with commas', () => {
    const query = listArgsToQuery({
      page: 2,
      filters: { status: 'active', empty: '' },
      fields: ['id', 'name'],
    });
    expect(query).toEqual({ page: '2', status: 'active', fields: 'id,name' });
  });

  it('omits undefined/null/empty values', () => {
    const query = listArgsToQuery({ search: undefined, page: null, limit: '' });
    expect(query).toEqual({});
  });
});

describe('normalizeDateFields', () => {
  it('trims timestamptz-serialized date fields to YYYY-MM-DD', () => {
    const row = normalizeDateFields({ dueDate: '2026-01-01T00:00:00.000Z', name: 'x' }, ['dueDate']);
    expect(row).toEqual({ dueDate: '2026-01-01', name: 'x' });
  });

  it('passes through non-object rows unchanged', () => {
    expect(normalizeDateFields(null, ['dueDate'])).toBeNull();
    expect(normalizeDateFields('string', ['dueDate'])).toBe('string');
  });
});
