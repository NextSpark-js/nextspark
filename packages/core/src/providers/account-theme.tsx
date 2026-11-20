'use client'

import { useLayoutEffect, useSyncExternalStore } from 'react'
import { useTheme } from './theme-provider'
import { ACCOUNT_THEME_COOKIE } from '../lib/theme/account-theme-cookie'

/** The theme provider's localStorage key (the root layouts keep its default) */
const STORAGE_KEY = 'theme'

const noSubscription = () => () => {}

/**
 * Applies the theme saved to the signed-in account (#495) in the areas that have a session: dashboard, superadmin and
 * devtools mount it through DashboardProviders. Public and auth pages never load it, so their HTML and JS are what
 * they were.
 *
 * The server leaves the account theme in a readable cookie (lib/theme/account-theme-cookie). In a browser with no
 * stored choice, and where the theme is not forced, it becomes the stored choice, as the post-hydration lookup of
 * SessionCookieRefresher did, only before the first paint:
 * - a full page load runs the inline script below while the area's HTML is parsed, before the root provider
 *   hydrates, so the provider starts from the stored theme;
 * - a client navigation into the area (the sign-in form goes from /login to the dashboard) applies it in a layout
 *   effect, before the browser paints the area.
 */
export function AccountTheme() {
  const { theme, setTheme, forcedTheme, themes } = useTheme()
  // True in the server render and while hydrating it, false in a client render: React does not run a script it
  // creates on the client, and warns about it
  const serverHtml = useSyncExternalStore(noSubscription, () => false, () => true)

  useLayoutEffect(() => {
    if (forcedTheme) return
    // The same steps as the inline script (a client navigation never ran it), then the provider follows what is stored
    script(STORAGE_KEY, ACCOUNT_THEME_COOKIE, themes)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && stored !== theme) setTheme(stored)
    } catch {
      // localStorage can throw (blocked storage)
    }
    // Once per mount of the area: later changes are the visitor's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (forcedTheme || !serverHtml) return null
  const args = JSON.stringify([STORAGE_KEY, ACCOUNT_THEME_COOKIE, themes]).slice(1, -1)
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${args})` }} />
}

/** Runs inline before the area paints; serialized with toString, so it must not reference anything outside itself */
const script = (storageKey: string, cookie: string, themes: string[]) => {
  try {
    if (localStorage.getItem(storageKey)) return
    const value = ('; ' + document.cookie).split('; ' + cookie + '=')[1]?.split(';')[0]
    if (!value || !themes.includes(value)) return
    localStorage.setItem(storageKey, value)
    const resolved = value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value
    const el = document.documentElement
    el.classList.remove('light', 'dark')
    el.classList.add(resolved)
    el.style.colorScheme = resolved
  } catch {
    // localStorage can throw (blocked storage)
  }
}
