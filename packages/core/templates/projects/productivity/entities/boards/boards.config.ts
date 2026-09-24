/**
 * Boards Entity Configuration
 * 
 * Trello-style boards for organizing lists and cards.
 */

import { LayoutDashboard } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { boardFields } from './boards.fields'

export const boardEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'boards',
  enabled: true,
  names: {
    singular: 'board',
    plural: 'Boards'
  },
  icon: LayoutDashboard,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,          // Private boards
    api: true,
    metadata: false,
    shared: true            // Shared within team
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
      bulkOperations: false,
      importExport: false
    }
  },
  
  // ==========================================
  // FIELDS
  // ==========================================
  fields: boardFields,
}

export default boardEntityConfig

