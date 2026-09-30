/**
 * The part of an entity configuration the schema generator and the response shape read.
 *
 * PORTABLE: no imports. These interfaces are structural subsets of core's own EntityConfig /
 * EntityField / ChildEntityDefinition (lib/entities/types.ts), so a real EntityConfig is assignable
 * to them, and the generated contracts (which have no access to core's types) describe an entity
 * with the same shape.
 */

export interface FieldOption {
  value: string | number
  label?: string
}

export interface FieldDisplay {
  label: string
  description?: string
  showInList?: boolean
  showInDetail?: boolean
  showInForm?: boolean
  order?: number
}

export interface FieldAPI {
  readOnly?: boolean
  searchable?: boolean
  sortable?: boolean
}

export interface EntityField {
  name: string
  type: string
  required: boolean
  defaultValue?: unknown
  min?: number
  max?: number
  maxLength?: number
  display: FieldDisplay
  api: FieldAPI
  options?: FieldOption[]
}

export interface ChildEntityField {
  name: string
  type: string
  required: boolean
  defaultValue?: unknown
  options?: FieldOption[]
  display?: FieldDisplay
}

export interface ChildEntityDefinition {
  table: string
  fields: ChildEntityField[]
}

export interface TaxonomyTypeConfig {
  type: string
  field: string
}

export interface EntityConfig {
  slug: string
  names: { singular: string; plural?: string }
  fields: EntityField[]
  childEntities?: Record<string, ChildEntityDefinition>
  builder?: { enabled?: boolean; public?: { basePath?: string }; sidebarFields?: string[] }
  table?: { softDelete?: boolean }
  taxonomies?: { enabled?: boolean; types: TaxonomyTypeConfig[] }
  access?: { basePath?: string; shared?: boolean }
}
