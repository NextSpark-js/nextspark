/**
 * Better Auth Plugin: Account Theme Cookie
 *
 * Copies the account's saved theme into the readable cookie the areas with a
 * session apply before their first paint (#495; lib/theme/account-theme-cookie,
 * providers/account-theme). Every way of signing in ends in Better Auth
 * issuing a session cookie (email and password, an email code, a magic link, an
 * OAuth callback), so the cookie is written wherever a response issues one: one
 * read of the user's `uiPreferences`. An account without a saved theme expires
 * the cookie, so another account's theme does not stay behind. Sign-out expires it.
 *
 * Must come before nextCookies(), which forwards the cookies earlier hooks set.
 */

import { createAuthMiddleware } from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import type { Pool } from 'pg'
import { accountThemeCookie, toAccountTheme, type AccountTheme } from '../theme/account-theme-cookie'

type Ctx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

function setThemeCookie(ctx: Ctx, theme: AccountTheme | undefined) {
  // Secure exactly when the session cookie is (lib/auth.ts useSecureCookies, or an https baseURL)
  const { name, value, options } = accountThemeCookie(theme, !!ctx.context.authCookies.sessionToken.attributes.secure)
  ctx.setCookie(name, value, options)
}

/** The reader lib/auth.ts gives the plugin: the user's `uiPreferences.theme` on the auth pool (one indexed row). */
export function readAccountThemeFrom(pool: Pick<Pool, 'query'>) {
  return async (userId: string): Promise<unknown> => (await pool.query(
    `SELECT "metaValue"->>'theme' AS theme FROM "users_metas" WHERE "userId" = $1 AND "metaKey" = 'uiPreferences'`,
    [userId]
  )).rows[0]?.theme
}

/** `readTheme` answers the user's saved `uiPreferences.theme`, whatever it holds. */
export const accountThemePlugin = (readTheme: (userId: string) => Promise<unknown>): BetterAuthPlugin => ({
  id: 'account-theme-cookie',
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === '/sign-out',
        handler: createAuthMiddleware(async (ctx) => setThemeCookie(ctx, undefined)),
      },
      {
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          const userId = ctx.context.newSession?.user.id
          if (!userId) return
          let theme: AccountTheme | undefined
          try {
            theme = toAccountTheme(await readTheme(userId))
          } catch (error) {
            // The sign-in goes on without the cookie (it may hold another account's theme); the page then looks the
            // theme up after hydration, as before the cookie (useAccountPreferencesSync)
            console.error('[Auth] Could not read the account theme:', error)
          }
          setThemeCookie(ctx, theme)
        }),
      },
    ],
  },
})
