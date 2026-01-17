/**
 * Patterns Entity Fields Configuration
 *
 * Defines all business fields for the patterns entity.
 * System fields (id, createdAt, updatedAt, userId, teamId) are implicit
 * and must NOT be declared here.
 *
 * Reference: core/lib/entities/system-fields.ts
 */

import type { EntityField } from '../../lib/entities/types'

export const patternsFields: EntityField[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'Pattern display name',
      placeholder: 'Enter pattern name...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 8
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: true
    }
  },
  {
    name: 'slug',
    type: 'text',
    required: true,
    display: {
      label: 'Slug',
      description: 'URL-friendly identifier, unique per team',
      placeholder: 'pattern-slug',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 4
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: true
    }
  },
  {
    name: 'status',
    type: 'select',
    required: false,
    defaultValue: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' }
    ],
    display: {
      label: 'Status',
      description: 'Publication status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 4
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
      filterable: true
    }
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'Brief description of pattern purpose',
      placeholder: 'Describe this pattern...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 12
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false
    }
  }
  // NOTE: The 'blocks' field is managed by the builder view
  // It is not declared here as it's a system field for builder-enabled entities
  // System fields (id, createdAt, updatedAt, userId, teamId) are also implicit
  // Reference: core/lib/entities/system-fields.ts
]
