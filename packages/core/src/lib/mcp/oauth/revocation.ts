/**
 * Ending an MCP connection before its access token expires (#541).
 *
 * An access token is a signed JWT that lives ten minutes. The database records every event that ends a connection
 * (migration 048, by triggers: a live refresh token revoked or deleted, a changed password, a suspension) as a
 * numbered row for the user, and for the team unless it ends all of the user's connections.
 *
 * No clock is compared: a token is issued carrying the number of the newest such row for its user and team, and it
 * is refused once a newer one exists. A revocation in a team therefore also sends the user's other clients in that
 * team back to the token endpoint, where a live refresh token gets a new access token and a revoked one does not.
 */
import { queryOne } from '../../db'

const COVERING = `"userId" = $1 AND ("teamId" IS NULL OR "teamId" = $2)`

/** The number of the newest revocation that covers the user in the team; 0 when there is none. */
export async function latestRevocation(userId: string, teamId: string): Promise<number> {
  const row = await queryOne<{ latest: string }>(
    `SELECT COALESCE(MAX(id), 0)::text AS latest FROM "oauthRevocation" WHERE ${COVERING}`,
    [userId, teamId]
  )
  return Number(row?.latest ?? 0)
}

/** Whether a revocation newer than the one the token was issued after covers the user in the team. */
export async function isRevokedSince(userId: string, teamId: string, issuedAfter: unknown): Promise<boolean> {
  if (typeof issuedAfter !== 'number' || !Number.isSafeInteger(issuedAfter) || issuedAfter < 0) return true
  const row = await queryOne<{ revoked: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM "oauthRevocation" WHERE ${COVERING} AND id > $3) AS revoked`,
    [userId, teamId, issuedAfter]
  )
  return row?.revoked !== false
}
