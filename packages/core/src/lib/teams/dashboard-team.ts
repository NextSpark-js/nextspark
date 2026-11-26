/**
 * Dashboard Team
 *
 * The team the dashboard layouts check permissions in: the one this session
 * chose (the activeTeamId cookie the session wrote, read from the verified
 * session by lib/auth/request-session, never from a proxy header). A session
 * that has not chosen one yet (it just signed in, or carries a cookie from an
 * earlier release) is checked in the user's default team rather than not
 * checked at all, until TeamProvider writes its choice.
 */
import { cache } from 'react'
import { queryOne } from '../db'

/**
 * The team a user joined first, among teams that still exist: the default that
 * resolveTeamContext and TeamProvider also fall back to.
 */
export async function getUserDefaultTeamId(userId: string): Promise<string | undefined> {
  try {
    const result = await queryOne<{ teamId: string }>(
      `SELECT tm."teamId" FROM "team_members" tm
       INNER JOIN "teams" t ON t.id = tm."teamId"
       WHERE tm."userId" = $1 AND t."deletedAt" IS NULL
       ORDER BY tm."joinedAt" ASC
       LIMIT 1`,
      [userId]
    )
    return result?.teamId
  } catch (error) {
    console.error('[teams] Failed to get default team:', error)
    return undefined
  }
}

/** A user's place in the team a dashboard request is checked in. */
export interface DashboardMembership {
  teamId: string
  /** team_members.role in that team. */
  teamRole: string
  /** users.role (the platform role), read from the database in this request, never from a cookie. */
  appRole: string | null
}

/**
 * One lookup per request for a user and the team their session chose: the
 * dashboard layout and the entity layout under it both ask. The arguments are
 * strings so React's request cache matches them across callers. It returns the
 * team and both roles, so the permission check needs no second membership read.
 */
const findDashboardMembership = cache(async (userId: string, chosenTeamId: string | null): Promise<DashboardMembership | null> => {
  const result = await queryOne<{ teamId: string; teamRole: string; appRole: string | null }>(
    `SELECT tm."teamId", tm.role AS "teamRole", u.role AS "appRole" FROM "team_members" tm
     INNER JOIN "teams" t ON t.id = tm."teamId"
     LEFT JOIN "users" u ON u.id = tm."userId"
     WHERE tm."userId" = $1 AND t."deletedAt" IS NULL
     ORDER BY (tm."teamId" = $2) IS TRUE DESC, tm."joinedAt" ASC
     LIMIT 1`,
    [userId, chosenTeamId]
  )
  return result?.teamId ? { teamId: result.teamId, teamRole: result.teamRole, appRole: result.appRole ?? null } : null
})

/** The membership to check a dashboard request's permissions with (see getDashboardTeamId), or null in no team. */
export function getDashboardMembership(userId: string, chosenTeamId: string | null): Promise<DashboardMembership | null> {
  return findDashboardMembership(userId, chosenTeamId)
}

/**
 * The team to check a dashboard request's permissions in, or null when the user
 * belongs to none. The team the session chose counts only while the user is
 * still a member and the team still exists: someone else may have removed them
 * or deleted it since, and then the default team is used, as when there is no
 * choice at all. One query answers both.
 *
 * A failed query rejects instead of answering null: the layouts skip the
 * permission check for a user in no team, so an error read as "no team" would
 * let the request through unchecked.
 */
export async function getDashboardTeamId(userId: string, chosenTeamId: string | null): Promise<string | null> {
  return (await findDashboardMembership(userId, chosenTeamId))?.teamId ?? null
}
