/**
 * Account theme cookie
 *
 * The theme saved to a signed-in account (`uiPreferences.theme`), copied into a
 * readable cookie so the areas with a session (dashboard, superadmin, devtools:
 * providers/account-theme) can apply it before their first paint without the
 * render reading the session (#495). The server
 * writes it when it issues a session (any sign-in method, through
 * lib/auth/account-theme-plugin) and when the user saves a theme
 * (PATCH /api/user/profile), and expires it on sign-out.
 *
 * It holds only `light`, `dark` or `system`. A theme the visitor chose in this
 * browser (localStorage) still wins over it, and a forced theme over both.
 */

import { withBasePath } from '../base-path'

export const ACCOUNT_THEME_COOKIE = 'nextspark.account_theme'

const ACCOUNT_THEMES = ['light', 'dark', 'system'] as const
export type AccountTheme = (typeof ACCOUNT_THEMES)[number]

/** As long as browsers keep a cookie, like the session hint: sign-out expires it. */
const MAX_AGE = 60 * 60 * 24 * 400

/** The value as a theme the cookie may hold, or undefined. */
export function toAccountTheme(value: unknown): AccountTheme | undefined {
  return ACCOUNT_THEMES.includes(value as AccountTheme) ? (value as AccountTheme) : undefined
}

/**
 * Name, value and attributes for writing the cookie: `theme`, or an expired
 * cookie when the account has none. Not HttpOnly, since the inline script reads it.
 */
export function accountThemeCookie(theme: AccountTheme | undefined, secure: boolean) {
  return {
    name: ACCOUNT_THEME_COOKIE,
    value: theme ?? '',
    options: { path: withBasePath('/'), maxAge: theme ? MAX_AGE : 0, sameSite: 'lax' as const, secure, httpOnly: false },
  }
}

