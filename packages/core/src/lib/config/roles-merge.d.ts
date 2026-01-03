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
/**
 * Core roles configuration (from DEFAULT_APP_CONFIG)
 * Contains the protected roles that cannot be removed
 */
export interface CoreRolesConfig {
    coreRoles: readonly string[];
    defaultRole: string;
    availableRoles: readonly string[];
    hierarchy: Record<string, number>;
    displayNames: Record<string, string>;
    descriptions: Record<string, string>;
}
/**
 * Theme roles configuration (from theme app.config.ts)
 * Allows themes to extend the role system
 */
export interface ThemeRolesConfig {
    additionalRoles?: readonly string[];
    defaultRole?: string;
    hierarchy?: Record<string, number>;
    displayNames?: Record<string, string>;
    descriptions?: Record<string, string>;
}
/**
 * Core team roles configuration (from DEFAULT_APP_CONFIG.teamRoles)
 * Contains the protected team role (owner) that cannot be removed
 *
 * Note: Team permissions are now defined in permissions.config.ts
 * and accessed via permissions-registry (TEAM_PERMISSIONS_BY_ROLE)
 */
export interface CoreTeamRolesConfig {
    coreTeamRoles: readonly string[];
    defaultTeamRole: string;
    availableTeamRoles: readonly string[];
    hierarchy: Record<string, number>;
    displayNames: Record<string, string>;
    descriptions: Record<string, string>;
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
    additionalTeamRoles?: readonly string[];
    /** Team roles to remove (cannot include 'owner') */
    removeTeamRoles?: readonly string[];
    /** Default role for new team members */
    defaultTeamRole?: string;
    /** Hierarchy overrides (cannot modify 'owner') */
    hierarchy?: Record<string, number>;
    /** Display name overrides */
    displayNames?: Record<string, string>;
    /** Description overrides */
    descriptions?: Record<string, string>;
}
/**
 * Merged team roles configuration result
 *
 * Note: Team permissions are NOT included here anymore.
 * Use TEAM_PERMISSIONS_BY_ROLE from permissions-registry instead.
 */
export interface MergedTeamRolesConfig {
    coreTeamRoles: readonly string[];
    availableTeamRoles: readonly string[];
    defaultTeamRole: string;
    hierarchy: Record<string, number>;
    displayNames: Record<string, string>;
    descriptions: Record<string, string>;
}
/**
 * Merged roles configuration result
 * Contains core roles + theme additions with validation applied
 */
export interface MergedRolesConfig {
    coreRoles: readonly string[];
    availableRoles: readonly string[];
    defaultRole: string;
    hierarchy: Record<string, number>;
    displayNames: Record<string, string>;
    descriptions: Record<string, string>;
}
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
export declare function mergeRolesConfig(coreConfig: CoreRolesConfig, themeConfig?: ThemeRolesConfig): MergedRolesConfig;
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
export declare function mergeTeamRolesConfig(coreConfig: CoreTeamRolesConfig, themeConfig?: ThemeTeamRolesConfig): MergedTeamRolesConfig;
//# sourceMappingURL=roles-merge.d.ts.map