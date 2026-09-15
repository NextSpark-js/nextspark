/**
 * Dashboard Team
 *
 * The team the dashboard layouts check permissions in: the one this session
 * chose, which the proxy forwards as x-active-team-id from a cookie the session
 * wrote. A session that has not chosen one yet (it just signed in, or carries a
 * cookie from an earlier release) is checked in the user's default team rather
 * than not checked at all, until TeamProvider writes its choice.
 */
import { cache } from 'react'
import { queryOne } from '../db'

/** The header the proxy forwards the session's active team in. */
export const ACTIVE_TEAM_HEADER = 'x-active-team-id'

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

/**
 * One lookup per request for a user and the team their session chose: the
 * dashboard layout and the entity layout under it both ask. The arguments are
 * strings so React's request cache matches them across callers.
 */
const findDashboardTeamId = cache(async (userId: string, chosenTeamId: string | null): Promise<string | null> => {
  const result = await queryOne<{ teamId: string }>(
    `SELECT tm."teamId" FROM "team_members" tm
     INNER JOIN "teams" t ON t.id = tm."teamId"
     WHERE tm."userId" = $1 AND t."deletedAt" IS NULL
     ORDER BY (tm."teamId" = $2) IS TRUE DESC, tm."joinedAt" ASC
     LIMIT 1`,
    [userId, chosenTeamId]
  )
  return result?.teamId ?? null
})

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
export function getDashboardTeamId(headers: Pick<Headers, 'get'>, userId: string): Promise<string | null> {
  return findDashboardTeamId(userId, headers.get(ACTIVE_TEAM_HEADER))
}
