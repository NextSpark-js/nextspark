/**
 * Server-side session cookie refresh
 *
 * WHY THIS EXISTS
 * ---------------
 * Better Auth sessions are "rolling": every `updateAge` seconds of activity,
 * `getSession` extends `expiresAt` in the database AND re-issues the session
 * cookie with a fresh `Max-Age`. The cookie half of that only works where
 * cookies can be written — Route Handlers and Server Actions. When the session
 * is read while RENDERING a Server Component (root layout, i18n request
 * config, theme mode…), Next.js forbids `cookies().set()`; the `nextCookies`
 * plugin swallows the error, the DB row is renewed, but the browser keeps the
 * old cookie and drops it N days after login — even for daily users. That is
 * exactly what an installed PWA hits, because it is only ever opened through
 * server-rendered pages.
 *
 * THE OFFICIAL PATH
 * -----------------
 * 1. Render-time reads pass `query: { disableRefresh: true }` so they never
 *    consume the renewal window (see `lib/locale.ts`,
 *    `lib/theme/get-default-theme-mode.ts`).
 * 2. The renewal is triggered from the browser against Better Auth's own
 *    `GET /api/auth/get-session` endpoint, served by the `app/api/auth/[...all]`
 *    Route Handler where `Set-Cookie` works. `refreshSessionCookie()` in
 *    `lib/auth-client.ts` does that call; `useSessionCookieRefresh()` /
 *    `<SessionCookieRefresher />` fire it on app open, tab focus and reconnect.
 * 3. Apps that want their own endpoint (custom path, service worker, native
 *    shell) can expose `refreshSessionResponse` from any Route Handler.
 */

import { auth } from '../auth'

/**
 * Run Better Auth's session lookup with the cookie cache bypassed and return
 * the raw `Response`, `Set-Cookie` headers included. Call it from a Route
 * Handler and return the result as-is:
 *
 * ```ts
 * // app/api/session/refresh/route.ts
 * import { refreshSessionResponse } from '@nextsparkjs/core/lib/auth/session-refresh'
 * export const GET = (req: Request) => refreshSessionResponse(req.headers)
 * ```
 *
 * When the rolling renewal is due, the response carries the renewed session
 * cookie; otherwise it just returns the current session (or `null` when the
 * request is anonymous). Never call this during Server Component render.
 */
export async function refreshSessionResponse(headers: Headers): Promise<Response> {
  return auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
    asResponse: true,
  })
}
