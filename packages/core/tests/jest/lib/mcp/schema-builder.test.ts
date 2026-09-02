import { buildEntitySchemas } from '@/core/lib/mcp/schema-builder';
import type { EntityConfig, EntityField } from '@/core/lib/entities/types';

function field(overrides: Partial<EntityField> & { name: string; type: EntityField['type'] }): EntityField {
  return {
    required: false,
    display: { label: overrides.name, showInList: true, showInDetail: true, showInForm: true, order: 0 },
    api: { searchable: false, sortable: false, filterable: true, readOnly: false },
    ...overrides,
  } as unknown as EntityField;
}

function entity(fields: EntityField[], slug = 'customers'): EntityConfig {
  return {
    slug,
    names: { singular: 'customer', plural: 'Customers' },
    fields,
  } as unknown as EntityConfig;
}

describe('buildEntitySchemas', () => {
  it('marks a required create-only field required, and always-optional on update', () => {
    const config = entity([field({ name: 'name', type: 'text', required: true })]);
    const { createStrict, updateStrict } = buildEntitySchemas(config);

    expect(createStrict.safeParse({}).success).toBe(false);
    expect(createStrict.safeParse({ name: 'Acme' }).success).toBe(true);
    expect(updateStrict.safeParse({}).success).toBe(true);
  });

  it('relaxRequired makes an otherwise-required create field optional', () => {
    const config = entity([field({ name: 'expiryDate', type: 'date', required: true })]);
    const { createStrict } = buildEntitySchemas(config, { override: { relaxRequired: ['expiryDate'] } });
    expect(createStrict.safeParse({}).success).toBe(true);
  });

  it('rejects unknown keys (strict) on create/update/list/get', () => {
    const config = entity([field({ name: 'name', type: 'text' })]);
    const s = buildEntitySchemas(config);
    expect(s.createStrict.safeParse({ name: 'x', bogus: 1 }).success).toBe(false);
    expect(s.updateStrict.safeParse({ name: 'x', bogus: 1 }).success).toBe(false);
    expect(s.listStrict.safeParse({ bogus: 1 }).success).toBe(false);
    expect(s.getStrict.safeParse({ id: 'x', bogus: 1 }).success).toBe(false);
  });

  it('excludes media/file-like fields from the input schema entirely', () => {
    const config = entity([
      field({ name: 'name', type: 'text' }),
      field({ name: 'avatar', type: 'media-library' }),
    ]);
    const { createShape } = buildEntitySchemas(config);
    expect(Object.keys(createShape)).toEqual(['name']);
  });

  it('excludes API-readOnly fields from the input schema', () => {
    const config = entity([
      field({ name: 'name', type: 'text' }),
      field({ name: 'createdBy', type: 'text', api: { searchable: false, sortable: false, filterable: false, readOnly: true } }),
    ]);
    const { createShape } = buildEntitySchemas(config);
    expect(Object.keys(createShape)).toEqual(['name']);
  });

  it('sortBy is an enum restricted to sortable fields plus createdAt/updatedAt', () => {
    const config = entity([
      field({ name: 'name', type: 'text', api: { searchable: false, sortable: true, filterable: true, readOnly: false } }),
      field({ name: 'internal', type: 'text', api: { searchable: false, sortable: false, filterable: true, readOnly: false } }),
    ]);
    const { listStrict } = buildEntitySchemas(config);
    expect(listStrict.safeParse({ sortBy: 'name' }).success).toBe(true);
    expect(listStrict.safeParse({ sortBy: 'createdAt' }).success).toBe(true);
    expect(listStrict.safeParse({ sortBy: 'internal' }).success).toBe(false);
  });

  it('datetime fields are excluded from filters but date fields are included', () => {
    const config = entity([
      field({ name: 'dueAt', type: 'datetime' }),
      field({ name: 'dueDate', type: 'date' }),
    ]);
    const { listStrict } = buildEntitySchemas(config);
    // dueDate is a real filter key -> accepted.
    expect(listStrict.safeParse({ filters: { dueDate: '2026-01-01' } }).success).toBe(true);
    // dueAt was excluded from the filters shape -> unknown key under .strict() -> rejected.
    expect(listStrict.safeParse({ filters: { dueAt: '2026-01-01T00:00:00Z' } }).success).toBe(false);
  });

  it('a lone `from` without dateField is rejected; from+dateField is accepted', () => {
    const config = entity([field({ name: 'dueDate', type: 'date' })]);
    const { listStrict } = buildEntitySchemas(config);
    expect(listStrict.safeParse({ from: '2026-01-01' }).success).toBe(false);
    expect(listStrict.safeParse({ from: '2026-01-01', dateField: 'dueDate' }).success).toBe(true);
  });

  it('never exposes `distinct` in the list shape', () => {
    const config = entity([field({ name: 'name', type: 'text' })]);
    const { listShape } = buildEntitySchemas(config);
    expect(listShape.distinct).toBeUndefined();
  });

  it('search is only exposed when the entity has a searchable-by-name field', () => {
    const withName = buildEntitySchemas(entity([field({ name: 'name', type: 'text' })]));
    const withoutName = buildEntitySchemas(entity([field({ name: 'amount', type: 'number' })]));
    expect(withName.listShape.search).toBeDefined();
    expect(withoutName.listShape.search).toBeUndefined();
  });

  it('fields projection only accepts real field names', () => {
    const config = entity([field({ name: 'name', type: 'text' })]);
    const { listStrict } = buildEntitySchemas(config);
    expect(listStrict.safeParse({ fields: ['name'] }).success).toBe(true);
    expect(listStrict.safeParse({ fields: ['bogus'] }).success).toBe(false);
  });

  it('select/radio/buttongroup/combobox fields become an enum of their option values', () => {
    for (const type of ['select', 'radio', 'buttongroup', 'combobox'] as const) {
      const config = entity([
        field({ name: 'status', type, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
      ]);
      const { createStrict } = buildEntitySchemas(config);
      expect(createStrict.safeParse({ status: 'a' }).success).toBe(true);
      expect(createStrict.safeParse({ status: 'z' }).success).toBe(false);
    }
  });

  it('doublerange requires exactly two numbers', () => {
    const config = entity([field({ name: 'span', type: 'doublerange' })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ span: [1, 10] }).success).toBe(true);
    expect(createStrict.safeParse({ span: [1] }).success).toBe(false);
    expect(createStrict.safeParse({ span: [1, 2, 3] }).success).toBe(false);
  });

  it('number field enforces min/max from the field config', () => {
    const config = entity([field({ name: 'qty', type: 'number', min: 1, max: 5 })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ qty: 3 }).success).toBe(true);
    expect(createStrict.safeParse({ qty: 0 }).success).toBe(false);
    expect(createStrict.safeParse({ qty: 6 }).success).toBe(false);
  });

  it('dateFields collects only type "date" (not "datetime") field names', () => {
    const config = entity([
      field({ name: 'dueDate', type: 'date' }),
      field({ name: 'dueAt', type: 'datetime' }),
    ]);
    const { dateFields } = buildEntitySchemas(config);
    expect(dateFields).toEqual(['dueDate']);
  });

  it('an override description overrides the default field description', () => {
    const config = entity([field({ name: 'name', type: 'text' })]);
    const { createShape } = buildEntitySchemas(config, {
      override: { describe: { fields: { name: 'Custom label' } } },
    });
    expect(createShape.name.description).toBe('Custom label');
  });

  it('a select field with an empty options array falls back to a bare string schema', () => {
    const config = entity([field({ name: 'status', type: 'select', options: [] })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ status: 'anything' }).success).toBe(true);
  });

  it('a select field with options entirely omitted (undefined) also falls back to a bare string schema', () => {
    const config = entity([field({ name: 'status', type: 'select' })]); // no `options` key at all
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ status: 'anything' }).success).toBe(true);
  });

  it('text field enforces maxLength when the field config sets it', () => {
    const config = entity([field({ name: 'nickname', type: 'text', maxLength: 5 })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ nickname: 'short' }).success).toBe(true);
    expect(createStrict.safeParse({ nickname: 'way too long' }).success).toBe(false);
  });

  it('media-library fields are excluded from list filters too, not just create/update', () => {
    const config = entity([
      field({ name: 'name', type: 'text' }),
      field({ name: 'avatar', type: 'media-library' }),
    ]);
    const { listStrict } = buildEntitySchemas(config);
    expect(listStrict.safeParse({ filters: { avatar: 'x' } }).success).toBe(false);
  });

  it('a type excluded from input (e.g. "file") but not from FILTER_EXCLUDED_TYPES is still excluded from filters via the input-exclusion check', () => {
    const config = entity([
      field({ name: 'name', type: 'text' }),
      field({ name: 'attachment', type: 'file' }),
    ]);
    const { listStrict } = buildEntitySchemas(config);
    expect(listStrict.safeParse({ filters: { attachment: 'x' } }).success).toBe(false);
  });

  it('a select option whose label equals its value is rendered bare, without a "value=label" pair', () => {
    const config = entity([
      field({ name: 'status', type: 'select', options: [{ value: 'active', label: 'active' }] }),
    ]);
    const { createShape } = buildEntitySchemas(config);
    expect(createShape.status.description).toContain('active');
    expect(createShape.status.description).not.toContain('active=active');
  });

  it('shortens an override description longer than 60 chars when used compactly (filters), but not in create/update', () => {
    const longDescription = 'A'.repeat(80);
    const config = entity([field({ name: 'name', type: 'text' })]);
    const { listShape, createShape } = buildEntitySchemas(config, {
      override: { describe: { fields: { name: longDescription } } },
    });
    expect(createShape.name.description).toBe(longDescription); // non-compact: full text

    type ZodOptionalLike = { unwrap?: () => { shape: Record<string, { description?: string }> } };
    const filtersField = (listShape.filters as unknown) as ZodOptionalLike;
    const inner = filtersField.unwrap!();
    expect(inner.shape.name.description).toHaveLength(60);
    expect(inner.shape.name.description).toBe(`${'A'.repeat(57)}...`);
  });

  it('multiselect and tags fields become an array of strings', () => {
    for (const type of ['multiselect', 'tags'] as const) {
      const config = entity([field({ name: 'labels', type })]);
      const { createStrict } = buildEntitySchemas(config);
      expect(createStrict.safeParse({ labels: ['a', 'b'] }).success).toBe(true);
      expect(createStrict.safeParse({ labels: 'a' }).success).toBe(false);
    }
  });

  it('boolean fields require an actual boolean, not a string', () => {
    const config = entity([field({ name: 'active', type: 'boolean' })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ active: true }).success).toBe(true);
    expect(createStrict.safeParse({ active: 'true' }).success).toBe(false);
  });

  it('relation/relation-prop/reference/user fields require a non-empty string uuid', () => {
    for (const type of ['relation', 'relation-prop', 'reference', 'user'] as const) {
      const config = entity([field({ name: 'ownerId', type })]);
      const { createStrict } = buildEntitySchemas(config);
      expect(createStrict.safeParse({ ownerId: 'uuid-1' }).success).toBe(true);
      expect(createStrict.safeParse({ ownerId: '' }).success).toBe(false);
    }
  });

  it('relation-multi/relation-prop-multi fields become an array of strings', () => {
    for (const type of ['relation-multi', 'relation-prop-multi'] as const) {
      const config = entity([field({ name: 'tagIds', type })]);
      const { createStrict } = buildEntitySchemas(config);
      expect(createStrict.safeParse({ tagIds: ['a', 'b'] }).success).toBe(true);
      expect(createStrict.safeParse({ tagIds: 'a' }).success).toBe(false);
    }
  });

  it('json and address fields accept an arbitrary record', () => {
    for (const type of ['json', 'address'] as const) {
      const config = entity([field({ name: 'meta', type })]);
      const { createStrict } = buildEntitySchemas(config);
      expect(createStrict.safeParse({ meta: { street: 'Main St' } }).success).toBe(true);
      expect(createStrict.safeParse({ meta: 'not-a-record' }).success).toBe(false);
    }
  });

  it('an unmapped field type falls back to a permissive z.unknown() schema and warns once', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = entity([field({ name: 'weird', type: 'totally-unknown-type' as never })]);
    const { createStrict } = buildEntitySchemas(config);
    expect(createStrict.safeParse({ weird: { anything: true } }).success).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unmapped field type'));
    warnSpy.mockRestore();
  });

  it('describeField appends the field display description when it differs from the label', () => {
    const config = entity([
      field({
        name: 'name',
        type: 'text',
        display: { label: 'Name', description: 'The customer legal name', showInList: true, showInDetail: true, showInForm: true, order: 0 },
      }),
    ]);
    const { createShape } = buildEntitySchemas(config);
    expect(createShape.name.description).toContain('The customer legal name');
  });

  it('describeField adds relation/user/date/datetime/boolean-specific guidance', () => {
    const config = entity([
      field({ name: 'ownerId', type: 'relation', relation: { entity: 'users', titleField: 'name' } }),
      field({ name: 'assignedTo', type: 'user' }),
      field({ name: 'dueDate', type: 'date' }),
      field({ name: 'dueAt', type: 'datetime' }),
      field({ name: 'active', type: 'boolean' }),
    ]);
    const { createShape } = buildEntitySchemas(config);
    expect(createShape.ownerId.description).toContain('uuid de users');
    expect(createShape.assignedTo.description).toContain('uuid de un miembro del team');
    expect(createShape.dueDate.description).toContain('YYYY-MM-DD');
    expect(createShape.dueAt.description).toContain('ISO 8601');
    expect(createShape.active.description).toContain('booleano');
  });

  it('filterable: false excludes a field from filters but not from create/update', () => {
    const config = entity([
      field({ name: 'secret', type: 'text', api: { searchable: false, sortable: false, filterable: false, readOnly: false } }),
    ]);
    const { listShape, createShape } = buildEntitySchemas(config);
    const filters = listShape.filters as unknown as { shape: Record<string, unknown> } | undefined;
    expect(filters).toBeUndefined();
    expect(createShape.secret).toBeDefined();
  });
});
