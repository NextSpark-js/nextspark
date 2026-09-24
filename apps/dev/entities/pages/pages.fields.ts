/**
 * Pages Entity Fields Configuration
 *
 * Fields required for builder-enabled pages.
 * Note: 'blocks' field is NOT in fields[] - it's managed by the builder view automatically.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const pagesFields: EntityField[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'Page title',
      placeholder: 'Enter page title...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'slug',
    type: 'text',
    required: true,
    display: {
      label: 'Slug',
      description: 'URL-friendly identifier',
      placeholder: 'page-slug',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 2,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'archived', label: 'Archived' },
    ],
    display: {
      label: 'Status',
      description: 'Publication status',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
    },
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false,
    },
  },
  {
    name: 'locale',
    type: 'select',
    required: true,
    defaultValue: 'en',
    options: [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
    ],
    display: {
      label: 'Locale',
      description: 'Page language',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false,
    },
  },
  // Note: SEO fields (seoTitle, seoDescription, etc.) are managed by the builder SEO panel
  // Note: 'blocks' field is a system field for builder-enabled entities - NOT defined here
]
