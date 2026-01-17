/**
 * Patterns Entity Configuration
 *
 * Core entity for reusable block compositions in the builder system.
 * Follows the 5-section structure for entity configuration.
 */

import { Layers } from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import { patternsFields } from './patterns.fields'

export const patternsEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'patterns',
  enabled: true,
  names: {
    singular: 'pattern',
    plural: 'Patterns'
  },
  icon: Layers,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,          // Patterns are internal, not public content
    api: true,              // Has API endpoints for block editor integration
    metadata: false,        // Does not use metadata system
    shared: true            // All team members see same patterns (team-scoped)
  },

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false  // Patterns don't have public pages
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false
    }
  },

  // ==========================================
  // 4. BUILDER CONFIGURATION
  // ==========================================
  builder: {
    enabled: true,          // Patterns use the block builder
    seo: false              // Patterns don't need SEO metadata
  },

  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: () => import('./messages/en.json'),
      es: () => import('./messages/es.json')
    }
  },

  // ==========================================
  // FIELDS (imported from separate file)
  // ==========================================
  fields: patternsFields,

  // ==========================================
  // SOURCE
  // ==========================================
  source: 'core'
}
