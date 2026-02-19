/**
 * Entity SQL Preview
 *
 * Client-safe SQL migration preview from EntityDefinition.
 * No Node.js dependencies — runs in the browser.
 */

import type { EntityDefinition, EntityFieldDefinition, EntityFieldType } from '@nextsparkjs/studio'

const SQL_TYPE_MAP: Record<EntityFieldType, string> = {
  text: 'TEXT',
  textarea: 'TEXT',
  richtext: 'TEXT',
  markdown: 'TEXT',
  number: 'NUMERIC',
  currency: 'NUMERIC(12,2)',
  rating: 'INTEGER',
  boolean: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  email: 'TEXT',
  url: 'TEXT',
  phone: 'TEXT',
  select: 'TEXT',
  multiselect: 'TEXT[]',
  tags: 'TEXT[]',
  image: 'TEXT',
  file: 'TEXT',
  json: 'JSONB',
  country: 'TEXT',
  address: 'JSONB',
  relation: 'TEXT',
}

function needsQuotes(name: string): boolean {
  return /[A-Z]/.test(name)
}

function col(name: string): string {
  return needsQuotes(name) ? `"${name}"` : name
}

function fieldToColumn(field: EntityFieldDefinition): string {
  const sqlType = SQL_TYPE_MAP[field.type] || 'TEXT'
  const notNull = field.required ? ' NOT NULL' : ''

  // Default values for select fields
  let defaultVal = ''
  if (field.type === 'select' && field.options && field.options.length > 0) {
    defaultVal = ` DEFAULT '${field.options[0].value}'`
  } else if (field.type === 'boolean') {
    defaultVal = ' DEFAULT false'
  }

  // FK reference for relations
  let fk = ''
  if (field.type === 'relation' && field.relation?.entity) {
    fk = ` REFERENCES public."${field.relation.entity}"(id) ON DELETE SET NULL`
  }

  return `  ${col(field.name).padEnd(16)} ${sqlType}${notNull}${defaultVal}${fk}`
}

/**
 * Generate a SQL migration preview string for an entity.
 */
export function generateSqlPreview(entity: EntityDefinition): string {
  const { slug, fields } = entity

  const columns = fields.map(fieldToColumn)

  // Check constraints for select fields
  const constraints: string[] = []
  for (const field of fields) {
    if (field.type === 'select' && field.options && field.options.length > 0) {
      const values = field.options.map(o => `'${o.value}'`).join(', ')
      constraints.push(`  CONSTRAINT ${slug}_${field.name}_check CHECK (${col(field.name)} IN (${values}))`)
    }
  }

  const allCols = [
    '  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text',
    '  "userId"         TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE',
    '  "teamId"         TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE',
    '',
    ...columns,
    '',
    '  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()',
    '  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()',
    ...constraints.length > 0 ? ['', ...constraints] : [],
  ]

  return `CREATE TABLE IF NOT EXISTS public."${slug}" (\n${allCols.join(',\n')}\n);`
}
