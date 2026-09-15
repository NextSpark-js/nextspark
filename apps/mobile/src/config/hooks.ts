/**
 * Permission hooks for mobile
 */

import { useMemo } from 'react'
import { useAuth } from '@nextsparkjs/mobile'
import { canDoAction, PERMISSIONS_CONFIG } from './permissions.config'

/**
 * Check if current user has permission to perform an action
 */
export function usePermission(action: string): boolean {
  const { team } = useAuth()

  return useMemo(() => {
    if (!team?.role) return false
    return canDoAction(team.role, action)
  }, [team?.role, action])
}

/**
 * Check multiple permissions at once
 */
export function usePermissions<T extends Record<string, string>>(
  permissions: T
): Record<keyof T, boolean> {
  const { team } = useAuth()

  return useMemo(() => {
    const result = {} as Record<keyof T, boolean>
    for (const [key, action] of Object.entries(permissions)) {
      result[key as keyof T] = team?.role ? canDoAction(team.role, action) : false
    }
    return result
  }, [team?.role, permissions])
}

/**
 * Get current team role
 */
export function useTeamRole(): string | null {
  const { team } = useAuth()
  return team?.role ?? null
}

/**
 * Check if user can perform entity action
 */
export function useEntityPermission(entity: 'tasks' | 'customers', action: string): boolean {
  const { team } = useAuth()

  return useMemo(() => {
    if (!team?.role) return false
    const entityPerms = PERMISSIONS_CONFIG.entities[entity]
    const perm = entityPerms.find(p => p.action === action)
    return perm ? perm.roles.includes(team.role) : false
  }, [team?.role, entity, action])
}
