/**
 * Which app roles (users.role) skip team permissions (#457).
 *
 * The project sets `teams.appRoleBypass` in app.config:
 * - 'none': every user follows their team role
 * - 'developer' (default): a developer skips team permissions, a superadmin follows their team role
 * - 'developer-and-superadmin': both skip team permissions
 *
 * "Skip" means: inside a team the user belongs to, every registered permission is granted whatever the team role.
 * It never grants anything in a team the user is not a member of. Every team-permission check, on the server
 * (checkPermission, checkTeamPermission, MembershipService, billing) and in the UI (the permission hooks), decides
 * through hasTeamPermission() here, so the two always agree. The admin area, the row-level security bypass and
 * acting as another user are separate rules this setting does not change.
 *
 * The setting is plain project config, already part of the client-safe app config.
 */

import { TEAMS_CONFIG } from '../config/config-client'
import { PermissionService } from '../services/permission.service'
import type { Permission } from './types'

export const APP_ROLE_BYPASS_VALUES = ['none', 'developer', 'developer-and-superadmin'] as const
export type AppRoleBypass = (typeof APP_ROLE_BYPASS_VALUES)[number]
export const DEFAULT_APP_ROLE_BYPASS: AppRoleBypass = 'developer'

const SKIPPING_ROLES: Record<AppRoleBypass, readonly string[]> = {
  none: [],
  developer: ['developer'],
  'developer-and-superadmin': ['developer', 'superadmin'],
}

/** The setting's value, the default when it is not set. An unknown value throws: a typo must not pick a rule. */
export function resolveAppRoleBypass(value: unknown): AppRoleBypass {
  if (value === undefined) return DEFAULT_APP_ROLE_BYPASS
  if ((APP_ROLE_BYPASS_VALUES as readonly unknown[]).includes(value)) return value as AppRoleBypass
  throw new Error(
    `teams.appRoleBypass in app.config must be one of ${APP_ROLE_BYPASS_VALUES.map(v => `'${v}'`).join(', ')}; got ${JSON.stringify(value)}`
  )
}

/** The project's setting (`teams.appRoleBypass`), read on each call. */
export function getAppRoleBypass(): AppRoleBypass {
  return resolveAppRoleBypass(TEAMS_CONFIG?.appRoleBypass)
}

/** Whether this app role skips team permissions under the project's setting. */
export function appRoleSkipsTeamPermissions(appRole: string | null | undefined): boolean {
  return !!appRole && SKIPPING_ROLES[getAppRoleBypass()].includes(appRole)
}

/**
 * The one team-permission decision: a user with app role `appRole` and team role `teamRole` (null: not a member)
 * holds `permission` in that team.
 */
export function hasTeamPermission(
  appRole: string | null | undefined,
  teamRole: string | null | undefined,
  permission: Permission
): boolean {
  if (!teamRole) return false
  if (appRoleSkipsTeamPermissions(appRole)) return PermissionService.isValid(permission)
  return PermissionService.hasPermission(teamRole, permission)
}

/** Every permission a user holds in a team, by the same rule as hasTeamPermission. */
export function teamPermissionsFor(appRole: string | null | undefined, teamRole: string | null | undefined): Permission[] {
  if (!teamRole) return []
  if (appRoleSkipsTeamPermissions(appRole)) return PermissionService.getAll()
  return PermissionService.getRolePermissions(teamRole)
}
