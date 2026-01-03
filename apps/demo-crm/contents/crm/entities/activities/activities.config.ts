/**
 * Activities Entity Configuration - CRM
 *
 * Tasks and activities related to CRM records.
 * Updated with team support and granular permissions.
 */

import { Calendar } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { activitiesFields } from './activities.fields'

export const activitiesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'activities',
  enabled: true,
  names: {
    singular: 'activity',
    plural: 'Activities'
  },
  icon: Calendar,

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
  fields: activitiesFields,
}

export default activitiesEntityConfig
