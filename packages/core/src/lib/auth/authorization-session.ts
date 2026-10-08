import { auth, type TypedSession } from '../auth'

/**
 * The request's session as the database has it now, for authorization reads: the API entry points (dual-auth,
 * `validateAndAuthenticateRequest`), the /api/user routes, the server actions, generateEntityAPI, the /superadmin and
 * /devtools API and page checks, and the proxy template's gate.
 *
 * Better Auth's cookie cache (`session.cookieCache`, on by default for 5 minutes) answers `getSession` from the
 * signed `session_data` cookie without reading the database, so a signed-out or revoked session, or a role changed
 * since sign-in, would keep its old answer until that cookie expires. `disableCookieCache` reads the session and its
 * user from the database instead (one query). Reads that only display data keep the cache.
 */
export async function getAuthorizationSession(headers: Headers): Promise<TypedSession | null> {
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } })
  return (session as unknown as TypedSession | null) ?? null
}
