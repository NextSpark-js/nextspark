/**
 * Teams Core System - Permission System
 *
 * Defines permissions matrix and permission checking logic for teams.
 *
 * Phase 2 Simplification:
 * - Global roles: only 'member' and 'superadmin' (5 → 2)
 * - Team roles: unchanged (owner, admin, member, viewer)
 * - Superadmin bypasses all team permissions
 * - Member permissions determined by team role only
 *
 * Phase 5 Dynamic System:
 * - Permissions, hierarchy, and invitable roles read from merged config
 * - Themes can add custom roles via app.config.ts
 * - No need to edit this file when adding new roles
 *
 * Phase 6 Unified Permissions:
 * - All team permissions now read from permissions-registry
 * - Single source of truth: permissions.config.ts
 * - Uses TEAM_PERMISSIONS_BY_ROLE for O(1) lookups
 */
/**
 * Global user roles (simplified Phase 2)
 */
export type UserRole = 'member' | 'superadmin';
/**
 * Team-specific permissions
 */
export type TeamPermission = 'team.view' | 'team.edit' | 'team.delete' | 'team.members.view' | 'team.members.invite' | 'team.members.remove' | 'team.members.update_role' | 'team.settings.view' | 'team.settings.edit' | 'team.billing.view' | 'team.billing.manage';
/**
 * All available team permissions
 * Used for visualization and validation
 */
export declare const ALL_TEAM_PERMISSIONS: TeamPermission[];
/**
 * Permissions matrix by team role
 *
 * This export reads from permissions-registry, the single source of truth.
 * Used by visualization components like RolesPermissionsMatrix.
 *
 * Note: For permission checking, use hasPermission() or checkTeamPermission()
 */
export declare const rolePermissions: Record<string, TeamPermission[]>;
/**
 * Check if a team role has a specific permission
 *
 * @param role - The team role to check (supports custom roles)
 * @param permission - The permission to check for
 * @param isGlobalAdmin - Whether the user is a global admin (bypasses team permissions)
 * @returns True if the role has the permission, false otherwise
 */
export declare function hasPermission(role: string, permission: TeamPermission, isGlobalAdmin?: boolean): boolean;
/**
 * Get all permissions for a team role
 *
 * @param role - The team role (supports custom roles)
 * @param isGlobalAdmin - Whether the user is a global admin
 * @returns Array of permissions for the role
 */
export declare function getRolePermissions(role: string, isGlobalAdmin?: boolean): TeamPermission[];
/**
 * Check team permission with simplified Phase 2 roles
 *
 * This is the recommended function for permission checking.
 * - Superadmin: bypasses all permissions (returns true)
 * - Member: checks team role for permission
 *
 * @param userRole - The user's global role ('member' or 'superadmin')
 * @param teamRole - The user's role in the team (null if not a member)
 * @param permission - The permission to check
 * @returns True if the user has the permission
 */
export declare function checkTeamPermission(userRole: UserRole, teamRole: string | null, permission: TeamPermission): boolean;
/**
 * Check if user is superadmin
 *
 * @param userRole - The user's global role
 * @returns True if user is superadmin
 */
export declare function isSuperadmin(userRole: UserRole): boolean;
/**
 * Check if a role can perform an action on another role
 * Used for member management (e.g., can admin remove owner?)
 *
 * Now reads hierarchy from merged config, supporting custom roles.
 *
 * @param actorRole - The role of the user performing the action
 * @param targetRole - The role of the user being acted upon
 * @returns True if action is allowed, false otherwise
 */
export declare function canManageRole(actorRole: string, targetRole: string): boolean;
/**
 * Get human-readable role description
 *
 * Reads from merged config, supporting custom role descriptions.
 *
 * @param role - The team role
 * @returns Description of the role
 */
export declare function getRoleDescription(role: string): string;
/**
 * Check if a role can be assigned via invitation
 * (e.g., can't invite someone as owner)
 *
 * @param role - The role to check
 * @returns True if the role can be assigned via invitation
 */
export declare function isInvitableRole(role: string): boolean;
/**
 * Get available roles for invitation
 * Returns all roles except owner, read from merged config.
 *
 * Now supports custom roles added by themes.
 */
export declare function getInvitableRoles(): string[];
/**
 * Validate role transition
 * Check if changing from one role to another is allowed
 *
 * @param fromRole - Current role
 * @param toRole - New role
 * @param actorRole - Role of user making the change
 * @returns Object with { allowed: boolean, reason?: string }
 */
export declare function validateRoleTransition(fromRole: string, toRole: string, actorRole: string): {
    allowed: boolean;
    reason?: string;
};
//# sourceMappingURL=permissions.d.ts.map