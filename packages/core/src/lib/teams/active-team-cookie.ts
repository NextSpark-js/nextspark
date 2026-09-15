/**
 * Active Team Cookie
 *
 * `activeTeamId` tells server code which team a signed-in request acts in: the
 * dashboard layouts (through the proxy), server actions and resolveTeamContext.
 * POST /api/v1/teams/switch writes it, host-only and for a year, as
 * `<session id>:<team id>`. Readers take the team only for the session that
 * wrote it, so a cookie left on the same browser by an earlier session, another
 * user's or one since rotated, names no team instead of the wrong one;
 * TeamProvider writes the current session's team as soon as it mounts. Being
 * host-only, each subdomain of a multi-tenant app keeps its own team.
 */

export const ACTIVE_TEAM_COOKIE = 'activeTeamId'

/** How long the browser keeps the cookie, in seconds. */
export const ACTIVE_TEAM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** The cookie value that makes `teamId` the active team of session `sessionId`. */
export function activeTeamCookieValue(sessionId: string, teamId: string): string {
  return `${sessionId}:${teamId}`
}

/**
 * The team a cookie value names for `sessionId`, or null when the value belongs
 * to another session, carries no session (it was written before values were
 * bound to one) or there is no session to compare it with.
 */
export function activeTeamIdForSession(
  value: string | null | undefined,
  sessionId: string | null | undefined
): string | null {
  if (!value || !sessionId) return null
  const separator = value.indexOf(':')
  if (separator === -1 || value.slice(0, separator) !== sessionId) return null
  return value.slice(separator + 1) || null
}
