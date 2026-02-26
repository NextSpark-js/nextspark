import {
  generateEntityConfig,
  generateEntityFields,
  generateMigrationSql,
  generateMessages,
} from './entity-file-generator'
import type { EntityDefinition } from '@nextsparkjs/studio'

const sampleEntity: EntityDefinition = {
  slug: 'products',
  names: { singular: 'Product', plural: 'Products' },
  description: 'Manage products in the catalog',
  accessMode: 'team',
  fields: [
    { name: 'title', type: 'text', required: true, description: 'Product title' },
    { name: 'price', type: 'currency', required: true },
    { name: 'description', type: 'textarea', required: false },
    {
      name: 'status',
      type: 'select',
      required: false,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
      ],
    },
    { name: 'inStock', type: 'boolean', required: false },
  ],
  features: { searchable: true, sortable: true, filterable: true, bulkOperations: true },
}

const relationEntity: EntityDefinition = {
  slug: 'invoices',
  names: { singular: 'Invoice', plural: 'Invoices' },
  description: 'Invoice management',
  accessMode: 'private',
  fields: [
    { name: 'number', type: 'text', required: true },
    { name: 'amount', type: 'currency', required: true },
    {
      name: 'clientId',
      type: 'relation',
      required: true,
      relation: { entity: 'clients', titleField: 'name' },
    },
  ],
}

describe('generateEntityConfig', () => {
  test('generates valid TypeScript config', () => {
    const output = generateEntityConfig(sampleEntity)
    expect(output).toContain("slug: 'products'")
    expect(output).toContain("singular: 'Product'")
    expect(output).toContain("plural: 'Products'")
    expect(output).toContain('shared: true')
    expect(output).toContain('import type { EntityConfig }')
    expect(output).toContain('productsFields')
  })

  test('sets shared:false for private entities', () => {
    const output = generateEntityConfig(relationEntity)
    expect(output).toContain('shared: false')
    expect(output).toContain('public: false')
  })

  test('sets public:true for public entities', () => {
    const publicEntity = { ...sampleEntity, accessMode: 'public' as const }
    const output = generateEntityConfig(publicEntity)
    expect(output).toContain('public: true')
    expect(output).toContain('hasArchivePage: true')
  })
})

describe('generateEntityFields', () => {
  test('generates valid fields array', () => {
    const output = generateEntityFields(sampleEntity)
    expect(output).toContain("name: 'title'")
    expect(output).toContain("type: 'text'")
    expect(output).toContain('required: true')
    expect(output).toContain("name: 'price'")
    expect(output).toContain("type: 'currency'")
  })

  test('includes select options', () => {
    const output = generateEntityFields(sampleEntity)
    expect(output).toContain("value: 'active'")
    expect(output).toContain("label: 'Draft'")
    expect(output).toContain("defaultValue: 'active'")
  })

  test('includes relation config', () => {
    const output = generateEntityFields(relationEntity)
    expect(output).toContain("entity: 'clients'")
    expect(output).toContain("titleField: 'name'")
  })

  test('generates display properties', () => {
    const output = generateEntityFields(sampleEntity)
    expect(output).toContain("label: 'Title'")
    expect(output).toContain('showInList:')
    expect(output).toContain('showInForm: true')
    expect(output).toContain('order: 1')
  })
})

describe('generateMigrationSql', () => {
  test('generates CREATE TABLE statement', () => {
    const sql = generateMigrationSql(sampleEntity)
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."products"')
    expect(sql).toContain('"userId"')
    expect(sql).toContain('"teamId"')
    expect(sql).toContain('"createdAt"')
    expect(sql).toContain('"updatedAt"')
  })

  test('maps field types to SQL', () => {
    const sql = generateMigrationSql(sampleEntity)
    expect(sql).toContain('title            TEXT NOT NULL')
    expect(sql).toContain('price            NUMERIC(12,2) NOT NULL')
    expect(sql).toContain('description      TEXT')
    expect(sql).toContain('"inStock"')
    expect(sql).toContain('BOOLEAN')
  })

  test('generates CHECK constraint for select fields', () => {
    const sql = generateMigrationSql(sampleEntity)
    expect(sql).toContain('CONSTRAINT products_status_check')
    expect(sql).toContain("IN ('active', 'draft', 'archived')")
  })

  test('generates FK for relation fields', () => {
    const sql = generateMigrationSql(relationEntity)
    expect(sql).toContain('REFERENCES public."clients"(id)')
  })

  test('generates RLS policy', () => {
    const sql = generateMigrationSql(sampleEntity)
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('CREATE POLICY "products_team_policy"')
    expect(sql).toContain('is_superadmin()')
    expect(sql).toContain('get_user_team_ids()')
  })

  test('generates trigger and indexes', () => {
    const sql = generateMigrationSql(sampleEntity)
    expect(sql).toContain('CREATE TRIGGER products_set_updated_at')
    expect(sql).toContain('idx_products_user_id')
    expect(sql).toContain('idx_products_team_id')
  })
})

describe('generateMessages', () => {
  test('generates valid JSON', () => {
    const json = generateMessages(sampleEntity)
    const parsed = JSON.parse(json)
    expect(parsed.entity.name).toBe('Product')
    expect(parsed.entity.namePlural).toBe('Products')
    expect(parsed.title).toBe('My Products')
  })

  test('generates field messages', () => {
    const json = generateMessages(sampleEntity)
    const parsed = JSON.parse(json)
    expect(parsed.fields.title.label).toBe('Title')
    expect(parsed.fields.price.label).toBe('Price')
    expect(parsed.fields.description).toBeDefined()
  })

  test('generates status messages for select fields named status', () => {
    const json = generateMessages(sampleEntity)
    const parsed = JSON.parse(json)
    expect(parsed.status.active).toBe('Active')
    expect(parsed.status.draft).toBe('Draft')
  })

  test('generates action messages', () => {
    const json = generateMessages(sampleEntity)
    const parsed = JSON.parse(json)
    expect(parsed.actions.create).toBe('Create Product')
    expect(parsed.actions.edit).toBe('Edit Product')
  })

  test('omits status section when no status select field', () => {
    const json = generateMessages(relationEntity)
    const parsed = JSON.parse(json)
    expect(parsed.status).toBeUndefined()
  })
})
