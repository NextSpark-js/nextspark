'use client'

import { useEffect, useRef } from 'react'
import { refreshSessionCookie } from '../lib/auth-client'

export interface UseSessionCookieRefreshOptions {
  /**
   * Minimum time between two refresh calls, in milliseconds. Every trigger
   * inside this window is ignored. Default: 5 minutes (matches the default
   * session cookie cache, so at most one extra DB read per 5 minutes).
   */
  minIntervalMs?: number
  /**
   * Also refresh once right after mount — i.e. every time the app is opened
   * (PWA cold start, full reload). Default: true.
   */
  refreshOnMount?: boolean
  /** Set to false to turn the hook off (e.g. on public/auth pages). Default: true. */
  enabled?: boolean
}

export const DEFAULT_SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Keep the session cookie alive for installed PWAs / long-lived tabs.
 *
 * Server Component renders read the session with `disableRefresh`, so they
 * never renew the cookie (Next.js cannot write cookies during render). This
 * hook triggers the real renewal through Better Auth's `get-session` Route
 * Handler — where `Set-Cookie` works — whenever the app is (re)opened:
 *
 * - on mount (app open / reload), unless `refreshOnMount: false`
 * - when the document becomes visible again (`visibilitychange`, `focus`,
 *   `pageshow` for bfcache restores)
 * - when connectivity comes back (`online`)
 *
 * Calls are throttled by `minIntervalMs`; a failed call (offline, server
 * down) does not count towards the throttle, so the next trigger retries.
 * Anonymous visitors just get a cheap `null` session response.
 */
export function useSessionCookieRefresh(options: UseSessionCookieRefreshOptions = {}) {
  const {
    minIntervalMs = DEFAULT_SESSION_REFRESH_INTERVAL_MS,
    refreshOnMount = true,
    enabled = true,
  } = options

  const lastRefreshAtRef = useRef(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const refresh = async () => {
      if (inFlightRef.current) return
      const now = Date.now()
      if (now - lastRefreshAtRef.current < minIntervalMs) return

      inFlightRef.current = true
      lastRefreshAtRef.current = now
      try {
        await refreshSessionCookie()
      } catch {
        // Offline / server unreachable: forget this attempt so the next
        // trigger (e.g. `online`) retries immediately instead of waiting out
        // the throttle window.
        lastRefreshAtRef.current = 0
      } finally {
        inFlightRef.current = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onWake = () => void refresh()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('online', onWake)

    if (refreshOnMount) void refresh()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [enabled, minIntervalMs, refreshOnMount])
}
