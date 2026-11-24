/**
 * The team an MCP authorization is for (#541).
 *
 * A grant is bound to one team. A user in one team gets it; a user in several picks it on /oauth/select-team after
 * signing in. The choice belongs to one authorization: it is kept under the browser session and the authorization
 * request's PKCE challenge, which the client makes anew for every request and the server signs with the rest of the
 * query. Two authorizations open at once in one browser therefore keep their own teams. The challenge is the
 * client's to choose, so a client could send the same one twice: a choice, once made, is not changed. Whatever
 * request carries that challenge gets the team the user chose first and the consent screen showed; choosing another
 * is refused, and the user starts again from the application. The authorization server reads the choice back as the consent's reference, which the access token then carries as `team_id`. It is checked
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

/** What identifies an authorization request: its PKCE challenge (43 to 128 URL-safe characters, RFC 7636). */
export function isAuthorizationKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value)
}

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

export type TeamChoice = 'chosen' | 'not-a-member' | 'already-chosen'

/**
 * Records the team chosen for an authorization. The first choice stands: `already-chosen` when another team was
 * chosen for it before (choosing the same team again is `chosen`).
 */
export async function selectTeam(sessionId: string, authorization: string, userId: string, teamId: string): Promise<TeamChoice> {
  if (!isAuthorizationKey(authorization)) return 'not-a-member'
  if (!(await selectableTeams(userId)).some(team => team.id === teamId)) return 'not-a-member'
  // the choices of authorizations that ended or were abandoned (a signed authorization query lives ten minutes)
  await query(`DELETE FROM "oauthTeamSelection" WHERE "createdAt" < now() - make_interval(mins => $1)`, [SELECTION_TTL_MINUTES])
  await query(
    `INSERT INTO "oauthTeamSelection" ("sessionId", "authorization", "teamId", "createdAt") VALUES ($1, $2, $3, now())
     ON CONFLICT ("sessionId", "authorization") DO NOTHING`,
    [sessionId, authorization, teamId]
  )
  // Read in a statement of its own: the row that won is committed by now, whichever request wrote it
  const stored = await queryOne<{ teamId: string }>(
    'SELECT "teamId" FROM "oauthTeamSelection" WHERE "sessionId" = $1 AND "authorization" = $2',
    [sessionId, authorization]
  )
  return stored?.teamId === teamId ? 'chosen' : 'already-chosen'
}

/** The team chosen for this authorization, if it was chosen recently and the user is still a member of it. */
export async function selectedTeam(sessionId: string, authorization: string | undefined, userId: string): Promise<string | undefined> {
  if (!isAuthorizationKey(authorization)) return undefined
  const row = await queryOne<{ teamId: string }>(
    `SELECT s."teamId"
       FROM "oauthTeamSelection" s
       JOIN "team_members" tm ON tm."teamId" = s."teamId" AND tm."userId" = $3
       JOIN "teams" t ON t.id = s."teamId" AND t."deletedAt" IS NULL
      WHERE s."sessionId" = $1 AND s."authorization" = $2 AND s."createdAt" > now() - make_interval(mins => $4)`,
    [sessionId, authorization, userId, SELECTION_TTL_MINUTES]
  )
  return row?.teamId
}
