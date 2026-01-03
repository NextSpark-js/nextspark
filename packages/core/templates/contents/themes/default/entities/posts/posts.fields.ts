/**
 * Posts Entity Fields Configuration
 *
 * Fields required for builder-enabled posts with sidebar support.
 * Note: 'blocks' field is NOT in fields[] - it's managed by the builder view automatically.
 * Note: 'categories' is managed by taxonomies system, not a regular field.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const postsFields: EntityField[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'Post title',
      placeholder: 'Enter post title...',
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
      placeholder: 'post-slug',
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
    name: 'excerpt',
    type: 'textarea',
    required: false,
    display: {
      label: 'Excerpt',
      description: 'Short summary of the post',
      placeholder: 'Brief description...',
      showInList: false,
      showInDetail: true,
      showInForm: true, // Shown in builder sidebar
      order: 4,
    },
    api: {
      searchable: true,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'featuredImage',
    type: 'image',
    required: false,
    display: {
      label: 'Featured Image',
      description: 'Main image for the post',
      showInList: false,
      showInDetail: true,
      showInForm: true, // Shown in builder sidebar
      order: 5,
    },
    api: {
      searchable: false,
      sortable: false,
      readOnly: false,
    },
  },
  // Note: 'categories' is managed by taxonomies system, not a regular field
  // Note: SEO fields (seoTitle, seoDescription, etc.) are managed by the builder SEO panel
  // Note: 'blocks' field is a system field for builder-enabled entities - NOT defined here
]
