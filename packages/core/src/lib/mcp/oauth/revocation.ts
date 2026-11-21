/**
 * Ending an MCP connection before its access token expires (#541).
 *
 * An access token is a signed JWT that lives ten minutes. The database records every event that ends a connection
 * (migration 048, by triggers) as a numbered row for the user: with the client and the team when one connection
 * ended (a live refresh token revoked or deleted), with neither when all of the user's did (a changed password, a
 * suspension).
 *
 * No clock is compared: a token is issued carrying the number of the user's newest row, and it is refused once a
 * newer row covers it, that is, one for its own client and team or one for all of the user's connections. Another
 * client's connection, and the same client's connection to another team, are not touched.
 */
import { queryOne } from '../../db'

/** The number of the user's newest revocation of any kind; 0 when there is none. */
export async function latestRevocation(userId: string): Promise<number> {
  const row = await queryOne<{ latest: string }>(
    'SELECT COALESCE(MAX(id), 0)::text AS latest FROM "oauthRevocation" WHERE "userId" = $1',
    [userId]
  )
  return Number(row?.latest ?? 0)
}

/** Whether a revocation newer than the one the token was issued after covers this client's connection to the team. */
export async function isRevokedSince(userId: string, clientId: string, teamId: string, issuedAfter: unknown): Promise<boolean> {
  if (typeof issuedAfter !== 'number' || !Number.isSafeInteger(issuedAfter) || issuedAfter < 0) return true
  const row = await queryOne<{ revoked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM "oauthRevocation"
        WHERE "userId" = $1 AND id > $4
          AND (("clientId" IS NULL AND "teamId" IS NULL) OR ("clientId" = $2 AND "teamId" = $3))
     ) AS revoked`,
    [userId, clientId, teamId, issuedAfter]
  )
  return row?.revoked !== false
}
