/**
 * Session Config Resolution
 *
 * Turns the (optional, partially specified) `auth.session` block of the merged
 * app config into the concrete values handed to Better Auth. Pure function —
 * no side effects besides a `console.warn` on invalid input — so themes and
 * tests can reason about the exact numbers Better Auth will receive.
 *
 * Resolution rules:
 * - Every field falls back to the core default when missing.
 * - Non-positive / non-finite values are rejected (warning) → default.
 * - `updateAge` defaults to 1 day, capped at `expiresIn / 2` for short
 *   sessions so a rolling renewal still happens before expiry.
 * - `updateAge` and `cookieCache.maxAge` are clamped to `expiresIn`.
 */

import type { AuthConfig, AuthSessionConfig } from '../config/types'

export interface ResolvedSessionConfig {
  /** Total session lifetime in seconds. */
  expiresIn: number
  /** Rolling-renewal interval in seconds (<= expiresIn). */
  updateAge: number
  cookieCache: {
    enabled: boolean
    /** Cookie-cache lifetime in seconds (<= expiresIn). */
    maxAge: number
  }
}

export const DEFAULT_SESSION_CONFIG: ResolvedSessionConfig = {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // 1 day
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minutes
  },
}

function isPositiveSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Validate one duration field: `undefined` → fallback silently; anything that
 * is not a positive finite number → fallback with a warning.
 */
function resolveSeconds(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback
  if (!isPositiveSeconds(value)) {
    console.warn(
      `[Auth] Ignoring invalid auth.session.${field} (${String(value)}); using default ${fallback}s`
    )
    return fallback
  }
  return Math.floor(value)
}

/**
 * Resolve the session configuration Better Auth should run with.
 *
 * @param authConfig - The merged `auth` config (core defaults + theme overrides).
 *                     Only its `session` block is read; `undefined`/`null` is
 *                     allowed and yields the defaults.
 */
export function resolveSessionConfig(
  authConfig?: Pick<AuthConfig, 'session'> | null
): ResolvedSessionConfig {
  const cfg: AuthSessionConfig = authConfig?.session ?? {}

  const expiresIn = resolveSeconds(cfg.expiresIn, DEFAULT_SESSION_CONFIG.expiresIn, 'expiresIn')

  // Default renewal interval: 1 day, but never more than half the session for
  // short sessions (otherwise a 1-hour session would never roll).
  const defaultUpdateAge = Math.max(
    1,
    Math.min(DEFAULT_SESSION_CONFIG.updateAge, Math.floor(expiresIn / 2))
  )
  let updateAge = resolveSeconds(cfg.updateAge, defaultUpdateAge, 'updateAge')
  if (updateAge > expiresIn) {
    console.warn(
      `[Auth] auth.session.updateAge (${updateAge}s) exceeds expiresIn (${expiresIn}s); clamping to expiresIn`
    )
    updateAge = expiresIn
  }

  const cacheEnabled = cfg.cookieCache?.enabled ?? DEFAULT_SESSION_CONFIG.cookieCache.enabled
  let cacheMaxAge = resolveSeconds(
    cfg.cookieCache?.maxAge,
    DEFAULT_SESSION_CONFIG.cookieCache.maxAge,
    'cookieCache.maxAge'
  )
  if (cacheMaxAge > expiresIn) cacheMaxAge = expiresIn

  return {
    expiresIn,
    updateAge,
    cookieCache: {
      enabled: cacheEnabled,
      maxAge: cacheMaxAge,
    },
  }
}
