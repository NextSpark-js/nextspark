/**
 * Housekeeping of the authorization server's tables (#541). Better Auth never deletes what has expired: refresh
 * tokens that ended or were replaced, access token rows, the client assertions it remembers against replay. Without
 * this they grow for as long as the feature is used.
 *
 * What is removed is what nothing can use any more, a day after it stopped being usable: the day is the margin for
 * a replaced refresh token to still be recognised as a replay. A refresh token that is alive is never touched, so
 * no connection ends here; the trigger of migration 048 that records a revocation only acts on a live token.
 *
 * It runs from where tokens are issued (lib/mcp/oauth/plugins), at most once an hour per process, so a deployment
 * needs no job set up for it. A project that wants its own schedule calls purgeExpiredOAuth.
 *
 * Service connection: these are the authorization server's tables, which no user role reads.
 */
import { queryRows } from '../../db'

export interface OAuthPurgeResult {
  refreshTokens: number
  accessTokens: number
  clientAssertions: number
  teamSelections: number
  revocations: number
}

const count = async (sql: string): Promise<number> => (await queryRows<{ id: string }>(sql)).length

/** Removes what expired or ended more than a day ago. Returns how many rows of each kind. */
export async function purgeExpiredOAuth(): Promise<OAuthPurgeResult> {
  // Access tokens first: the rows of a refresh token go with it by cascade and would not be counted
  const accessTokens = await count(
    `DELETE FROM "oauthAccessToken" WHERE "expiresAt" < now() - interval '1 day' RETURNING id`
  )
  const refreshTokens = await count(
    `DELETE FROM "oauthRefreshToken"
      WHERE "expiresAt" < now() - interval '1 day' OR revoked < now() - interval '1 day'
      RETURNING id`
  )
  const clientAssertions = await count(
    `DELETE FROM "oauthClientAssertion" WHERE "expiresAt" < now() - interval '1 day' RETURNING id`
  )
  const teamSelections = await count(
    `DELETE FROM "oauthTeamSelection" WHERE "createdAt" < now() - interval '1 day' RETURNING "sessionId" AS id`
  )
  // A user's newest revocation is the number their next token carries: it stays whatever its age
  const revocations = await count(
    `DELETE FROM "oauthRevocation" old
      WHERE old."revokedAt" < now() - interval '1 day'
        AND old.id < (SELECT MAX(newest.id) FROM "oauthRevocation" newest WHERE newest."userId" = old."userId")
      RETURNING old.id::text AS id`
  )
  return { refreshTokens, accessTokens, clientAssertions, teamSelections, revocations }
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
