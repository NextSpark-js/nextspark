/**
 * Pipelines Entity Configuration - CRM
 *
 * Sales pipelines with stages.
 * Updated with team support and granular permissions.
 * Only owner can manage pipelines.
 */

import { GitBranch } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { pipelinesFields } from './pipelines.fields'

export const pipelinesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'pipelines',
  enabled: true,
  names: {
    singular: 'pipeline',
    plural: 'Pipelines'
  },
  icon: GitBranch,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,
    api: true,
    metadata: false,
    shared: true
  },

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: false,  // Accessed via settings
      showInTopbar: false
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: false,
      sortable: true,
      filterable: false,
      bulkOperations: false,
      importExport: false
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
  fields: pipelinesFields,
}

export default pipelinesEntityConfig
