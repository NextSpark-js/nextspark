/**
 * Task Entity Configuration - REFACTORED
 * 
 * Updated according to new 5-section structure from refactoring plan.
 * All table names, API paths, and metadata are now derived automatically from slug.
 */

import { CheckSquare } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { taskFields } from './tasks.fields'

export const taskEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'tasks',           // Single source of truth - derives tableName, apiPath, metaTableName, i18nNamespace
  enabled: true,
  names: {
    singular: 'task',
    plural: 'Tasks'
  },
  icon: CheckSquare,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,          // If accessible without authentication, requires RLS (anon can select)
    api: true,              // If has external API via API key  
    metadata: true,         // If supports metadata system
    shared: false           // CASE 2: Any authenticated user can access all records (no userId filter)
  },
  
  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
      filters: [
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect' },
      ],
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
      importExport: false
    }
  },
  
  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  // Permissions are now centralized in permissions.config.ts
  // See: contents/themes/default/permissions.config.ts -> entities.tasks

  // ==========================================
  // FIELDS (imported from separate file)
  // ==========================================
  fields: taskFields,

  // ==========================================
  // AUTOMATIC SYSTEM DERIVATIONS
  // ==========================================
  // The following properties are automatically derived from the slug:
  // - tableName: 'tasks' (slug)
  // - metaTableName: 'tasks_metas' (slug + '_metas')
  // - apiPath: '/api/v1/tasks' (slug API Route)
  // - i18nNamespace: 'tasks' (slug as namespace)
  // - foreignKey in metadata: 'entityId' (generic for all entities)
}