/**
 * Contacts Entity Configuration - CRM
 *
 * People contacts at companies.
 * Updated with team support and granular permissions.
 */

import { Users } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { contactsFields } from './contacts.fields'

export const contactsEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'contacts',
  enabled: true,
  names: {
    singular: 'contact',
    plural: 'Contacts'
  },
  icon: Users,

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
  fields: contactsFields,
}

export default contactsEntityConfig
