import { permissionRegistry, ensureEntityPermissionsLoaded } from './init'  // Import from init to ensure initialization
import type { Permission, TeamRole } from './types'
import { queryOneWithRLS } from '../db'

/**
 * Get the team member role for a user in a specific team
 *
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns Team role or null if not a member
 */
async function getTeamMemberRole(userId: string, teamId: string): Promise<string | null> {
  const result = await queryOneWithRLS<{ role: string }>(
    `SELECT role
     FROM "team_members"
     WHERE "userId" = $1
       AND "teamId" = $2
     LIMIT 1`,
    [userId, teamId]
  )

  return result?.role || null
}

/**
 * Check if current user has a permission in the current team
 *
 * SERVER USAGE:
 * ```typescript
 * if (!await checkPermission(userId, teamId, 'customers.create')) {
 *   return createApiError('Permission denied', 403)
 * }
 * ```
 *
 * @param userId - User ID to check
 * @param teamId - Team ID where permission is being checked
 * @param permission - Permission to check
 * @returns true if user has the permission
 */
export async function checkPermission(
  userId: string,
  teamId: string,
  permission: Permission
): Promise<boolean> {
  // Ensure entity permissions are loaded (handles lazy initialization)
  ensureEntityPermissionsLoaded()

  // 1. Get user's role in the team
  const teamRole = await getTeamMemberRole(userId, teamId)

  if (!teamRole) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[checkPermission] User ${userId} is not a member of team ${teamId}`)
    }
    return false // User is not a member of the team
  }

  // 2. Check permission in registry
  const hasPermission = permissionRegistry.hasPermission(teamRole as TeamRole, permission)

  // Debug logging only in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[checkPermission] Role: ${teamRole}, Perm: ${permission}, Has: ${hasPermission}`)
  }

  return hasPermission
}

/**
 * Check multiple permissions (AND - all required)
 *
 * @param userId - User ID to check
 * @param teamId - Team ID where permissions are being checked
 * @param permissions - Array of permissions to check
 * @returns true if user has ALL permissions
 *
 * @example
 * ```typescript
 * const canEditAndDelete = await checkPermissions(userId, teamId, [
 *   'customers.update',
 *   'customers.delete'
 * ])
 * ```
 */
export async function checkPermissions(
  userId: string,
  teamId: string,
  permissions: Permission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!await checkPermission(userId, teamId, permission)) {
      return false
    }
  }
  return true
}

/**
 * Check at least one permission (OR - any is sufficient)
 *
 * @param userId - User ID to check
 * @param teamId - Team ID where permissions are being checked
 * @param permissions - Array of permissions to check
 * @returns true if user has AT LEAST ONE permission
 *
 * @example
 * ```typescript
 * const canModify = await checkAnyPermission(userId, teamId, [
 *   'customers.update',
 *   'customers.delete'
 * ])
 * ```
 */
export async function checkAnyPermission(
  userId: string,
  teamId: string,
  permissions: Permission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await checkPermission(userId, teamId, permission)) {
      return true
    }
  }
  return false
}

/**
 * Get all permissions for a user in a team
 *
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns Array of permission IDs the user has
 *
 * @example
 * ```typescript
 * const userPerms = await getUserPermissions(userId, teamId)
 * console.log('User permissions:', userPerms)
 * ```
 */
export async function getUserPermissions(
  userId: string,
  teamId: string
): Promise<Permission[]> {
  const teamRole = await getTeamMemberRole(userId, teamId)

  if (!teamRole) {
    return []
  }

  return permissionRegistry.getRolePermissions(teamRole as TeamRole)
}

/**
 * Check permission synchronously (when you already have the role)
 *
 * Useful in contexts where you've already fetched the role
 *
 * @param teamRole - Team role
 * @param permission - Permission to check
 * @returns true if the role has the permission
 *
 * @example
 * ```typescript
 * // When you already have the role from context
 * const canCreate = hasPermissionSync(userRole, 'customers.create')
 * ```
 */
export function hasPermissionSync(
  teamRole: TeamRole,
  permission: Permission
): boolean {
  return permissionRegistry.hasPermission(teamRole, permission)
}
