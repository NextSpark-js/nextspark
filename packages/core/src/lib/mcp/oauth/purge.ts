/**
 * Housekeeping of the authorization server's tables (#541). Better Auth never deletes what has expired: refresh
 * tokens that ended or were replaced, access token rows, the client assertions it remembers against replay. Without
 * this they grow for as long as the feature is used.
 *
 * What is removed is what has expired, a day after it did. A refresh token goes by its own expiry only: one that was
 * replaced or revoked is kept until then, because the authorization server needs that row to recognise a token
 * presented again. A refresh token that is alive is never touched, so no connection ends here; the trigger of
 * migration 049 that records a revocation only acts on a live token.
 *
 * It runs from where tokens are issued (lib/mcp/oauth/plugins), at most once an hour per process, so a deployment
 * needs no job set up for it. Each run removes a bounded number of rows of each kind and skips the rows another
 * instance is removing, so neither a backlog nor several instances at once hold up the token being issued. A
 * project that wants its own schedule calls purgeExpiredOAuth.
 *
 * Service connection: these are the authorization server's tables, which no user role reads.
 */
import { query } from '../../db'

export interface OAuthPurgeResult {
  refreshTokens: number
  accessTokens: number
  clientAssertions: number
  teamSelections: number
  revocations: number
  signingKeys: number
}

/** The most rows of one kind a run removes. What is left waits for the next run: a backlog never holds up a token. */
export const PURGE_BATCH = 2000

/**
 * Deletes up to PURGE_BATCH rows of `table` that match `where`, oldest pages first come first served: rows another
 * instance is deleting at the same moment are skipped instead of waited for.
 */
async function purge(table: string, key: string, where: string): Promise<number> {
  const result = await query(
    `DELETE FROM "${table}" WHERE ${key} IN (
       SELECT ${key} FROM "${table}" WHERE ${where} LIMIT ${PURGE_BATCH} FOR UPDATE SKIP LOCKED
     )`
  )
  return result.rowCount ?? 0
}

/** Removes what expired more than a day ago, up to PURGE_BATCH rows of each kind. Returns how many of each. */
export async function purgeExpiredOAuth(): Promise<OAuthPurgeResult> {
  // Access tokens first: the rows of a refresh token go with it by cascade and would not be counted
  const accessTokens = await purge('oauthAccessToken', 'id', `"expiresAt" < now() - interval '1 day'`)
  // By its own expiry and nothing else. A refresh token that was replaced or revoked stays until then: presented
  // again, that row is how the authorization server knows a token was reused and ends the connection it came from.
  const refreshTokens = await purge('oauthRefreshToken', 'id', `"expiresAt" < now() - interval '1 day'`)
  const clientAssertions = await purge('oauthClientAssertion', 'id', `"expiresAt" < now() - interval '1 day'`)
  const teamSelections = await purge('oauthTeamSelection', 'ctid', `"createdAt" < now() - interval '1 day'`)
  // A user's newest revocation is the number their next token carries: it stays whatever its age
  const revocations = await purge(
    'oauthRevocation',
    'id',
    `"revokedAt" < now() - interval '1 day'
       AND id < (SELECT MAX(newest.id) FROM "oauthRevocation" newest WHERE newest."userId" = "oauthRevocation"."userId")`
  )
  // A signing key stays published for 30 days after it is replaced (Better Auth's grace period); a day after that
  // nothing asks for it. The key that signs now has not expired and is never among these.
  const signingKeys = await purge('jwks', 'id', `"expiresAt" < now() - interval '31 days'`)
  return { refreshTokens, accessTokens, clientAssertions, teamSelections, revocations, signingKeys }
}

const HOUR_MS = 60 * 60 * 1000
let lastRunAt = 0

/**
 * Runs the purge when this process has not run it in the last hour. Never throws: housekeeping that fails must not
 * fail the token being issued. Returns the result when it ran, null when it was not due or it failed.
 */
export async function purgeExpiredOAuthIfDue(now: number = Date.now()): Promise<OAuthPurgeResult | null> {
  if (now - lastRunAt < HOUR_MS) return null
  lastRunAt = now
  try {
    const result = await purgeExpiredOAuth()
    const total = Object.values(result).reduce((sum, rows) => sum + rows, 0)
    if (total) console.info('[mcp:oauth] purged expired rows:', result)
    return result
  } catch (error) {
    console.error('[mcp:oauth] purge of expired rows failed:', error)
    return null
  }
}

/** For tests: forget when the purge last ran. */
export function resetOAuthPurgeClock(): void {
  lastRunAt = 0
}
