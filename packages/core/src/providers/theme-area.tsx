"use client"

import * as React from "react"
import { ThemeContext } from "./theme-provider"

/** The account theme cookie (lib/theme/account-theme-cookie, ACCOUNT_THEME_COOKIE) and the provider's localStorage key */
const COOKIE = "nextspark.account_theme"
const STORAGE_KEY = "theme"

const noSubscription = () => () => {}
/** As in the root provider: the browser bundle of a Next.js app carries none of the inline script's code (#546) */
const inlineScriptCode = process.env.NEXT_RUNTIME !== ""

/**
 * Wraps an area with a session (dashboard, devtools, superadmin): inside it `useTheme()` answers without the public
 * theme, and while it is mounted the provider applies the visitor's theme (#510). Only the layouts of the areas import
 * it, so public pages do not load it (#546).
 *
 * It also applies the theme saved to the signed-in account (#495). The server leaves it in a readable cookie
 * (lib/theme/account-theme-cookie); in a browser with no stored choice, and where the theme is not forced, it becomes
 * the stored choice before the area paints:
 * - a full page load runs the inline script below while the area's HTML is parsed, before the root provider
 *   hydrates, so the provider starts from the stored theme;
 * - a client navigation into the area (the sign-in form goes from /login to the dashboard) sets it in a layout
 *   effect, and the provider applies it in the same commit, before the browser paints the area.
 */
export function ThemeArea({ children }: React.PropsWithChildren) {
  const theme = React.useContext(ThemeContext)
  const area = theme?.area
  const value = React.useMemo(() => area && { ...theme, forcedTheme: area[0] }, [theme, area])
  // True in the server render and while hydrating it, false in a client render: React does not run a script it
  // creates on the client, and warns about it
  const serverHtml = React.useSyncExternalStore(noSubscription, () => false, () => true)
  React.useLayoutEffect(() => {
    if (!value || !area) return
    // The stored theme, or the account's as the inline script stores it: a client navigation never ran that script, and
    // on a streamed page the root provider can hydrate before it runs; the provider follows, stores and applies it
    if (!value.forcedTheme) {
      try {
        const saved = ("; " + document.cookie).split("; " + COOKIE + "=")[1]?.split(";")[0]
        const stored = localStorage.getItem(STORAGE_KEY) || (saved && value.themes.includes(saved) ? saved : null)
        if (stored && stored !== value.theme) value.setTheme(stored)
      } catch {
        // localStorage can throw (blocked storage)
      }
    }
    area[1](true)
    return () => area[1](false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount of the area: later changes are the visitor's
  }, [])
  if (!value) return children
  return (
    <ThemeContext.Provider value={value}>
      {serverHtml && !value.forcedTheme && (
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: inlineScriptCode ? `(${script.toString()})(${JSON.stringify([STORAGE_KEY, COOKIE, value.themes]).slice(1, -1)})` : "" }}
        />
      )}
      {children}
    </ThemeContext.Provider>
  )
}

/** Runs inline before the area paints; serialized with toString, so it must not reference anything outside itself */
const script = (storageKey: string, cookie: string, themes: string[]) => {
  try {
    if (localStorage.getItem(storageKey)) return
    const value = ("; " + document.cookie).split("; " + cookie + "=")[1]?.split(";")[0]
    if (!value || !themes.includes(value)) return
    localStorage.setItem(storageKey, value)
    const resolved = value === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value
    const el = document.documentElement
    el.classList.remove("light", "dark")
    el.classList.add(resolved)
    el.style.colorScheme = resolved
  } catch {
    // localStorage can throw (blocked storage)
  }
}
