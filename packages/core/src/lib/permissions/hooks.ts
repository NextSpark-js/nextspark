'use client'

import { useMemo } from 'react'
import { useTeamContext, useOptionalTeamContext } from '../../contexts/TeamContext'
import { hasTeamPermission, teamPermissionsFor } from './app-role-bypass'
import type { Permission, TeamRole } from './types'
import type { Team, UserTeamMembership } from '../teams/types'

/** The user's role in the current team, null when there is no current team or no membership in it. */
function currentTeamRole(currentTeam: Team | null | undefined, userTeams: UserTeamMembership[] | undefined): string | null {
  if (!currentTeam || !userTeams) return null
  return userTeams.find(t => t.team.id === currentTeam.id)?.role ?? null
}

// Every hook below decides with hasTeamPermission, the same rule as the server's checkPermission (#457).

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
  const { currentTeam, userTeams, appRole } = useTeamContext()

  return useMemo(
    () => hasTeamPermission(appRole, currentTeamRole(currentTeam, userTeams), permission),
    [currentTeam, userTeams, appRole, permission]
  )
}

/**
 * Like usePermission, but false (instead of throwing) outside a TeamProvider. For public hooks that can be
 * used in a tree without one.
 */
export function useOptionalPermission(permission: Permission): boolean {
  const team = useOptionalTeamContext()
  const currentTeam = team?.currentTeam
  const userTeams = team?.userTeams
  const appRole = team?.appRole

  return useMemo(
    () => hasTeamPermission(appRole, currentTeamRole(currentTeam, userTeams), permission),
    [currentTeam, userTeams, appRole, permission]
  )
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
  const { currentTeam, userTeams, appRole } = useTeamContext()

  return useMemo(() => {
    const result: Record<string, boolean> = {}
    const teamRole = currentTeamRole(currentTeam, userTeams)

    for (const [key, permission] of Object.entries(permissions)) {
      result[key] = hasTeamPermission(appRole, teamRole, permission)
    }

    return result as Record<keyof T, boolean>
  }, [currentTeam, userTeams, appRole, permissions])
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
  const { currentTeam, userTeams, appRole } = useTeamContext()

  return useMemo(
    () => teamPermissionsFor(appRole, currentTeamRole(currentTeam, userTeams)),
    [currentTeam, userTeams, appRole]
  )
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
