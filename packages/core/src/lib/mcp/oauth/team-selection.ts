/**
 * The team an MCP authorization is for (#541).
 *
 * A grant is bound to one team. A user in one team gets it; a user in several picks it on /oauth/select-team after
 * signing in. The choice is kept per browser session for the minutes an authorization takes, and the authorization
 * server reads it back as the consent's reference, which the access token then carries as `team_id`. It is checked
 * against the user's memberships when it is written and again when it is read.
 *
 * Service connection: Better Auth calls these with no user context, as it does for its own tables.
 */
import { query, queryOne, queryRows } from '../../db'

export interface SelectableTeam {
  id: string
  name: string
  role: string
}

const SELECTION_TTL_MINUTES = 15

/** The teams the user can connect: current memberships in teams that are not deleted. */
export function selectableTeams(userId: string): Promise<SelectableTeam[]> {
  return queryRows<SelectableTeam>(
    `SELECT t.id, t.name, tm.role
       FROM "team_members" tm JOIN "teams" t ON t.id = tm."teamId"
      WHERE tm."userId" = $1 AND t."deletedAt" IS NULL
      ORDER BY t.name`,
    [userId]
  )
}

/** Records the team chosen in this session, replacing an earlier choice. False when the user is not a member. */
export async function selectTeam(sessionId: string, userId: string, teamId: string): Promise<boolean> {
  if (!(await selectableTeams(userId)).some(team => team.id === teamId)) return false
  await query(
    `INSERT INTO "oauthTeamSelection" ("sessionId", "teamId", "createdAt") VALUES ($1, $2, now())
     ON CONFLICT ("sessionId") DO UPDATE SET "teamId" = EXCLUDED."teamId", "createdAt" = now()`,
    [sessionId, teamId]
  )
  return true
}

export async function clearTeamSelection(sessionId: string): Promise<void> {
  await query('DELETE FROM "oauthTeamSelection" WHERE "sessionId" = $1', [sessionId])
}

/** The team chosen in this session, if it was chosen recently and the user is still a member of it. */
export async function selectedTeam(sessionId: string, userId: string): Promise<string | undefined> {
  const row = await queryOne<{ teamId: string }>(
    `SELECT s."teamId"
       FROM "oauthTeamSelection" s
       JOIN "team_members" tm ON tm."teamId" = s."teamId" AND tm."userId" = $2
       JOIN "teams" t ON t.id = s."teamId" AND t."deletedAt" IS NULL
      WHERE s."sessionId" = $1 AND s."createdAt" > now() - make_interval(mins => $3)`,
    [sessionId, userId, SELECTION_TTL_MINUTES]
  )
  return row?.teamId
}
