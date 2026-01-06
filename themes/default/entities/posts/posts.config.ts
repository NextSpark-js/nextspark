/**
 * Posts Entity Configuration
 *
 * Posts are builder-enabled entities with taxonomies support that render at /blog/[slug].
 * Includes sidebar fields for excerpt and featured image, plus category management.
 */

import { Newspaper } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { postsFields } from './posts.fields'

export const postsEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'posts',
  enabled: true,

  names: {
    singular: 'post',
    plural: 'Posts',
  },

  icon: Newspaper,
  tableName: 'posts',

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: true,      // Blog posts are public
    api: true,         // Has external API endpoints
    metadata: true,    // Posts support metadata
    shared: true,      // All authenticated users can see all posts
    basePath: '/blog', // Posts render at /blog/[slug]
  },

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
      filters: [
        { field: 'status', type: 'multiSelect' },
      ],
    },
    public: {
      hasArchivePage: true,  // /blog shows list of posts
      hasSinglePage: true,   // /blog/[slug] shows individual post
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: true,
    },
  },

  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  // Permissions are now centralized in permissions.config.ts
  // See: contents/themes/default/permissions.config.ts -> entities.posts

  // ==========================================
  // 6. BUILDER CONFIGURATION
  // ==========================================
  builder: {
    enabled: true,
    sidebarFields: ['excerpt', 'featuredImage'], // Extra fields shown in sidebar
    seo: true, // Enable SEO fields panel in editor
  },

  // ==========================================
  // 7. TAXONOMIES CONFIGURATION
  // ==========================================
  taxonomies: {
    enabled: true,
    types: [
      {
        type: 'post_category',
        field: 'categories',
        multiple: true,
        label: 'Categories',
      },
    ],
  },

  // ==========================================
  // FIELDS
  // ==========================================
  fields: postsFields,

  // ==========================================
  // METADATA
  // ==========================================
  source: 'theme',
}
