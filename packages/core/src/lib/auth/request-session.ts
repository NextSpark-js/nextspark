/**
 * Request Session
 *
 * Who a server component's request is, taken from the verified session (the cookie or bearer token
 * better-auth checks), once per request: the dashboard layouts' permission checks and the
 * /superadmin and /devtools access checks all ask. Never from identity headers (`x-user-id`,
 * `x-user-email`, `x-active-team-id`): core's proxy template sets them only from a verified
 * session, but a project that owns its proxy may forward whatever the client sent.
 */
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { getTypedSession, type TypedSession } from '../auth'
import { getAuthorizationSession } from './authorization-session'
import { ACTIVE_TEAM_COOKIE, activeTeamIdForSession } from '../teams/active-team-cookie'
import { getDashboardMembership } from '../teams/dashboard-team'
import { ensureEntityPermissionsLoaded } from '../permissions/init'
import { hasTeamPermission } from '../permissions/app-role-bypass'
import type { Permission } from '../permissions/types'

/** The request's verified session, or null; one lookup per request however many callers ask. */
export const getRequestSession = cache(async (): Promise<TypedSession | null> => getTypedSession(await headers()))

/**
 * The same, read from the database instead of better-auth's cookie cache, once per request: the /superadmin and
 * /devtools checks use it, so a sign-out or a role change counts at once (lib/auth/authorization-session.ts).
 */
export const getAuthorizationRequestSession = cache(async (): Promise<TypedSession | null> => getAuthorizationSession(await headers()))

/** The team the session chose (the activeTeamId cookie, only when this session wrote it), or null. */
export async function getSessionActiveTeamId(session: TypedSession): Promise<string | null> {
  return activeTeamIdForSession((await cookies()).get(ACTIVE_TEAM_COOKIE)?.value, session.session?.id)
}

/**
 * The user and team a dashboard request's permissions are checked for: the verified session's user, and the team
 * its session chose while the user still belongs to it, else their default team (getDashboardMembership). No session,
 * no user; a user in no team, no team. `teamRole` and `appRole` come from the same query that resolved the team
 * (the role of that team, and users.role read from the database in this request), so deciding costs no second
 * membership read.
 */
export async function getDashboardPermissionContext(): Promise<{
  userId: string | null
  teamId: string | null
  teamRole: string | null
  appRole: string | null
}> {
  const none = { userId: null, teamId: null, teamRole: null, appRole: null }
  const session = await getRequestSession()
  const userId = session?.user?.id ?? null
  if (!session || !userId) return none
  const membership = await getDashboardMembership(userId, await getSessionActiveTeamId(session))
  return { userId, teamId: membership?.teamId ?? null, teamRole: membership?.teamRole ?? null, appRole: membership?.appRole ?? null }
}

/** checkPermission's decision (hasTeamPermission) for a context getDashboardPermissionContext returned, with no query. */
export function contextHasPermission(
  context: { teamRole: string | null; appRole: string | null },
  permission: Permission
): boolean {
  ensureEntityPermissionsLoaded()
  return hasTeamPermission(context.appRole, context.teamRole, permission)
}
