/**
 * Going on with an MCP authorization after a sign-in that leaves the login page (#541).
 *
 * The authorization server sends a signed-out browser to the login page with the authorization request in the URL,
 * signed. A password or a one-time code signs in from that page and the server answers with the next step. Google
 * (a redirect to the provider and back) and a sign-in link (opened later, from an email) come back somewhere else:
 * for them the place to come back to is the authorization endpoint itself, with the request as the client made
 * it. The browser has a session by then, so the authorization goes on to the team picker or the consent screen.
 *
 * Nothing is trusted from this URL: it is the client's own request again, and the authorization server validates
 * it from scratch (client, redirect URI, scopes, PKCE).
 */

/** The parameters the authorization server adds when it signs the request for the login page. */
const isSigningParameter = (name: string) => name === 'sig' || name === 'exp' || name.startsWith('ba_')

/**
 * The path that makes the authorization request of a login page's URL again, or null when `search` carries none.
 * Without the app's base path: the caller adds it.
 */
export function oauthAuthorizePath(search: string): string | null {
  const params = new URLSearchParams(search)
  if (!params.has('sig') || !params.get('client_id') || params.get('response_type') !== 'code') return null
  for (const name of [...new Set(params.keys())]) {
    if (isSigningParameter(name)) params.delete(name)
  }
  return `/api/auth/oauth2/authorize?${params.toString()}`
}
