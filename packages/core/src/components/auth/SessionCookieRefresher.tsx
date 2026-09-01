'use client'

import {
  useSessionCookieRefresh,
  type UseSessionCookieRefreshOptions,
} from '../../hooks/useSessionCookieRefresh'

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
 * @example
 * ```tsx
 * // app/layout.tsx
 * <SessionCookieRefresher />
 * // or, for a theme with 90-day sessions that only wants a daily check:
 * <SessionCookieRefresher minIntervalMs={24 * 60 * 60 * 1000} />
 * ```
 */
export function SessionCookieRefresher(props: UseSessionCookieRefreshOptions = {}) {
  useSessionCookieRefresh(props)
  return null
}
