/**
 * Posts Entity Configuration
 * 
 * Blog posts entity for the personal blog theme.
 */

import { FileText } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { postFields } from './posts.fields'

export const postEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'posts',
  enabled: true,
  names: {
    singular: 'post',
    plural: 'Posts'
  },
  icon: FileText,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: true,           // Published posts are publicly accessible
    api: true,              // API access enabled
    metadata: true,         // Supports metadata (SEO, custom fields)
    shared: false           // Personal posts, filtered by userId
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
      hasArchivePage: true,  // /posts - list of all published posts
      hasSinglePage: true    // /posts/[slug] - individual post page
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: true     // Export/Import feature enabled
    }
  },
  
  // ==========================================
  // FIELDS
  // ==========================================
  fields: postFields,
}

export default postEntityConfig

