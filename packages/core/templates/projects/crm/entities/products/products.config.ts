/**
 * Products Entity Configuration - CRM
 *
 * Products and services catalog.
 * Updated with team support and granular permissions.
 * Only owner can manage products.
 */

import { Package } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { productsFields } from './products.fields'

export const productsEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'products',
  enabled: true,
  names: {
    singular: 'product',
    plural: 'Products'
  },
  icon: Package,

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
      showInMenu: false,  // Accessed via settings
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
  fields: productsFields,
}

export default productsEntityConfig
