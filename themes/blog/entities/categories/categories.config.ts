/**
 * Categories Entity Configuration
 *
 * Categories for blog posts in the multi-author platform.
 */

import { Tag } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { categoryFields } from './categories.fields'

export const categoryEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'categories',
  enabled: true,
  names: {
    singular: 'category',
    plural: 'Categories'
  },
  icon: Tag,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: true,           // Categories are publicly accessible
    api: true,              // API access enabled
    metadata: false,        // No metadata needed
    shared: false           // User-owned categories (each user manages their own)
  },

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: false
    },
    public: {
      hasArchivePage: false,  // No dedicated archive page
      hasSinglePage: true     // /category/[slug] - posts by category
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: false,
      bulkOperations: true,
      importExport: false
    }
  },

  // ==========================================
  // FIELDS
  // ==========================================
  fields: categoryFields,
}

export default categoryEntityConfig
