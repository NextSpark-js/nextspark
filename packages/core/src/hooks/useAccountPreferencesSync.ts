'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { I18N_CONFIG, copiesAccountLocale } from '../lib/config/i18n-config-client'
type SupportedLocale = typeof I18N_CONFIG.supportedLocales[number]
import { setUserLocaleClient } from '../lib/locale-client'
import { setSessionHint } from '../lib/auth/session-hint'
import type { SessionRefreshResult } from './useSessionCookieRefresh'

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length)
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

/**
 * What to do with each session SessionCookieRefresher reads. Rendering takes
 * the locale from the request and configuration alone, so the account's
 * language is applied here:
 *
 * - No session: forget the session hint, so public pages stop asking for one.
 * - A user: keep the hint; make the locale cookie name the account's language,
 *   refreshing the page when it was rendered in another one.
 *
 * The account's theme is not looked up here any more: public pages have one theme
 * (#510), and the areas with a session apply it from the cookie the server writes
 * when it issues a session (#495, providers/theme-area).
 */
export function useAccountPreferencesSync() {
  const router = useRouter()

  return useCallback((result: SessionRefreshResult) => {
    if (!result || result.error) return
    const user = (result.data as { user?: { language?: unknown } } | null | undefined)?.user
    if (!user) {
      setSessionHint(false)
      return
    }
    setSessionHint(true)

    const language = user.language
    const localeDetected = copiesAccountLocale()
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
  }, [router])
}
