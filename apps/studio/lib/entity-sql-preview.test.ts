import { generateSqlPreview } from './entity-sql-preview'
import type { EntityDefinition } from '@nextsparkjs/studio'

function makeEntity(overrides: Partial<EntityDefinition> = {}): EntityDefinition {
  return {
    slug: 'products',
    names: { singular: 'Product', plural: 'Products' },
    description: 'Test entity',
    accessMode: 'team',
    fields: [],
    ...overrides,
  }
}

describe('generateSqlPreview', () => {
  it('generates CREATE TABLE with system columns for empty fields', () => {
    const sql = generateSqlPreview(makeEntity())
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."products"')
    expect(sql).toContain('id               TEXT PRIMARY KEY')
    expect(sql).toContain('"userId"')
    expect(sql).toContain('"teamId"')
    expect(sql).toContain('"createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()')
    expect(sql).toContain('"updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()')
  })

  it('maps text field to TEXT', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'title', type: 'text', required: false }],
    }))
    expect(sql).toContain('title')
    expect(sql).toContain('TEXT')
  })

  it('maps textarea and richtext to TEXT', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [
        { name: 'body', type: 'textarea', required: false },
        { name: 'content', type: 'richtext', required: false },
      ],
    }))
    expect(sql).toMatch(/body\s+TEXT/)
    expect(sql).toMatch(/content\s+TEXT/)
  })

  it('maps number to NUMERIC', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'quantity', type: 'number', required: false }],
    }))
    expect(sql).toMatch(/quantity\s+NUMERIC/)
  })

  it('maps currency to NUMERIC(12,2)', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'price', type: 'currency', required: false }],
    }))
    expect(sql).toContain('NUMERIC(12,2)')
  })

  it('maps boolean to BOOLEAN with DEFAULT false', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'active', type: 'boolean', required: false }],
    }))
    expect(sql).toMatch(/active\s+BOOLEAN/)
    expect(sql).toContain('DEFAULT false')
  })

  it('maps datetime to TIMESTAMPTZ and date to DATE', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [
        { name: 'publishedAt', type: 'datetime', required: false },
        { name: 'birthDate', type: 'date', required: false },
      ],
    }))
    expect(sql).toContain('TIMESTAMPTZ')
    expect(sql).toContain('DATE')
  })

  it('maps json to JSONB and address to JSONB', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [
        { name: 'metadata', type: 'json', required: false },
        { name: 'location', type: 'address', required: false },
      ],
    }))
    // Both should produce JSONB
    const jsonbMatches = sql.match(/JSONB/g)
    expect(jsonbMatches!.length).toBeGreaterThanOrEqual(2)
  })

  it('maps rating to INTEGER', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'stars', type: 'rating', required: false }],
    }))
    expect(sql).toMatch(/stars\s+INTEGER/)
  })

  it('maps multiselect and tags to TEXT[]', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [
        { name: 'categories', type: 'multiselect', required: false },
        { name: 'labels', type: 'tags', required: false },
      ],
    }))
    const arrayMatches = sql.match(/TEXT\[\]/g)
    expect(arrayMatches!.length).toBe(2)
  })

  it('adds NOT NULL for required fields', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'title', type: 'text', required: true }],
    }))
    expect(sql).toMatch(/title\s+TEXT NOT NULL/)
  })

  it('generates DEFAULT and CHECK constraint for select fields with options', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{
        name: 'status',
        type: 'select',
        required: false,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'draft', label: 'Draft' },
        ],
      }],
    }))
    expect(sql).toContain("DEFAULT 'active'")
    expect(sql).toContain('CONSTRAINT products_status_check')
    expect(sql).toContain("IN ('active', 'draft')")
  })

  it('generates FK REFERENCES for relation fields', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{
        name: 'clientId',
        type: 'relation',
        required: false,
        relation: { entity: 'clients', titleField: 'name' },
      }],
    }))
    expect(sql).toContain('REFERENCES public."clients"(id) ON DELETE SET NULL')
  })

  it('quotes camelCase field names', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'firstName', type: 'text', required: false }],
    }))
    expect(sql).toContain('"firstName"')
  })

  it('does not quote all-lowercase field names', () => {
    const sql = generateSqlPreview(makeEntity({
      fields: [{ name: 'title', type: 'text', required: false }],
    }))
    // title should appear without quotes (as a column name, not the slug)
    expect(sql).toMatch(/\s{2}title\s/)
  })

  it('covers all 22 field types with valid SQL type strings', () => {
    const allTypes = [
      'text', 'textarea', 'richtext', 'markdown', 'number', 'currency',
      'rating', 'boolean', 'date', 'datetime', 'email', 'url', 'phone',
      'select', 'multiselect', 'tags', 'image', 'file', 'json', 'country',
      'address', 'relation',
    ] as const

    for (const fieldType of allTypes) {
      const sql = generateSqlPreview(makeEntity({
        fields: [{ name: 'field', type: fieldType, required: false }],
      }))
      // Each should produce a valid CREATE TABLE
      expect(sql).toContain('CREATE TABLE')
      // And the column should have some SQL type
      expect(sql).toMatch(/field\s+\w+/)
    }
  })
})
