/**
 * Roles Configuration Merge System
 *
 * This module provides specialized merge logic for the user roles configuration.
 * Unlike the generic deepMerge utility (which replaces arrays entirely), this
 * function implements additive merge for roles while protecting core system roles.
 *
 * Key Features:
 * - Core roles (member, superadmin, developer) are always present and protected
 * - Themes can add custom roles via `additionalRoles`
 * - Developer role hierarchy is always forced to 100
 * - Non-developer roles cannot exceed hierarchy 99
 * - Validation with console warnings (non-blocking)
 *
 * @module roles-merge
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Core roles configuration (from DEFAULT_APP_CONFIG)
 * Contains the protected roles that cannot be removed
 */
export interface CoreRolesConfig {
  coreRoles: readonly string[]
  defaultRole: string
  availableRoles: readonly string[]
  hierarchy: Record<string, number>
  displayNames: Record<string, string>
  descriptions: Record<string, string>
}

/**
 * Theme roles configuration (from theme app.config.ts)
 * Allows themes to extend the role system
 */
export interface ThemeRolesConfig {
  additionalRoles?: readonly string[]
  defaultRole?: string
  hierarchy?: Record<string, number>
  displayNames?: Record<string, string>
  descriptions?: Record<string, string>
}

/**
 * Merged roles configuration result
 * Contains core roles + theme additions with validation applied
 */
export interface MergedRolesConfig {
  coreRoles: readonly string[]
  availableRoles: readonly string[]
  defaultRole: string
  hierarchy: Record<string, number>
  displayNames: Record<string, string>
  descriptions: Record<string, string>
}

// =============================================================================
// CONSTANTS
// =============================================================================

// User Roles Constants
const DEVELOPER_ROLE = 'developer'
const MAX_HIERARCHY = 100
const MAX_NON_DEVELOPER_HIERARCHY = 99
const DEFAULT_HIERARCHY = 1
const FALLBACK_DEFAULT_ROLE = 'member'

// =============================================================================
// MERGE FUNCTION
// =============================================================================

/**
 * Merge core roles configuration with theme-specific overrides
 *
 * This function implements the extensible roles system by:
 * 1. Protecting core roles from removal
 * 2. Appending theme additionalRoles to core roles
 * 3. Merging hierarchy with validation (developer=100, others <=99)
 * 4. Merging displayNames and descriptions (theme overrides core)
 * 5. Validating defaultRole exists in available roles
 *
 * @param coreConfig - Core roles configuration from DEFAULT_APP_CONFIG
 * @param themeConfig - Optional theme roles configuration overrides
 * @returns Merged and validated roles configuration
 *
 * @example
 * ```typescript
 * const merged = mergeRolesConfig(
 *   DEFAULT_APP_CONFIG.userRoles,
 *   { additionalRoles: ['editor', 'moderator'] }
 * )
 * // merged.availableRoles: ['member', 'superadmin', 'developer', 'editor', 'moderator']
 * ```
 */
export function mergeRolesConfig(
  coreConfig: CoreRolesConfig,
  themeConfig?: ThemeRolesConfig
): MergedRolesConfig {
  // Start with core config values
  const result: MergedRolesConfig = {
    coreRoles: coreConfig.coreRoles,
    availableRoles: [...coreConfig.coreRoles],
    defaultRole: coreConfig.defaultRole,
    hierarchy: { ...coreConfig.hierarchy },
    displayNames: { ...coreConfig.displayNames },
    descriptions: { ...coreConfig.descriptions },
  }

  // If no theme config, return core config as-is
  if (!themeConfig) {
    return result
  }

  // =============================================================================
  // STEP 1: Merge additionalRoles (additive)
  // =============================================================================

  if (themeConfig.additionalRoles && themeConfig.additionalRoles.length > 0) {
    const coreRolesSet = new Set(coreConfig.coreRoles)

    themeConfig.additionalRoles.forEach((role) => {
      // Check for collision with core roles
      if (coreRolesSet.has(role)) {
        console.warn(
          `[roles-merge] Theme attempted to add core role "${role}" via additionalRoles. ` +
            `Core roles cannot be redefined. Ignoring.`
        )
        return
      }

      // Append to available roles
      result.availableRoles = [...result.availableRoles, role]
    })
  }

  // =============================================================================
  // STEP 2: Merge hierarchy with validation
  // =============================================================================

  if (themeConfig.hierarchy) {
    Object.entries(themeConfig.hierarchy).forEach(([role, hierarchyValue]) => {
      // Special handling for developer role
      if (role === DEVELOPER_ROLE && hierarchyValue !== MAX_HIERARCHY) {
        console.warn(
          `[roles-merge] Theme attempted to set developer hierarchy to ${hierarchyValue}. ` +
            `Developer role must always have hierarchy ${MAX_HIERARCHY}. Forcing to ${MAX_HIERARCHY}.`
        )
        result.hierarchy[role] = MAX_HIERARCHY
        return
      }

      // Cap non-developer roles at 99
      if (role !== DEVELOPER_ROLE && hierarchyValue >= MAX_HIERARCHY) {
        console.warn(
          `[roles-merge] Theme attempted to set "${role}" hierarchy to ${hierarchyValue}. ` +
            `Non-developer roles cannot have hierarchy >= ${MAX_HIERARCHY}. Capping to ${MAX_NON_DEVELOPER_HIERARCHY}.`
        )
        result.hierarchy[role] = MAX_NON_DEVELOPER_HIERARCHY
        return
      }

      // Valid hierarchy value
      result.hierarchy[role] = hierarchyValue
    })
  }

  // =============================================================================
  // STEP 3: Default missing hierarchy values to 1
  // =============================================================================

  result.availableRoles.forEach((role) => {
    if (!(role in result.hierarchy)) {
      console.warn(
        `[roles-merge] Role "${role}" is missing hierarchy value. Defaulting to ${DEFAULT_HIERARCHY}.`
      )
      result.hierarchy[role] = DEFAULT_HIERARCHY
    }
  })

  // =============================================================================
  // STEP 4: Merge displayNames and descriptions (theme overrides)
  // =============================================================================

  if (themeConfig.displayNames) {
    result.displayNames = {
      ...result.displayNames,
      ...themeConfig.displayNames,
    }
  }

  if (themeConfig.descriptions) {
    result.descriptions = {
      ...result.descriptions,
      ...themeConfig.descriptions,
    }
  }

  // =============================================================================
  // STEP 5: Validate and merge defaultRole
  // =============================================================================

  if (themeConfig.defaultRole) {
    const availableRolesSet = new Set(result.availableRoles)

    if (!availableRolesSet.has(themeConfig.defaultRole)) {
      console.warn(
        `[roles-merge] Theme defaultRole "${themeConfig.defaultRole}" does not exist in available roles. ` +
          `Falling back to "${FALLBACK_DEFAULT_ROLE}".`
      )
      result.defaultRole = FALLBACK_DEFAULT_ROLE
    } else {
      result.defaultRole = themeConfig.defaultRole
    }
  }

  return result
}
