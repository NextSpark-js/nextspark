'use client'

import { useMemo } from 'react'
import { useTeamContext } from '../../contexts/TeamContext'
// Import from ./init to ensure permission registry is initialized on client-side
import { permissionRegistry } from './init'
import type { Permission, TeamRole } from './types'

/**
 * Hook to check a single permission in the current team
 *
 * @param permission - Permission ID to check (e.g., "customers.create")
 * @returns true if the current user has the permission in the current team
 *
 * @example
 * ```tsx
 * const canCreate = usePermission('customers.create')
 *
 * return canCreate ? <CreateButton /> : null
 * ```
 */
export function usePermission(permission: Permission): boolean {
  const { currentTeam, userTeams } = useTeamContext()

  return useMemo(() => {
    if (!currentTeam) return false

    // Find user's membership in current team
    const membership = userTeams.find(t => t.team.id === currentTeam.id)
    if (!membership?.role) return false

    return permissionRegistry.hasPermission(membership.role as TeamRole, permission)
  }, [currentTeam, userTeams, permission])
}

/**
 * Hook to check multiple permissions
 *
 * @param permissions - Object mapping keys to permission IDs
 * @returns Object with same keys, values are boolean (has permission or not)
 *
 * @example
 * ```tsx
 * const { canCreate, canDelete } = usePermissions({
 *   canCreate: 'customers.create',
 *   canDelete: 'customers.delete',
 * })
 *
 * return (
 *   <>
 *     {canCreate && <CreateButton />}
 *     {canDelete && <DeleteButton />}
 *   </>
 * )
 * ```
 */
export function usePermissions<T extends Record<string, Permission>>(
  permissions: T
): Record<keyof T, boolean> {
  const { currentTeam, userTeams } = useTeamContext()

  return useMemo(() => {
    const result: Record<string, boolean> = {}

    // Find user's membership in current team
    const membership = currentTeam
      ? userTeams.find(t => t.team.id === currentTeam.id)
      : null

    for (const [key, permission] of Object.entries(permissions)) {
      if (!membership?.role) {
        result[key] = false
      } else {
        result[key] = permissionRegistry.hasPermission(
          membership.role as TeamRole,
          permission
        )
      }
    }

    return result as Record<keyof T, boolean>
  }, [currentTeam, userTeams, permissions])
}

/**
 * Hook to get all permissions of the current user in the current team
 *
 * @returns Array of permission IDs the user has
 *
 * @example
 * ```tsx
 * const permissions = useAllPermissions()
 * console.log('User has', permissions.length, 'permissions')
 * ```
 */
export function useAllPermissions(): Permission[] {
  const { currentTeam, userTeams } = useTeamContext()

  return useMemo(() => {
    if (!currentTeam) return []

    const membership = userTeams.find(t => t.team.id === currentTeam.id)
    if (!membership?.role) return []

    return permissionRegistry.getRolePermissions(membership.role as TeamRole)
  }, [currentTeam, userTeams])
}

/**
 * Hook to get the current user's team role
 *
 * @returns Team role (owner, admin, member, viewer) or null if no team
 *
 * @example
 * ```tsx
 * const role = useTeamRole()
 * return <Badge>{role}</Badge>
 * ```
 */
export function useTeamRole(): TeamRole | null {
  const { currentTeam, userTeams } = useTeamContext()

  return useMemo(() => {
    if (!currentTeam) return null

    const membership = userTeams.find(t => t.team.id === currentTeam.id)
    return (membership?.role as TeamRole) ?? null
  }, [currentTeam, userTeams])
}
