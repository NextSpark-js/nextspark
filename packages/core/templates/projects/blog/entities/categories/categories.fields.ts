/**
 * Categories Entity Fields Configuration
 *
 * Field definitions for blog categories.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const categoryFields: EntityField[] = [
  // ==========================================
  // BASIC INFORMATION
  // ==========================================
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Name',
      description: 'The name of the category',
      placeholder: 'Enter category name...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 6,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: true,
    },
  },
  {
    name: 'slug',
    type: 'text',
    required: true,
    display: {
      label: 'Slug',
      description: 'URL-friendly version of the name (auto-generated)',
      placeholder: 'category-slug',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 6,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'A brief description of this category',
      placeholder: 'Describe what this category is about...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false,
    },
  },

  // ==========================================
  // TIMESTAMPS
  // ==========================================
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When the category was created',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 98,
      columnWidth: 6,
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
      description: 'When the category was last modified',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 99,
      columnWidth: 6,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
]
