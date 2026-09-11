/**
 * Email OTP Config Resolution
 *
 * Turns the (optional, partially specified) `auth.otp` block of the merged app
 * config into the concrete values handed to Better Auth's emailOTP plugin. Pure
 * function — no side effects besides a `console.warn` on invalid input — so it
 * is safe to import from client code too.
 *
 * Both numbers are read by the server (the plugin) and by the login form (the
 * notice that counts the code down, and the length the input accepts). They
 * live here so the two agree by construction: a duplicated literal is how the
 * UI ends up promising five minutes for a code that lasts two.
 *
 * Resolution rules:
 * - Every field falls back to the core default when missing.
 * - Non-positive / non-finite values are rejected (warning) → default.
 * - `otpLength` is additionally bounded to what Better Auth can generate.
 */

import type { AuthConfig, AuthOtpConfig } from '../config/types'

export interface ResolvedOtpConfig {
  /** Lifetime of an emailed code, in seconds. */
  expiresIn: number
  /** Number of digits in an emailed code. */
  otpLength: number
}

export const DEFAULT_OTP_CONFIG: ResolvedOtpConfig = {
  expiresIn: 60 * 5, // 5 minutes
  otpLength: 6,
}

/** Shortest and longest code Better Auth will generate. */
const MIN_OTP_LENGTH = 4
const MAX_OTP_LENGTH = 10

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Validate one field: `undefined` → fallback silently; anything that is not a
 * positive finite number → fallback with a warning.
 */
function resolveNumber(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback
  if (!isPositiveNumber(value)) {
    console.warn(
      `[Auth] Ignoring invalid auth.otp.${field} (${String(value)}); using default ${fallback}`
    )
    return fallback
  }
  return Math.floor(value)
}

/**
 * Resolve the email-OTP configuration the app runs with.
 *
 * @param authConfig - The merged `auth` config (core defaults + theme overrides).
 *                     Only its `otp` block is read; `undefined`/`null` is
 *                     allowed and yields the defaults.
 */
export function resolveOtpConfig(
  authConfig?: Pick<AuthConfig, 'otp'> | null
): ResolvedOtpConfig {
  const cfg: AuthOtpConfig = authConfig?.otp ?? {}

  const expiresIn = resolveNumber(cfg.expiresIn, DEFAULT_OTP_CONFIG.expiresIn, 'expiresIn')

  let otpLength = resolveNumber(cfg.otpLength, DEFAULT_OTP_CONFIG.otpLength, 'otpLength')
  if (otpLength < MIN_OTP_LENGTH || otpLength > MAX_OTP_LENGTH) {
    console.warn(
      `[Auth] auth.otp.otpLength (${otpLength}) is outside ${MIN_OTP_LENGTH}-${MAX_OTP_LENGTH}; using default ${DEFAULT_OTP_CONFIG.otpLength}`
    )
    otpLength = DEFAULT_OTP_CONFIG.otpLength
  }

  return { expiresIn, otpLength }
}

/**
 * Seconds left before a code sent at `sentAt` expires, floored at 0.
 *
 * @param sentAt - Epoch milliseconds of the moment the code was requested.
 * @param expiresIn - Code lifetime in seconds.
 * @param now - Epoch milliseconds to measure against (injectable for tests).
 */
export function getOtpSecondsRemaining(
  sentAt: number,
  expiresIn: number,
  now: number = Date.now()
): number {
  const elapsed = Math.floor((now - sentAt) / 1000)
  return Math.max(0, expiresIn - elapsed)
}

/**
 * Format a remaining-seconds count as `m:ss` (or `s` under a minute).
 *
 * Digits and a colon read the same in every locale this ships with, so the
 * value can be interpolated into a translated sentence without each locale
 * owning a time format.
 */
export function formatOtpCountdown(secondsRemaining: number): string {
  const total = Math.max(0, Math.floor(secondsRemaining))
  if (total < 60) return String(total)

  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
