/**
 * Teams Core System - Permission System
 *
 * Defines permissions matrix and permission checking logic for teams.
 *
 * Phase 2 Simplification:
 * - Global roles: only 'member' and 'superadmin' (5 → 2)
 * - Team roles: unchanged (owner, admin, member, viewer)
 * - Which app roles skip team permissions: `teams.appRoleBypass` (#457, see ../permissions/app-role-bypass)
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

import type { TeamRole } from './types'
import {
  TEAM_PERMISSIONS_BY_ROLE,
  AVAILABLE_ROLES,
  ROLE_HIERARCHY,
  ROLE_DESCRIPTIONS,
} from '@nextsparkjs/registries/permissions-registry'
import { hasTeamPermission, appRoleSkipsTeamPermissions } from '../permissions/app-role-bypass'
import type { Permission } from '../permissions/types'

/**
 * Global user roles (simplified Phase 2)
 */
export type UserRole = 'member' | 'superadmin' | 'developer'

/**
 * Team-specific permissions
 */
export type TeamPermission =
  | 'team.view'
  | 'team.edit'
  | 'team.delete'
  | 'team.members.view'
  | 'team.members.invite'
  | 'team.members.remove'
  | 'team.members.update_role'
  | 'team.settings.view'
  | 'team.settings.edit'
  | 'team.billing.view'      // Future: Phase 2
  | 'team.billing.manage'    // Future: Phase 2

/**
 * All available team permissions
 * Used for visualization and validation
 */
export const ALL_TEAM_PERMISSIONS: TeamPermission[] = [
  'team.view',
  'team.edit',
  'team.delete',
  'team.members.view',
  'team.members.invite',
  'team.members.remove',
  'team.members.update_role',
  'team.settings.view',
  'team.settings.edit',
  'team.billing.view',
  'team.billing.manage',
]

// =============================================================================
// REGISTRY ACCESS (Single source of truth: permissions.config.ts)
// =============================================================================

/**
 * Get role permissions from permissions-registry
 * Uses TEAM_PERMISSIONS_BY_ROLE for O(1) lookups
 */
function getPermissionsFromRegistry(): Record<string, TeamPermission[]> {
  return TEAM_PERMISSIONS_BY_ROLE as Record<string, TeamPermission[]>
}

/**
 * Get role hierarchy from permissions-registry
 */
function getHierarchyFromRegistry(): Record<string, number> {
  return ROLE_HIERARCHY
}

/**
 * Get available team roles from permissions-registry
 */
function getAvailableRolesFromRegistry(): readonly string[] {
  return AVAILABLE_ROLES
}

/**
 * Get role descriptions from permissions-registry
 */
function getDescriptionsFromRegistry(): Record<string, string> {
  return ROLE_DESCRIPTIONS
}

// =============================================================================
// EXPORTED PERMISSIONS MAP (for visualization components)
// =============================================================================

/**
 * Permissions matrix by team role
 *
 * This export reads from permissions-registry, the single source of truth.
 * Used by visualization components like RolesPermissionsMatrix.
 *
 * Note: For permission checking, use hasPermission() or checkTeamPermission()
 */
export const rolePermissions: Record<string, TeamPermission[]> = getPermissionsFromRegistry()

// =============================================================================
// PERMISSION CHECKING FUNCTIONS
// =============================================================================

/**
 * Check if a team role has a specific permission
 *
 * @param role - The team role to check (supports custom roles)
 * @param permission - The permission to check for
 * @param isGlobalAdmin - Whether the user is a global admin (bypasses team permissions)
 * @returns True if the role has the permission, false otherwise
 */
export function hasPermission(
  role: string,
  permission: TeamPermission,
  isGlobalAdmin: boolean = false
): boolean {
  // Global admins have all permissions
  if (isGlobalAdmin) {
    return true
  }

  // Get permissions from registry
  const permissions = getPermissionsFromRegistry()

  // Check if role has the specific permission
  return permissions[role]?.includes(permission) || false
}

/**
 * Get all permissions for a team role
 *
 * @param role - The team role (supports custom roles)
 * @param isGlobalAdmin - Whether the user is a global admin
 * @returns Array of permissions for the role
 */
export function getRolePermissions(
  role: string,
  isGlobalAdmin: boolean = false
): TeamPermission[] {
  // Global admins have all permissions
  if (isGlobalAdmin) {
    return ALL_TEAM_PERMISSIONS
  }

  const permissions = getPermissionsFromRegistry()
  return permissions[role] || []
}

/**
 * Check team permission: the same decision as checkPermission, MembershipService and the UI hooks
 * (hasTeamPermission, #457)
 *
 * - Not a member of the team (no team role): no permission, whatever the app role
 * - An app role that `teams.appRoleBypass` lets skip team permissions (default: developer): every registered
 *   permission
 * - Anyone else: what the team role grants (owner: every registered permission)
 *
 * @param userRole - The user's global role ('member', 'superadmin' or 'developer')
 * @param teamRole - The user's role in the team (null if not a member)
 * @param permission - The permission to check
 * @returns True if the user has the permission
 */
