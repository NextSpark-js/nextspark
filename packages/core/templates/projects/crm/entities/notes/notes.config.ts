/**
 * Notes Entity Configuration - CRM
 *
 * Notes and comments on CRM records.
 * Updated with team support and granular permissions.
 */

import { FileText } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { notesFields } from './notes.fields'

export const notesEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'notes',
  enabled: true,
  names: {
    singular: 'note',
    plural: 'Notes'
  },
  icon: FileText,

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
      showInMenu: false,  // Notes shown within other entities
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
  // FIELDS
  // ==========================================
  fields: notesFields,
}

export default notesEntityConfig
