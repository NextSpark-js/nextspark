/**
 * Companies Entity Configuration - CRM
 *
 * Customer and prospect companies.
 * Updated with team support and granular permissions.
 */

import { Building2 } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { companiesFields } from './companies.fields'

export const companiesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'companies',
  enabled: true,
  names: {
    singular: 'company',
    plural: 'Companies'
  },
  icon: Building2,

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
  // FIELDS
  // ==========================================
  fields: companiesFields,
}

export default companiesEntityConfig
