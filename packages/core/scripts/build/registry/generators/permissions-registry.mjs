/**
 * Permissions Registry Generator
 *
 * Generates permissions-registry.ts
 *
 * @module core/scripts/build/registry/generators/permissions-registry
 */

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { log, verbose } from '../../../utils/index.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/build/registry/generators/ to project root (6 levels up)
const rootDir = join(__dirname, '../../../../../..')

import { convertCorePath } from '../config.mjs'

/**
 * Generate pre-computed permissions registry
 * Merges core permissions + theme permissions + entity permissions at build time
 *
 * @param {object} permissionsConfig - Permissions config from discovery
 * @param {Array} entities - Discovered entities
 * @param {object} config - Configuration object from getConfig()
 * @returns {Promise<string>} Generated TypeScript content
 */
export async function generatePermissionsRegistry(permissionsConfig, entities, config) {
  const hasThemeConfig = permissionsConfig !== null
  const themeName = hasThemeConfig ? permissionsConfig.themeName : 'none'

  // Helper to convert TypeScript path aliases to actual file paths
  const resolveAliasPath = (aliasPath) => {
    if (aliasPath.startsWith('@/contents/')) {
      return join(rootDir, aliasPath.replace('@/contents/', 'contents/') + '.ts')
    }
    if (aliasPath.startsWith('@/core/')) {
      return join(rootDir, aliasPath.replace('@/core/', 'packages/core/') + '.ts')
    }
    return aliasPath
  }

  // Extract entity permissions from centralized permissions.config.ts
  // This is the SINGLE SOURCE OF TRUTH for all entity permissions
  const entityPermissions = []
  const processedEntities = new Set()

  // PRIORITY 1: Read from permissions.config.ts -> entities (centralized definition)
  // This allows custom roles like 'editor' to be included directly in roles
  if (hasThemeConfig && permissionsConfig.entities) {
    log('  📋 Reading entity permissions from permissions.config.ts (centralized)', 'info')
    for (const [entitySlug, actions] of Object.entries(permissionsConfig.entities)) {
      if (!Array.isArray(actions)) continue

      // Find matching entity for display name
      const matchingEntity = entities.find(e => e.name === entitySlug)
      const displayName = matchingEntity?.displayName || entitySlug.charAt(0).toUpperCase() + entitySlug.slice(1)

      for (const action of actions) {
        entityPermissions.push({
          id: `${entitySlug}.${action.action}`,
          label: action.label || `${action.action.charAt(0).toUpperCase() + action.action.slice(1)} ${displayName}`,
          description: action.description || `${action.action} permission for ${displayName}`,
          category: displayName,
          roles: action.roles || ['owner', 'admin'],
          dangerous: action.dangerous || false,
          source: 'theme'
        })
      }
      processedEntities.add(entitySlug)
      log(`  ✅ Extracted ${actions.length} permissions for ${entitySlug} (from permissions.config.ts)`, 'info')
    }
  }

  // NOTE: Entity permissions are now ONLY read from permissions.config.ts (centralized)
  // The legacy fallback to entity.config.ts has been removed.
  // All entity permissions must be defined in permissions.config.ts -> entities

  // Log entities without permissions in permissions.config.ts
  for (const entity of entities) {
    if (!processedEntities.has(entity.name)) {
      verbose(`  ℹ️ No permissions defined for ${entity.name} in permissions.config.ts`)
    }
  }

  log(`📋 Total entity permissions: ${entityPermissions.length}`, 'info')

  // Extract team permissions from permissions.config.ts
  const teamPermissions = []
  if (hasThemeConfig && permissionsConfig.teams && Array.isArray(permissionsConfig.teams)) {
    for (const perm of permissionsConfig.teams) {
      teamPermissions.push({
        id: perm.action,
        label: perm.label || perm.action,
        description: perm.description || `Team permission: ${perm.action}`,
        category: 'Teams',
        roles: perm.roles || ['owner'],
        dangerous: perm.dangerous || false,
        source: 'theme'
      })
    }
    log(`📋 Team permissions: ${teamPermissions.length}`, 'info')
  }

  // Extract feature permissions (now using 'action' instead of 'id')
  const featurePermissions = []
  if (hasThemeConfig && permissionsConfig.features && Array.isArray(permissionsConfig.features)) {
    for (const feature of permissionsConfig.features) {
      featurePermissions.push({
        id: feature.action, // Using action instead of id
        label: feature.label || feature.action,
        description: feature.description || `Feature: ${feature.action}`,
        category: feature.category || 'Features',
        roles: feature.roles || ['owner', 'admin'],
        dangerous: feature.dangerous || false,
        source: 'theme'
      })
    }
    log(`📋 Feature permissions: ${featurePermissions.length}`, 'info')
  }

  // Extract roles configuration
  const rolesConfig = hasThemeConfig && permissionsConfig.roles ? permissionsConfig.roles : null

  // Build imports (convert @/core/ paths based on NPM mode)
  const outputFilePath = join(config.outputDir, 'permissions-registry.ts')

  const imports = [
    `import { CORE_PERMISSIONS_CONFIG } from '${convertCorePath('@/core/lib/permissions/system', outputFilePath, config)}'`,
    `import { APP_CONFIG_MERGED } from '${convertCorePath('@/core/lib/config/config-sync', outputFilePath, config)}'`
  ]

  if (hasThemeConfig) {
    imports.push(`import { PERMISSIONS_CONFIG_OVERRIDES } from '${permissionsConfig.importPath}'`)
  }

  imports.push(`import type { Permission, ResolvedPermission, PermissionUISection, RolesConfig, PermissionAction } from '${convertCorePath('@/core/lib/permissions/types', outputFilePath, config)}'`)

  return `/**
 * Auto-generated Permissions Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Team permissions: ${teamPermissions.length}
 * Feature permissions: ${featurePermissions.length}
 * Entity permissions: ${entityPermissions.length}
 *
 * This file provides pre-computed permissions data for O(1) runtime lookups.
 * All permission matrices are computed at build time.
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 *
 * Query functions moved to: @nextsparkjs/core/lib/services/permission.service
 * Import PermissionService for hasPermission, getRolePermissions, canDoAction, etc.
 */

${imports.join('\n')}

// ============================================================================
// BUILD-TIME CONSTANTS
// ============================================================================

// Entity permissions (from permissions.config.ts -> entities)
const ENTITY_PERMISSIONS = ${JSON.stringify(entityPermissions, null, 2)} as unknown as ResolvedPermission[]

// Team permissions (from permissions.config.ts -> teams)
const TEAM_PERMISSIONS = ${JSON.stringify(teamPermissions, null, 2)} as unknown as ResolvedPermission[]

// Feature permissions (from permissions.config.ts -> features, now using 'action')
const FEATURE_PERMISSIONS = ${JSON.stringify(featurePermissions, null, 2)} as unknown as ResolvedPermission[]

// ============================================================================
// CUSTOM ROLES CONFIGURATION
// ============================================================================

/** Custom roles defined in permissions.config.ts */
export const CUSTOM_ROLES: RolesConfig = ${rolesConfig ? JSON.stringify(rolesConfig, null, 2) : '{}'}

// ============================================================================
// TEAM PERMISSIONS EXPORTS
// ============================================================================

/** Raw team permissions array (for UI) */
export const TEAM_PERMISSIONS_RAW: PermissionAction[] = ${hasThemeConfig ? 'PERMISSIONS_CONFIG_OVERRIDES.teams ?? []' : '[]'}

/** Team permissions indexed by role (for O(1) lookup) */
export const TEAM_PERMISSIONS_BY_ROLE: Record<string, string[]> = (() => {
  const byRole: Record<string, string[]> = {}
  for (const perm of TEAM_PERMISSIONS_RAW) {
    for (const role of perm.roles) {
      if (!byRole[role]) byRole[role] = []
      byRole[role].push(perm.action)
    }
  }
  return byRole
})()

// ============================================================================
// RUNTIME MERGED PERMISSIONS (computed once on module load)
// ============================================================================

// Core team roles
const CORE_TEAM_ROLES = ['owner', 'admin', 'member', 'viewer'] as const

// Get available roles: core + custom from permissions.config.ts
export const AVAILABLE_ROLES: readonly string[] = [
  ...CORE_TEAM_ROLES,
  ...(CUSTOM_ROLES.additionalRoles ?? [])
]

// Role hierarchy (merged)
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 50,
  member: 10,
  viewer: 1,
  ...(CUSTOM_ROLES.hierarchy ?? {})
}

// Role display names (merged)
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  owner: 'common.teamRoles.owner',
  admin: 'common.teamRoles.admin',
  member: 'common.teamRoles.member',
  viewer: 'common.teamRoles.viewer',
  ...(CUSTOM_ROLES.displayNames ?? {})
}

// Role descriptions (merged)
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full team control, cannot be removed',
  admin: 'Manage team members and settings',
  member: 'Standard team access',
  viewer: 'Read-only access to team resources',
  ...(CUSTOM_ROLES.descriptions ?? {})
}

// Merge all permissions: core + teams + features + entities
function buildAllPermissions(): ResolvedPermission[] {
  const permissions: ResolvedPermission[] = []
  const addedIds = new Set<string>() // Track added IDs to prevent duplicates
  const disabledIds = new Set<string>(${hasThemeConfig ? 'PERMISSIONS_CONFIG_OVERRIDES.disabled ?? []' : '[]'})
  const overrides = ${hasThemeConfig ? 'PERMISSIONS_CONFIG_OVERRIDES.overrides ?? {}' : '{}'}

  // 1. Add core system permissions (highest priority)
  for (const perm of CORE_PERMISSIONS_CONFIG.systemPermissions) {
    if (disabledIds.has(perm.id)) continue

    const override = overrides[perm.id as keyof typeof overrides]
    permissions.push({
      ...perm,
      ...(override || {}),
      source: 'core',
      disabled: false
    } as ResolvedPermission)
    addedIds.add(perm.id)
  }

  // 2. Add team permissions
  for (const teamPerm of TEAM_PERMISSIONS) {
    if (disabledIds.has(teamPerm.id) || addedIds.has(teamPerm.id)) continue
    permissions.push({
      ...teamPerm,
      disabled: false
    })
    addedIds.add(teamPerm.id)
  }

  // 3. Add feature permissions (now using action instead of id)
  for (const featurePerm of FEATURE_PERMISSIONS) {
    if (disabledIds.has(featurePerm.id) || addedIds.has(featurePerm.id)) continue
    permissions.push({
      ...featurePerm,
      disabled: false
    })
    addedIds.add(featurePerm.id)
  }

  // 4. Add entity permissions
  for (const entityPerm of ENTITY_PERMISSIONS) {
    if (disabledIds.has(entityPerm.id) || addedIds.has(entityPerm.id)) continue
    permissions.push({
      ...entityPerm,
      disabled: false
    })
    addedIds.add(entityPerm.id)
  }

  return permissions
}

// Build permissions once on module load
export const ALL_RESOLVED_PERMISSIONS = buildAllPermissions()

// ============================================================================
// PRE-COMPUTED DATA STRUCTURES
// ============================================================================

// All permission IDs
export const ALL_PERMISSIONS: Permission[] = ALL_RESOLVED_PERMISSIONS.map(p => p.id as Permission)

// Set for O(1) existence check
export const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS)

// Permissions indexed by role (Set for O(1) lookup)
export const PERMISSIONS_BY_ROLE: Record<string, Set<Permission>> = {}

// Also as arrays for iteration
export const ROLE_PERMISSIONS_ARRAY: Record<string, Permission[]> = {}

// Build role matrices from roles
for (const role of AVAILABLE_ROLES) {
  if (role === 'owner') {
    // Owner has all permissions
    PERMISSIONS_BY_ROLE[role] = new Set(ALL_PERMISSIONS)
    ROLE_PERMISSIONS_ARRAY[role] = [...ALL_PERMISSIONS]
  } else {
    const rolePerms: Permission[] = []
    for (const perm of ALL_RESOLVED_PERMISSIONS) {
      if (perm.roles?.includes(role as any)) {
        rolePerms.push(perm.id as Permission)
      }
    }
    PERMISSIONS_BY_ROLE[role] = new Set(rolePerms)
    ROLE_PERMISSIONS_ARRAY[role] = rolePerms
  }
}

// NOTE: Custom roles (like 'editor') get their permissions via roles in permissions.config.ts
// The TEAM_ROLE_PERMISSIONS hack has been removed in favor of centralized permission definitions.

// Permissions indexed by category
export const PERMISSIONS_BY_CATEGORY: Record<string, ResolvedPermission[]> = {}
for (const perm of ALL_RESOLVED_PERMISSIONS) {
  if (!PERMISSIONS_BY_CATEGORY[perm.category]) {
    PERMISSIONS_BY_CATEGORY[perm.category] = []
  }
  PERMISSIONS_BY_CATEGORY[perm.category].push(perm)
}

// Full matrix for UI (Sector7)
export const FULL_MATRIX: Record<Permission, Record<string, boolean>> = {} as any
for (const perm of ALL_RESOLVED_PERMISSIONS) {
  FULL_MATRIX[perm.id as Permission] = {}
  for (const role of AVAILABLE_ROLES) {
    FULL_MATRIX[perm.id as Permission][role] = PERMISSIONS_BY_ROLE[role]?.has(perm.id as Permission) ?? false
  }
}

// UI Sections
export const UI_SECTIONS: PermissionUISection[] = [
  // Core sections
  ...CORE_PERMISSIONS_CONFIG.uiSections,
  // Theme sections
  ${hasThemeConfig ? '...(PERMISSIONS_CONFIG_OVERRIDES.uiSections ?? []),' : ''}
  // Entity section (auto-generated)
  {
    id: 'entities',
    label: 'Entities',
    description: 'Entity-specific permissions',
    categories: [...new Set(ENTITY_PERMISSIONS.map(p => p.category))]
  }
]

// ============================================================================
// METADATA
// ============================================================================

export const PERMISSIONS_METADATA = {
  totalPermissions: ALL_PERMISSIONS.length,
  corePermissions: CORE_PERMISSIONS_CONFIG.systemPermissions.length,
  teamPermissions: TEAM_PERMISSIONS.length,
  featurePermissions: FEATURE_PERMISSIONS.length,
  entityPermissions: ENTITY_PERMISSIONS.length,
  customRoles: CUSTOM_ROLES.additionalRoles?.length ?? 0,
  availableRoles: AVAILABLE_ROLES.length,
  categories: Object.keys(PERMISSIONS_BY_CATEGORY).length,
  generatedAt: '${new Date().toISOString()}',
  theme: '${themeName}'
}
`
}