export function checkTeamPermission(
  userRole: UserRole,
  teamRole: string | null,
  permission: TeamPermission
): boolean {
  return hasTeamPermission(userRole, teamRole, permission as Permission)
}

/**
 * Check if user is superadmin
 *
 * @param userRole - The user's global role
 * @returns True if user is superadmin
 */
export function isSuperadmin(userRole: UserRole): boolean {
  return userRole === 'superadmin'
}

// =============================================================================
// ROLE HIERARCHY FUNCTIONS (Dynamic from config)
// =============================================================================

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
export function canManageRole(
  actorRole: string,
  targetRole: string
): boolean {
  const hierarchy = getHierarchyFromRegistry()

  // Can only manage roles lower in hierarchy
  return (hierarchy[actorRole] ?? 0) > (hierarchy[targetRole] ?? 0)
}

/**
 * The role a user's role-hierarchy checks (canManageRole, canInviteToRole, validateRoleTransition) run with (#458).
 *
 * A user whose app role `teams.appRoleBypass` lets skip team permissions holds every permission in a team they
 * belong to, as an owner does, so the hierarchy treats them as an owner too: they manage every role below the owner
 * (invite, remove, change it) and, like an owner, cannot remove the owner or change the owner's role. Anyone else
 * runs with their team role. Not a member (no team role): null, which the callers deny.
 *
 * Transferring ownership is not a hierarchy check: only the team's owner does it, whatever this returns.
 *
 * @param appRole - The user's app role (users.role)
 * @param teamRole - The user's role in the team (null if not a member)
 */
export function hierarchyRoleFor(
  appRole: string | null | undefined,
  teamRole: string | null | undefined
): string | null {
  if (!teamRole) return null
  return appRoleSkipsTeamPermissions(appRole) ? 'owner' : teamRole
}

/**
 * Check if a role can invite another role to the team
 *
 * Reads hierarchy from the merged permissions registry, so any roles added
 * by consumers via additional config are supported automatically.
 *
 * Semantics: the same rule as a role change (validateRoleTransition): the
 * actor's hierarchy level must be strictly greater than the invited role's.
 * An admin invites members and viewers, not another admin; only a higher
 * role (the owner, in core's roles) invites an admin.
 *
 * Missing hierarchy entries are treated as 0, mirroring canManageRole.
 *
 * @param actorRole - The role of the user issuing the invitation
 * @param targetRole - The role the invitee would receive
 * @returns True if the invitation is allowed, false otherwise
 */
export function canInviteToRole(
  actorRole: string,
  targetRole: string
): boolean {
  return canManageRole(actorRole, targetRole)
}

/**
 * Get human-readable role description
 *
 * Reads from merged config, supporting custom role descriptions.
 *
 * @param role - The team role
 * @returns Description of the role
 */
export function getRoleDescription(role: string): string {
  const descriptions = getDescriptionsFromRegistry()
  return descriptions[role] ?? 'No description available'
}

// =============================================================================
// INVITABLE ROLES FUNCTIONS (Dynamic from config)
// =============================================================================

/**
 * Check if a role can be assigned via invitation
 * (e.g., can't invite someone as owner)
 *
 * @param role - The role to check
 * @returns True if the role can be assigned via invitation
 */
export function isInvitableRole(role: string): boolean {
  // Owner role can only be transferred, not invited
  return role !== 'owner'
}

/**
 * Get available roles for invitation
 * Returns all roles except owner, read from merged config.
 *
 * Now supports custom roles added by themes.
 */
export function getInvitableRoles(): string[] {
  const availableRoles = getAvailableRolesFromRegistry()
  // Exclude 'owner' - cannot be invited as owner
  return [...availableRoles].filter(role => role !== 'owner')
}

// =============================================================================
// ROLE TRANSITION VALIDATION
// =============================================================================

/**
 * Validate role transition
 * Check if changing from one role to another is allowed.
 *
 * The actor must strictly outrank BOTH the current role and the new role.
 *
 * @param fromRole - Current role
 * @param toRole - New role
 * @param actorRole - Role of user making the change
 * @returns Object with { allowed: boolean, reason?: string }
 */
export function validateRoleTransition(
  fromRole: string,
  toRole: string,
  actorRole: string
): { allowed: boolean; reason?: string } {
  // Cannot change owner role (must use ownership transfer)
  if (fromRole === 'owner') {
    return {
      allowed: false,
      reason: 'Owner role cannot be changed. Use ownership transfer instead.',
    }
  }

  // Cannot promote to owner via role change
  if (toRole === 'owner') {
    return {
      allowed: false,
      reason: 'Cannot promote to owner. Use ownership transfer instead.',
    }
  }

  // Check if actor can manage the target's CURRENT role
  if (!canManageRole(actorRole, fromRole)) {
    return {
      allowed: false,
      reason: 'You do not have permission to change this user\'s role.',
    }
  }

  // Check if actor outranks the DESTINATION role as well. Without this an
  // actor could promote anyone below them to any level, including above the
  // actor's own (issue #89).
  if (!canManageRole(actorRole, toRole)) {
    return {
      allowed: false,
      reason: 'You cannot assign a role equal to or higher than your own.',
    }
  }

  return { allowed: true }
}
