/**
 * The team-permission decision for a caller that already holds the roles (#571).
 *
 * `checkPermission(userId, teamId, permission)` reads the team role and the app role from the database before it
 * decides. A server layout that has verified the session of this request already has both: decide here with no
 * query. These are the same rules as `checkPermission` (including `teams.appRoleBypass`), and, as there,
 * `ensureEntityPermissionsLoaded()` runs before the decision.
 *
 * Contract for the caller:
 * - `appRole` and `teamRole` come from the verified session of THIS request, and `teamRole` is the role in THIS
 *   `teamId`. Never take them from a cookie, a query string or a value kept between requests.
 * - Read the session without Better Auth's cookie cache (5 minutes by default, where a demoted or suspended user keeps
 *   the old role): `getAuthorizationSession(headers)` from `@nextsparkjs/core/lib/auth/authorization-session`, or
 *   `auth.api.getSession` with `query: { disableCookieCache: true }`. `teamRole` is the `role` of the user's row in
 *   `team_members` for this `teamId`, read in this request.
 * - `teamRole` null or undefined means "not a member of the team": no permission, whatever the app role.
 *
 * This module does not import the database layer, so it can be imported where `lib/permissions/check` cannot.
 *
 * @example
 * // app/dashboard/[entity]/layout.tsx (server component)
 * import { headers } from 'next/headers'
 * import { notFound } from 'next/navigation'
 * import { hasTeamPermission } from '@nextsparkjs/core/lib/permissions/role-check'
 * import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
 * import { TeamMemberService } from '@nextsparkjs/core/lib/services'
 *
 * // teamId: the team of the route (a param), or the session's active team, as the screen defines it
 * const session = await getAuthorizationSession(await headers())
 * const membership = session ? await TeamMemberService.getByTeamAndUser(teamId, session.user.id) : null
 * if (!hasTeamPermission(session?.user.role, membership?.role, 'customers.read')) notFound()
 */

import { ensureEntityPermissionsLoaded } from './init'
import {
  appRoleSkipsTeamPermissions as appRoleSkips,
  hasTeamPermission as hasPermission,
  teamPermissionsFor as permissionsFor,
} from './app-role-bypass'
import type { Permission } from './types'

type Role = string | null | undefined

/** Whether `appRole` skips team permissions under the project's `teams.appRoleBypass`. */
export function appRoleSkipsTeamPermissions(appRole: Role): boolean {
  return appRoleSkips(appRole)
}

/** Whether a user with app role `appRole` and team role `teamRole` holds `permission` in that team. */
export function hasTeamPermission(appRole: Role, teamRole: Role, permission: Permission): boolean {
  ensureEntityPermissionsLoaded()
  return hasPermission(appRole, teamRole, permission)
}

/** Every permission a user holds in a team, by the same rule as `hasTeamPermission`. */
export function teamPermissionsFor(appRole: Role, teamRole: Role): Permission[] {
  ensureEntityPermissionsLoaded()
  return permissionsFor(appRole, teamRole)
}
