'use client'

import { useSyncExternalStore } from 'react'
import {
  useSessionCookieRefresh,
  type UseSessionCookieRefreshOptions,
} from '../../hooks/useSessionCookieRefresh'
import { useAccountPreferencesSync } from '../../hooks/useAccountPreferencesSync'
import { hasSessionHint, subscribeSessionHint } from '../../lib/auth/session-hint'

const signedOutOnServer = () => false

/**
 * Drop-in client component that keeps the session cookie renewed for
 * installed PWAs / long-lived tabs. Renders nothing.
 *
 * The root layout template mounts it once; it re-issues the session cookie
 * through Better Auth's `get-session` Route Handler on app open, when the tab
 * becomes visible again and when the device comes back online. See
 * `useSessionCookieRefresh` for the options and `lib/auth/session-refresh.ts`
 * for why render-time session reads cannot do this themselves.
 *
 * It only asks while the browser is signed in (see `lib/auth/session-hint`),
 * following the hint as a sign-in or sign-out on the page changes it, so an
 * anonymous visitor makes no request; and each answer brings the locale cookie
 * and the theme in line with the account (`useAccountPreferencesSync`).
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <SessionCookieRefresher />
 * // or, for a theme with 90-day sessions that only wants a daily check:
 * <SessionCookieRefresher minIntervalMs={24 * 60 * 60 * 1000} />
 * ```
 */
export function SessionCookieRefresher(props: UseSessionCookieRefreshOptions = {}) {
  // The server render has no cookie to read and renders nothing either way
  const signedIn = useSyncExternalStore(subscribeSessionHint, hasSessionHint, signedOutOnServer)
  const onRefresh = useAccountPreferencesSync()

  useSessionCookieRefresh({ ...props, enabled: (props.enabled ?? true) && signedIn, onRefresh })
  return null
}
