import type {
  CorePermissionsConfig,
  ThemePermissionsConfig,
  PermissionConfig,
  PermissionUISection,
  Permission,
  ResolvedPermission,
  EntityPermissionsConfig
} from './types'

/**
 * Merge configuration from core with theme and entities
 *
 * Order of precedence:
 * 1. Core config (base)
 * 2. Theme overrides (override specific properties)
 * 3. Theme features (add new permissions)
 * 4. Entity configs (add entity permissions)
 */
export function mergePermissionsConfig(
  coreConfig: CorePermissionsConfig,
  themeConfig: ThemePermissionsConfig | null,
  entityPermissions: PermissionConfig[]
): {
  permissions: ResolvedPermission[]
  uiSections: PermissionUISection[]
  disabledIds: Set<Permission>
} {
  const result: ResolvedPermission[] = []
  const disabledIds = new Set<Permission>(themeConfig?.disabled || [])

  // 1. Process system permissions (core)
  for (const perm of coreConfig.systemPermissions) {
    // Skip if disabled
    if (disabledIds.has(perm.id)) {
      continue
    }

    // Apply override if exists
    const override = themeConfig?.overrides?.[perm.id]
    if (override) {
      result.push({
        ...perm,
        ...override,
        id: perm.id, // ID cannot be changed
        source: 'core',
        disabled: false,
      })
    } else {
      result.push({
        ...perm,
        source: 'core',
        disabled: false,
      })
    }
  }

  // 2. Add theme features
  // Features use 'action' property, but ResolvedPermission uses 'id'
  if (themeConfig?.features) {
    for (const feature of themeConfig.features) {
      result.push({
        id: feature.action as Permission, // Map action to id
        label: feature.label,
        description: feature.description,
        category: feature.category || 'Features',
        roles: feature.roles,
        dangerous: feature.dangerous,
        source: 'theme',
        disabled: false,
      })
    }
  }

  // 3. Add entity permissions
  for (const entityPerm of entityPermissions) {
    result.push({
      ...entityPerm,
      source: 'entity',
      disabled: false,
    })
  }

  // 4. Combine UI sections
  const uiSections = [
    ...coreConfig.uiSections,
    ...(themeConfig?.uiSections || []),
  ]

  // Update entities section with actual entity categories
  const entitiesSection = uiSections.find(s => s.id === 'entities')
  if (entitiesSection) {
    const entityCategories = new Set(entityPermissions.map(p => p.category))
    entitiesSection.categories = Array.from(entityCategories)
  }

  return {
    permissions: result,
    uiSections,
    disabledIds,
  }
}

/**
 * Extract permissions from EntityConfig
 *
 * Converts entity permissions configuration into PermissionConfig objects
 * that can be merged into the global permissions registry.
 *
 * @param entitySlug - The entity identifier (e.g., "customers", "tasks")
 * @param entityLabel - Human-readable entity name for UI
 * @param permissions - Entity permissions configuration
 * @returns Array of PermissionConfig objects
 *
 * @example
 * ```typescript
 * const perms = extractEntityPermissions(
 *   'customers',
 *   'Customers',
 *   {
 *     actions: [
 *       { action: 'create', label: 'Create customers', roles: ['owner', 'admin'] }
 *     ]
 *   }
 * )
 * // Returns: [{ id: 'customers.create', label: 'Create customers', ... }]
 * ```
 */
export function extractEntityPermissions(
  entitySlug: string,
  entityLabel: string,
  permissions: EntityPermissionsConfig
): PermissionConfig[] {
  const result: PermissionConfig[] = []

  // Standard actions
  for (const action of permissions.actions) {
    result.push({
      id: `${entitySlug}.${action.action}` as Permission,
      label: action.label,
      description: action.description,
      category: entityLabel,
      roles: action.roles,
      dangerous: action.dangerous,
    })
  }

  // Custom actions
  if (permissions.customActions) {
    for (const action of permissions.customActions) {
      result.push({
        id: `${entitySlug}.${action.action}` as Permission,
        label: action.label,
        description: action.description,
        category: entityLabel,
        roles: action.roles,
        dangerous: action.dangerous,
      })
    }
  }

  return result
}
