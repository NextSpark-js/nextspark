/**
 * AI History Entity Configuration
 *
 * Generic audit trail for all AI interactions across plugins.
 * Tracks operations, costs, performance metrics, and results.
 * Supports polymorphic relationships to any entity type.
 *
 * Updated according to new 5-section structure from refactoring plan.
 * All table names, API paths, and metadata are now derived automatically from slug.
 */

import { History } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { aiHistoryFields } from './ai-history.fields'

export const aiHistoryEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'ai-history',    // Single source of truth - derives tableName, apiPath, metaTableName, i18nNamespace
  enabled: true,
  names: {
    singular: 'AI History',
    plural: 'AI History'
  },
  icon: History,

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,          // Users can only see their own history
    api: true,              // Has external API via API key
    metadata: true,         // ✅ Uses ai_history_metas table for flexible metadata
    shared: false           // REQUIRED: Private data (user-owned)
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
      hasArchivePage: false,
      hasSinglePage: true
    },
    features: {
      searchable: true,       // Search by operation, model, provider, relatedEntityType
      sortable: true,         // Sort by date, cost, status, tokens
      filterable: true,       // Filter by status, operation, provider, model
      bulkOperations: true,   // Delete multiple history items
      importExport: false     // Sensitive data, keep internal
    }
  },

  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  permissions: {
    actions: [
      {
        action: 'create',
        label: 'Create AI history',
        description: 'Can create AI history entries (typically via API)',
        roles: ['owner', 'admin', 'member'],
      },
      {
        action: 'read',
        label: 'View AI history',
        description: 'Can view AI history entries (users see their own via API filtering)',
        roles: ['owner', 'admin', 'member'],
      },
      {
        action: 'list',
        label: 'List AI history',
        description: 'Can list AI history entries',
        roles: ['owner', 'admin', 'member'],
      },
      {
        action: 'update',
        label: 'Edit AI history',
        description: 'Can modify AI history entries (immutable for most users)',
        roles: ['owner', 'admin'],
      },
      {
        action: 'delete',
        label: 'Delete AI history',
        description: 'Can delete AI history entries (users can delete their own)',
        roles: ['owner', 'admin', 'member'],
        dangerous: true,
      },
    ],
  },

  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },

  // ==========================================
  // FIELDS (imported from separate file)
  // ==========================================
  fields: aiHistoryFields,

  // ==========================================
  // AUTOMATIC SYSTEM DERIVATIONS
  // ==========================================
  // The following properties are automatically derived from the slug:
  // - tableName: 'ai_history' (slug with dashes replaced by underscores)
  // - metaTableName: 'ai_history_metas' (tableName + '_metas')
  // - apiPath: '/api/v1/ai-history' (slug API Route)
  // - i18nNamespace: 'ai-history' (slug as namespace)
  // - foreignKey in metadata: 'entityId' (generic for all entities)
}