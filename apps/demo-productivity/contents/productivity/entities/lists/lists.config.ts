/**
 * Lists Entity Configuration
 * 
 * Columns within boards (To Do, In Progress, Done, etc.)
 */

import { List } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { listFields } from './lists.fields'

export const listEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'lists',
  enabled: true,
  names: {
    singular: 'list',
    plural: 'Lists'
  },
  icon: List,
  
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
      showInMenu: false,    // Lists shown within boards, not separately
      showInTopbar: false
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
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
  fields: listFields,
}

export default listEntityConfig

