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

// =============================================================================
// TEAM ROLES TYPE DEFINITIONS
// =============================================================================

/**
 * Core team roles configuration (from DEFAULT_APP_CONFIG.teamRoles)
 * Contains the protected team role (owner) that cannot be removed
 *
 * Note: Team permissions are now defined in permissions.config.ts
 * and accessed via permissions-registry (TEAM_PERMISSIONS_BY_ROLE)
 */
export interface CoreTeamRolesConfig {
  coreTeamRoles: readonly string[]
  defaultTeamRole: string
  availableTeamRoles: readonly string[]
  hierarchy: Record<string, number>
  displayNames: Record<string, string>
  descriptions: Record<string, string>
}

/**
 * Theme team roles configuration (from theme app.config.ts)
 * Allows themes to customize team roles (except 'owner')
 *
 * Note: Team permissions are now defined in permissions.config.ts
 * Use the `teams` array in permissions.config.ts to define role permissions.
 */
export interface ThemeTeamRolesConfig {
  /** Additional team roles to add */
  additionalTeamRoles?: readonly string[]
  /** Team roles to remove (cannot include 'owner') */
  removeTeamRoles?: readonly string[]
  /** Default role for new team members */
  defaultTeamRole?: string
  /** Hierarchy overrides (cannot modify 'owner') */
  hierarchy?: Record<string, number>
  /** Display name overrides */
  displayNames?: Record<string, string>
  /** Description overrides */
  descriptions?: Record<string, string>
}

/**
 * Merged team roles configuration result
 *
 * Note: Team permissions are NOT included here anymore.
 * Use TEAM_PERMISSIONS_BY_ROLE from permissions-registry instead.
 */
