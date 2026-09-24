/**
 * Leads Entity Configuration - CRM
 *
 * Prospective customers before conversion.
 * Updated with team support and granular permissions.
 */

import { UserSearch } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { leadsFields } from './leads.fields'

export const leadsEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'leads',
  enabled: true,
  names: {
    singular: 'lead',
    plural: 'Leads'
  },
  icon: UserSearch,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: true    // Team-shared: all team members can see all leads
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
  fields: leadsFields,
}

export default leadsEntityConfig
