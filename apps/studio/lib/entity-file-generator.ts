/**
 * Entity File Generator
 *
 * Generates all entity files from EntityDefinition:
 * - {slug}.config.ts
 * - {slug}.fields.ts
 * - migrations/001_{slug}_table.sql
 * - messages/en.json
 *
 * Templates match the patterns from chat-system-prompt.ts.
 */

import type { EntityDefinition, EntityFieldDefinition, EntityFieldType } from '@nextsparkjs/studio'

// ── Helpers ──

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function camelToTitle(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

function pickIcon(slug: string): string {
  const map: Record<string, string> = {
    users: 'Users', clients: 'Users', customers: 'Users', members: 'Users', employees: 'Users',
    products: 'Package', items: 'Package', inventory: 'Warehouse',
    orders: 'ShoppingCart', invoices: 'Receipt', payments: 'CreditCard',
    projects: 'FolderOpen', tasks: 'CheckSquare', tickets: 'Ticket',
    posts: 'FileText', articles: 'FileText', blogs: 'BookOpen',
    services: 'Wrench', appointments: 'Calendar', bookings: 'CalendarCheck',
    properties: 'Building2', leads: 'Target', contacts: 'Contact',
    categories: 'Tag', departments: 'Building', locations: 'MapPin',
    expenses: 'Wallet', budgets: 'PiggyBank', suppliers: 'Truck',
  }
  return map[slug] || 'CircleDot'
}

// ── Config Generator ──

export function generateEntityConfig(entity: EntityDefinition): string {
  const { slug, names, description, accessMode, features } = entity
  const icon = pickIcon(slug)
  const varName = slug.replace(/-/g, '_')
  const isShared = accessMode === 'shared' || accessMode === 'team'
  const isPublic = accessMode === 'public'

  return `import { ${icon} } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { ${varName}Fields } from './${slug}.fields'

export const ${varName}EntityConfig: EntityConfig = {
  slug: '${slug}',
  enabled: true,
  names: {
    singular: '${names.singular}',
    plural: '${names.plural}',
  },
  description: '${description.replace(/'/g, "\\'")}',
  icon: ${icon},

  access: {
    public: ${isPublic},
    api: true,
    metadata: true,
    shared: ${isShared},
  },

  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
    },
    public: {
      hasArchivePage: ${isPublic},
      hasSinglePage: ${isPublic},
    },
    features: {
      searchable: ${features?.searchable ?? true},
      sortable: ${features?.sortable ?? true},
      filterable: ${features?.filterable ?? true},
      bulkOperations: ${features?.bulkOperations ?? true},
      importExport: ${features?.importExport ?? false},
    },
  },

  fields: ${varName}Fields,
}
`
}

// ── Fields Generator ──

function fieldToTs(field: EntityFieldDefinition, index: number): string {
  const label = camelToTitle(field.name)
  const lines: string[] = []
  lines.push(`  {`)
  lines.push(`    name: '${field.name}',`)
  lines.push(`    type: '${field.type}',`)
  lines.push(`    required: ${field.required},`)

  if (field.type === 'select' && field.options && field.options.length > 0) {
    lines.push(`    defaultValue: '${field.options[0].value}',`)
    lines.push(`    options: [`)
    for (const opt of field.options) {
      lines.push(`      { value: '${opt.value}', label: '${opt.label}' },`)
    }
    lines.push(`    ],`)
  }

  if (field.type === 'relation' && field.relation) {
    lines.push(`    relation: {`)
    lines.push(`      entity: '${field.relation.entity}',`)
    if (field.relation.titleField) {
      lines.push(`      titleField: '${field.relation.titleField}',`)
    }
    lines.push(`    },`)
  }

  lines.push(`    display: {`)
  lines.push(`      label: '${label}',`)
  if (field.description) {
    lines.push(`      description: '${field.description.replace(/'/g, "\\'")}',`)
  }
  lines.push(`      placeholder: 'Enter ${label.toLowerCase()}...',`)
  lines.push(`      showInList: ${index < 5},`)
  lines.push(`      showInDetail: true,`)
  lines.push(`      showInForm: true,`)
  lines.push(`      order: ${index + 1},`)
  lines.push(`      columnWidth: 12,`)
  lines.push(`    },`)
  lines.push(`    api: {`)
  lines.push(`      readOnly: false,`)
  lines.push(`      searchable: ${field.type === 'text' || field.type === 'textarea' || field.type === 'email'},`)
  lines.push(`      sortable: ${field.type !== 'json' && field.type !== 'address'},`)
  lines.push(`    },`)
  lines.push(`  }`)

  return lines.join('\n')
}

export function generateEntityFields(entity: EntityDefinition): string {
  const varName = entity.slug.replace(/-/g, '_')
  const fields = entity.fields.map((f, i) => fieldToTs(f, i)).join(',\n')

  return `import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const ${varName}Fields: EntityField[] = [
${fields},
]
`
}

// ── SQL Migration Generator ──

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

function col(name: string): string {
  return /[A-Z]/.test(name) ? `"${name}"` : name
}

export function generateMigrationSql(entity: EntityDefinition): string {
  const { slug, names, fields } = entity
  const lines: string[] = []

  lines.push(`-- Migration: 001_${slug}_table.sql`)
  lines.push(`-- Description: ${names.plural} (table, indexes, RLS)`)
  lines.push(``)
  lines.push(`-- TABLE`)
  lines.push(`DROP TABLE IF EXISTS public."${slug}" CASCADE;`)
  lines.push(``)
  lines.push(`CREATE TABLE IF NOT EXISTS public."${slug}" (`)
  lines.push(`  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,`)
  lines.push(`  "userId"     TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,`)
  lines.push(`  "teamId"     TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,`)
  lines.push(``)

  for (const field of fields) {
    const sqlType = SQL_TYPE_MAP[field.type] || 'TEXT'
    const notNull = field.required ? ' NOT NULL' : ''
    let defaultVal = ''

    if (field.type === 'select' && field.options && field.options.length > 0) {
      defaultVal = ` DEFAULT '${field.options[0].value}'`
    } else if (field.type === 'boolean') {
      defaultVal = ' DEFAULT false'
    }

    let fk = ''
    if (field.type === 'relation' && field.relation?.entity) {
      fk = ` REFERENCES public."${field.relation.entity}"(id) ON DELETE SET NULL`
    }

    lines.push(`  ${col(field.name).padEnd(16)} ${sqlType}${notNull}${defaultVal}${fk},`)
  }

  lines.push(``)
  lines.push(`  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),`)
  lines.push(`  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()`)

  // Check constraints for select fields
  const selectFields = fields.filter(f => f.type === 'select' && f.options && f.options.length > 0)
  if (selectFields.length > 0) {
    // Need to add comma to updatedAt line
    const lastLine = lines[lines.length - 1]
    lines[lines.length - 1] = lastLine + ','
    lines.push(``)
    for (let i = 0; i < selectFields.length; i++) {
      const f = selectFields[i]
      const values = f.options!.map(o => `'${o.value}'`).join(', ')
      const comma = i < selectFields.length - 1 ? ',' : ''
      lines.push(`  CONSTRAINT ${slug}_${f.name}_check CHECK (${col(f.name)} IN (${values}))${comma}`)
    }
  }

  lines.push(`);`)
  lines.push(``)

  // Trigger
  lines.push(`-- TRIGGER updatedAt`)
  lines.push(`DROP TRIGGER IF EXISTS ${slug}_set_updated_at ON public."${slug}";`)
  lines.push(`CREATE TRIGGER ${slug}_set_updated_at`)
  lines.push(`BEFORE UPDATE ON public."${slug}"`)
  lines.push(`FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();`)
  lines.push(``)

  // Indexes
  lines.push(`-- INDEXES`)
  lines.push(`CREATE INDEX IF NOT EXISTS idx_${slug}_user_id    ON public."${slug}"("userId");`)
  lines.push(`CREATE INDEX IF NOT EXISTS idx_${slug}_team_id    ON public."${slug}"("teamId");`)
  lines.push(`CREATE INDEX IF NOT EXISTS idx_${slug}_user_team  ON public."${slug}"("userId", "teamId");`)
  lines.push(`CREATE INDEX IF NOT EXISTS idx_${slug}_created_at ON public."${slug}"("userId", "createdAt");`)

  // Index for select fields
  for (const field of selectFields) {
    lines.push(`CREATE INDEX IF NOT EXISTS idx_${slug}_${field.name}     ON public."${slug}"(${col(field.name)});`)
  }

  lines.push(``)

  // RLS
  lines.push(`-- RLS`)
  lines.push(`ALTER TABLE public."${slug}" ENABLE ROW LEVEL SECURITY;`)
  lines.push(``)
  lines.push(`DROP POLICY IF EXISTS "${slug}_team_policy" ON public."${slug}";`)
  lines.push(``)
  lines.push(`CREATE POLICY "${slug}_team_policy"`)
  lines.push(`ON public."${slug}"`)
  lines.push(`FOR ALL TO authenticated`)
  lines.push(`USING (`)
  lines.push(`  public.is_superadmin()`)
  lines.push(`  OR "teamId" = ANY(public.get_user_team_ids())`)
  lines.push(`)`)
  lines.push(`WITH CHECK (`)
  lines.push(`  public.is_superadmin()`)
  lines.push(`  OR "teamId" = ANY(public.get_user_team_ids())`)
  lines.push(`);`)

  return lines.join('\n')
}

// ── Messages Generator ──

export function generateMessages(entity: EntityDefinition, locale: string = 'en'): string {
  const { names, fields } = entity

  const fieldMessages: Record<string, { label: string; placeholder: string; description: string }> = {}
  for (const field of fields) {
    const label = camelToTitle(field.name)
    fieldMessages[field.name] = {
      label,
      placeholder: `Enter ${label.toLowerCase()}...`,
      description: field.description || label,
    }
  }

  // Collect status values from select fields named 'status'
  const statusField = fields.find(f => f.name === 'status' && f.type === 'select')
  const statusMessages: Record<string, string> = {}
  if (statusField?.options) {
    for (const opt of statusField.options) {
      statusMessages[opt.value] = capitalize(opt.label)
    }
  }

  const messages: Record<string, unknown> = {
    entity: {
      name: names.singular,
      namePlural: names.plural,
      description: `Manage your ${names.plural.toLowerCase()}`,
    },
    title: `My ${names.plural}`,
    subtitle: `Manage and organize your ${names.plural.toLowerCase()}.`,
    fields: fieldMessages,
    ...(Object.keys(statusMessages).length > 0 ? { status: statusMessages } : {}),
    actions: {
      create: `Create ${names.singular}`,
      edit: `Edit ${names.singular}`,
      delete: `Delete ${names.singular}`,
    },
    messages: {
      created: `${names.singular} created successfully`,
      updated: `${names.singular} updated successfully`,
      deleted: `${names.singular} deleted successfully`,
      confirmDelete: `Are you sure you want to delete this ${names.singular.toLowerCase()}?`,
      noItems: `No ${names.plural.toLowerCase()} found`,
      createFirst: `Create your first ${names.singular.toLowerCase()} to get started`,
    },
    list: {
      title: `${names.plural} List`,
      description: `Manage all your ${names.plural.toLowerCase()} in one place`,
    },
  }

  return JSON.stringify(messages, null, 2)
}
