/**
 * Posts Entity Fields Configuration
 * 
 * Complete fields for a blog post including SEO and categorization.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const postFields: EntityField[] = [
  // ==========================================
  // MAIN CONTENT
  // ==========================================
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'The title of your blog post',
      placeholder: 'Enter a compelling title...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12,
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
      description: 'URL-friendly version of the title (auto-generated)',
      placeholder: 'my-blog-post',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: false,
    },
  },
  {
    name: 'excerpt',
    type: 'textarea',
    required: false,
    display: {
      label: 'Excerpt',
      description: 'A short summary shown in post listings',
      placeholder: 'Write a brief summary of your post...',
      showInList: true,
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
  {
    name: 'content',
    type: 'richtext',
    required: true,
    display: {
      label: 'Content',
      description: 'The main content of your blog post',
      placeholder: 'Start writing your post...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false,
    },
  },

  // ==========================================
  // MEDIA
  // ==========================================
  {
    name: 'featuredImage',
    type: 'image',
    required: false,
    display: {
      label: 'Featured Image',
      description: 'Main image displayed with the post',
      placeholder: 'Upload an image...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: false,
    },
  },


  // ==========================================
  // FEATURING
  // ==========================================
  {
    name: 'featured',
    type: 'boolean',
    required: false,
    defaultValue: false,
    display: {
      label: 'Featured',
      description: 'Show this post in the featured section on the homepage',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },

  // ==========================================
  // PUBLISHING
  // ==========================================
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'scheduled', label: 'Scheduled' },
    ],
    display: {
      label: 'Status',
      description: 'Publication status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 8,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'publishedAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Publish Date',
      description: 'When the post was/will be published',
      placeholder: 'Select date...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 9,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
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
      description: 'When the post was created',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 98,
      columnWidth: 4,
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
      description: 'When the post was last modified',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 99,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
]

