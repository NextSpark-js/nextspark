/**
 * Opportunities Entity Configuration - CRM
 *
 * Sales opportunities in the pipeline.
 * Updated with team support and granular permissions.
 */

import { TrendingUp } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { opportunitiesFields } from './opportunities.fields'

export const opportunitiesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'opportunities',
  enabled: true,
  names: {
    singular: 'opportunity',
    plural: 'Opportunities'
  },
  icon: TrendingUp,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: true
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
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: true
    }
  },

  // ==========================================
  // 4. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },

  // ==========================================
  // FIELDS
  // ==========================================
  fields: opportunitiesFields,
}

export default opportunitiesEntityConfig
