/**
 * Pages Entity Configuration
 *
 * Pages are builder-enabled entities that render at root URLs (e.g., /about, /contact).
 * This configuration enables the WordPress-like page builder experience for content creation.
 */

import { FileText } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { pagesFields } from './pages.fields'

export const pagesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'pages',
  enabled: true,

  names: {
    singular: 'page',
    plural: 'Pages',
  },

  icon: FileText,
  tableName: 'pages',

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: true,    // Pages are public content
    api: true,       // Has external API endpoints
    metadata: false, // Pages don't use metadata system
    shared: true,    // All authenticated users can see all pages
    basePath: '/',   // Pages render at root: /about, /contact, etc.
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
      hasArchivePage: false, // Pages don't have an archive page
      hasSinglePage: true,   // Individual pages render at /[slug]
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false,
    },
  },

  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  // Permissions are now centralized in permissions.config.ts
  // See: contents/themes/default/permissions.config.ts -> entities.pages

  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: () => import('./messages/en.json'),
      es: () => import('./messages/es.json'),
    },
  },

  // ==========================================
  // 6. BUILDER CONFIGURATION
  // ==========================================
  builder: {
    enabled: true,
    showSlug: true, // Slug is user-editable (public content)
    sidebarFields: ['locale'], // Pages don't have extra sidebar fields beyond basic settings
    seo: true, // Enable SEO fields panel in editor
  },

  // ==========================================
  // 7. TAXONOMIES CONFIGURATION
  // ==========================================
  taxonomies: {
    enabled: false, // Pages don't use taxonomies by default
    types: [],
  },

  // ==========================================
  // FIELDS
  // ==========================================
  fields: pagesFields,

  // ==========================================
  // METADATA
  // ==========================================
  source: 'theme',
}