export interface MergedTeamRolesConfig {
  coreTeamRoles: readonly string[]
  availableTeamRoles: readonly string[]
  defaultTeamRole: string
  hierarchy: Record<string, number>
  displayNames: Record<string, string>
  descriptions: Record<string, string>
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

// Team Roles Constants
const OWNER_TEAM_ROLE = 'owner'
const OWNER_TEAM_HIERARCHY = 100
const MAX_NON_OWNER_TEAM_HIERARCHY = 99
const DEFAULT_TEAM_HIERARCHY = 1
const FALLBACK_DEFAULT_TEAM_ROLE = 'member'

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

// =============================================================================
// TEAM ROLES MERGE FUNCTION
// =============================================================================

/**
 * Merge core team roles configuration with theme-specific overrides
 *
 * This function implements the extensible team roles system by:
 * 1. Protecting the 'owner' role from removal (critical for team creation)
 * 2. Allowing themes to add custom team roles via `additionalTeamRoles`
 * 3. Allowing themes to remove non-core roles via `removeTeamRoles`
 * 4. Merging hierarchy with validation (owner=100, others <=99)
 * 5. Validating defaultTeamRole exists in available roles
 *
 * @param coreConfig - Core team roles configuration from DEFAULT_APP_CONFIG
 * @param themeConfig - Optional theme team roles configuration overrides
 * @returns Merged and validated team roles configuration
 *
 * @example
 * ```typescript
 * const merged = mergeTeamRolesConfig(
 *   DEFAULT_APP_CONFIG.teamRoles,
 *   {
 *     additionalTeamRoles: ['editor', 'guest'],
 *     removeTeamRoles: ['viewer'],
 *   }
 * )
 * // merged.availableTeamRoles: ['owner', 'admin', 'member', 'editor', 'guest']
 * ```
 */
export function mergeTeamRolesConfig(
  coreConfig: CoreTeamRolesConfig,
  themeConfig?: ThemeTeamRolesConfig
): MergedTeamRolesConfig {
  // Start with core config values
  // Note: permissions are not included - they come from permissions-registry
  const result: MergedTeamRolesConfig = {
    coreTeamRoles: coreConfig.coreTeamRoles,
    availableTeamRoles: [...coreConfig.availableTeamRoles],
    defaultTeamRole: coreConfig.defaultTeamRole,
    hierarchy: { ...coreConfig.hierarchy },
    displayNames: { ...coreConfig.displayNames },
    descriptions: { ...coreConfig.descriptions },
  }

  // If no theme config, return core config as-is
  if (!themeConfig) {
    return result
  }

  const coreTeamRolesSet = new Set(coreConfig.coreTeamRoles)

  // =============================================================================
  // STEP 1: Remove team roles (theme can remove non-core roles)
  // =============================================================================

  if (themeConfig.removeTeamRoles && themeConfig.removeTeamRoles.length > 0) {
    themeConfig.removeTeamRoles.forEach((role) => {
      // Check if attempting to remove core role
      if (coreTeamRolesSet.has(role)) {
        console.warn(
          `[roles-merge] Theme attempted to remove core team role "${role}". ` +
            `Core team roles cannot be removed. Ignoring.`
        )
        return
      }

      // Remove from available roles
      result.availableTeamRoles = result.availableTeamRoles.filter((r) => r !== role)

      // Remove from hierarchy, displayNames, descriptions
      delete result.hierarchy[role]
      delete result.displayNames[role]
      delete result.descriptions[role]
    })
  }

  // =============================================================================
  // STEP 2: Add additional team roles
  // =============================================================================

  if (themeConfig.additionalTeamRoles && themeConfig.additionalTeamRoles.length > 0) {
    themeConfig.additionalTeamRoles.forEach((role) => {
      // Check for collision with existing roles
      if (result.availableTeamRoles.includes(role)) {
        console.warn(
          `[roles-merge] Theme attempted to add existing team role "${role}". Ignoring.`
        )
        return
      }

      // Append to available roles
      result.availableTeamRoles = [...result.availableTeamRoles, role]
    })
  }

  // =============================================================================
  // STEP 3: Merge hierarchy with validation
  // =============================================================================

  if (themeConfig.hierarchy) {
    Object.entries(themeConfig.hierarchy).forEach(([role, hierarchyValue]) => {
      // Protect owner role hierarchy
      if (role === OWNER_TEAM_ROLE) {
        if (hierarchyValue !== OWNER_TEAM_HIERARCHY) {
          console.warn(
            `[roles-merge] Theme attempted to set owner team hierarchy to ${hierarchyValue}. ` +
              `Owner role must always have hierarchy ${OWNER_TEAM_HIERARCHY}. Ignoring.`
          )
        }
        return // Always keep owner at 100
      }

      // Cap non-owner roles at 99
      if (hierarchyValue >= OWNER_TEAM_HIERARCHY) {
        console.warn(
          `[roles-merge] Theme attempted to set "${role}" team hierarchy to ${hierarchyValue}. ` +
            `Non-owner roles cannot have hierarchy >= ${OWNER_TEAM_HIERARCHY}. Capping to ${MAX_NON_OWNER_TEAM_HIERARCHY}.`
        )
        result.hierarchy[role] = MAX_NON_OWNER_TEAM_HIERARCHY
        return
      }

      // Valid hierarchy value
      result.hierarchy[role] = hierarchyValue
    })
  }

  // =============================================================================
  // STEP 4: Default missing hierarchy values
  // =============================================================================

  result.availableTeamRoles.forEach((role) => {
    if (!(role in result.hierarchy)) {
      console.warn(
        `[roles-merge] Team role "${role}" is missing hierarchy value. Defaulting to ${DEFAULT_TEAM_HIERARCHY}.`
      )
      result.hierarchy[role] = DEFAULT_TEAM_HIERARCHY
    }
  })

  // =============================================================================
  // STEP 5: Merge displayNames and descriptions
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
  // STEP 6: Validate and merge defaultTeamRole
  // =============================================================================
  // Note: Permissions merge removed - permissions now come from permissions-registry
  // See TEAM_PERMISSIONS_BY_ROLE in permissions-registry.ts

  if (themeConfig.defaultTeamRole) {
    const availableRolesSet = new Set(result.availableTeamRoles)

    if (!availableRolesSet.has(themeConfig.defaultTeamRole)) {
      console.warn(
        `[roles-merge] Theme defaultTeamRole "${themeConfig.defaultTeamRole}" does not exist in available team roles. ` +
          `Falling back to "${FALLBACK_DEFAULT_TEAM_ROLE}".`
      )
      result.defaultTeamRole = FALLBACK_DEFAULT_TEAM_ROLE
    } else {
      result.defaultTeamRole = themeConfig.defaultTeamRole
    }
  }

  return result
}
