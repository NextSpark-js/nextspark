/**
 * Customers Entity Configuration - REFACTORED
 * 
 * Updated according to new 5-section structure from refactoring plan.
 * All table names, API paths, and metadata are now derived automatically from slug.
 */

import { Users } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { customersFields } from './customers.fields'

export const customerEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'customers',       // Single source of truth - derives tableName, apiPath, metaTableName, i18nNamespace
  enabled: true,
  names: {
    singular: 'customer',
    plural: 'Customers'
  },
  icon: Users,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,          // Not accessible without authentication
    api: true,              // Has external API endpoints
    metadata: true,         // Supports metadata system
    shared: true            // CASE 2: Any authenticated user can access all records (no userId filter)
  },
  
  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,     // Based on showInMenu: true
      showInTopbar: true    // Based on showInTopbar: true
    },
    public: {
      hasArchivePage: true, // Based on original hasArchivePage
      hasSinglePage: true   // Based on original hasSinglePage
    },
    features: {
      searchable: true,     // Based on searchable: true
      sortable: true,       // Based on sortable: true
      filterable: true,     // Based on filterable: true
      bulkOperations: true, // Based on supportsBulkOperations: true
      importExport: false   // Based on supportsImportExport: false
    }
  },
  
  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  // Permissions are now centralized in permissions.config.ts
  // See: contents/themes/default/permissions.config.ts -> entities.customers

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
  fields: customersFields,

  // ==========================================
  // AUTOMATIC SYSTEM DERIVATIONS
  // ==========================================
  // The following properties are automatically derived from the slug:
  // - tableName: 'customers' (slug)
  // - metaTableName: 'customers_metas' (slug + '_metas')
  // - apiPath: '/api/v1/customers' (slug API Route)
  // - i18nNamespace: 'customers' (slug as namespace)
  // - foreignKey in metadata: 'entityId' (generic for all entities)
}