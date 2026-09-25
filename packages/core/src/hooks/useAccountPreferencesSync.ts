'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { I18N_CONFIG } from '../lib/config/config-client'
type SupportedLocale = typeof I18N_CONFIG.supportedLocales[number]
import { setUserLocaleClient } from '../lib/locale-client'
import { setSessionHint } from '../lib/auth/session-hint'
import type { SessionRefreshContext, SessionRefreshResult } from './useSessionCookieRefresh'
import { withBasePath } from '../lib/base-path'

/** next-themes keeps the visitor's own choice under this localStorage key. */
const THEME_STORAGE_KEY = 'theme'
const THEME_MODES = ['light', 'dark', 'system']

/** The user this tab looked up a saved theme for, so it looks once per user. */
const ACCOUNT_THEME_CHECKED_KEY = 'nextspark.account_theme_checked'

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length)
}

function hasStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) !== null
  } catch {
    return true
  }
}

/** Whether this tab still has to look for `userId`'s saved theme; marks it as looked either way. */
function claimAccountThemeCheck(userId: string): boolean {
  try {
    if (sessionStorage.getItem(ACCOUNT_THEME_CHECKED_KEY) === userId) return false
    sessionStorage.setItem(ACCOUNT_THEME_CHECKED_KEY, userId)
    return true
  } catch {
    return false
  }
}

/** The language this tab last refreshed the page into. */
const LOCALE_REFRESHED_KEY = 'nextspark.locale_refreshed'

/** Whether the page still has to be refreshed into `language`; marks it as done. */
function claimLocaleRefresh(language: string): boolean {
  try {
    if (sessionStorage.getItem(LOCALE_REFRESHED_KEY) === language) return false
    sessionStorage.setItem(LOCALE_REFRESHED_KEY, language)
    return true
  } catch {
    return true
  }
}

function releaseLocaleRefresh() {
  try {
    sessionStorage.removeItem(LOCALE_REFRESHED_KEY)
  } catch {
    // Storage unavailable: nothing was claimed
  }
}

/** Undo `userId`'s claim, unless another user's lookup has claimed the tab since. */
function releaseAccountThemeCheck(userId: string) {
  try {
    if (sessionStorage.getItem(ACCOUNT_THEME_CHECKED_KEY) === userId) sessionStorage.removeItem(ACCOUNT_THEME_CHECKED_KEY)
  } catch {
    // Storage unavailable: nothing was claimed
  }
}

/**
 * What to do with each session SessionCookieRefresher reads. Rendering takes
 * the locale and the theme from the request and configuration alone, so the
 * account's own choices are applied here:
 *
 * - No session: forget the session hint, so public pages stop asking for one.
 * - A user: keep the hint; make the locale cookie name the account's language,
 *   refreshing the page when it was rendered in another one; and, in a browser
 *   where the visitor never chose a theme, apply the one saved to the account.
 */
export function useAccountPreferencesSync() {
  const router = useRouter()
  const { setTheme, forcedTheme } = useTheme()

  return useCallback((result: SessionRefreshResult, session?: SessionRefreshContext) => {
    if (!result || result.error) return
    const user = (result.data as { user?: { id?: unknown; language?: unknown } } | null | undefined)?.user
    if (!user) {
      setSessionHint(false)
      return
    }
    setSessionHint(true)

    const language = user.language
    const localeDetected = I18N_CONFIG.supportedLocales.length > 1 && I18N_CONFIG.localeDetection !== false
    if (localeDetected && typeof language === 'string' && I18N_CONFIG.supportedLocales.includes(language as SupportedLocale)) {
      if (readCookie(I18N_CONFIG.cookie.name) !== language) setUserLocaleClient(language)
      // The page renders in the cookie's locale, so refreshing helps only once the
      // cookie names the account's. One a script cannot replace (written HttpOnly)
      // would otherwise refresh the page on every session read, and so would a
      // layout that renders a fixed locale: the page is refreshed once per language.
      if (document.documentElement.lang === language) {
        releaseLocaleRefresh()
      } else if (readCookie(I18N_CONFIG.cookie.name) === language && claimLocaleRefresh(language)) {
        router.refresh()
      }
    }

    const userId = typeof user.id === 'string' ? user.id : 'signed-in'
    if (!forcedTheme && !hasStoredTheme() && claimAccountThemeCheck(userId)) {
      fetch(withBasePath('/api/user/profile?includeMeta=true'))
        .then(response => {
          // No answer about the theme: look again with the next session read
          if (!response.ok) throw new Error(`Profile request failed with status ${response.status}`)
          return response.json()
        })
        .then(profile => {
          // Signed out while it was on the wire: the theme belongs to a session that ended
          if (session && !session.isCurrent()) {
            releaseAccountThemeCheck(userId)
            return
          }
          const theme = profile?.meta?.uiPreferences?.theme
          if (THEME_MODES.includes(theme)) setTheme(theme)
        })
        .catch(() => releaseAccountThemeCheck(userId))
    }
  }, [router, setTheme, forcedTheme])
}
