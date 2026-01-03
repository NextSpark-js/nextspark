/**
 * System Fields Configuration
 *
 * These fields are implicit in ALL entities and should NEVER be declared
 * in entity field configurations. They are:
 * - Always present in database tables
 * - Always returned in API responses
 * - Always available for sorting
 * - Shown in metadata sections of detail views
 * - Never shown in forms (managed by database)
 */

import type { EntityField } from './types'

/**
 * All system field names that are implicit in every entity
 */
export const SYSTEM_FIELD_NAMES = ['id', 'createdAt', 'updatedAt', 'userId', 'teamId'] as const

export type SystemFieldName = (typeof SYSTEM_FIELD_NAMES)[number]

/**
 * Fields that are implicitly available for sorting even if not in config
 */
export const IMPLICIT_SORTABLE_FIELDS = ['createdAt', 'updatedAt'] as const

export type ImplicitSortableField = (typeof IMPLICIT_SORTABLE_FIELDS)[number]

/**
 * Virtual field definitions for createdAt/updatedAt
 * Used by frontend components to render these fields consistently
 */
export const SYSTEM_TIMESTAMP_FIELDS: EntityField[] = [
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When this record was created',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 998,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'updatedAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Updated At',
      description: 'When this record was last modified',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 999,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
]

/**
 * Check if a field name is a system field
 */
export function isSystemField(fieldName: string): boolean {
  return SYSTEM_FIELD_NAMES.includes(fieldName as SystemFieldName)
}

/**
 * Check if a field name is an implicit timestamp field
 */
export function isImplicitTimestampField(fieldName: string): boolean {
  return IMPLICIT_SORTABLE_FIELDS.includes(fieldName as ImplicitSortableField)
}

/**
 * Get system timestamp field definition by name
 * Returns the field definition if found, null otherwise
 */
export function getSystemTimestampField(fieldName: string): EntityField | null {
  return SYSTEM_TIMESTAMP_FIELDS.find(f => f.name === fieldName) || null
}

// ============================================
// BUILDER-SPECIFIC SYSTEM FIELDS (CONDITIONAL)
// ============================================

/**
 * Builder-specific system fields (conditional)
 * These are only valid for entities with builder.enabled = true
 */
export const BUILDER_SYSTEM_FIELD_NAMES = ['blocks'] as const

export type BuilderSystemFieldName = (typeof BUILDER_SYSTEM_FIELD_NAMES)[number]

/**
 * Virtual field definition for blocks (builder entities only)
 * This field is automatically available for entities with builder.enabled = true
 */
export const BUILDER_BLOCKS_FIELD: EntityField = {
  name: 'blocks',
  type: 'json',
  required: false,
  defaultValue: [],
  display: {
    label: 'Blocks',
    description: 'Content blocks (managed by builder)',
    showInList: false,
    showInDetail: false,
    showInForm: false,
    order: 100,
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false,
  },
}

/**
 * Check if a field is a builder-specific system field
 */
export function isBuilderSystemField(fieldName: string): boolean {
  return BUILDER_SYSTEM_FIELD_NAMES.includes(fieldName as BuilderSystemFieldName)
}
