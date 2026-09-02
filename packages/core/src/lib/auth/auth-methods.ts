/**
 * Login Methods & Presets
 *
 * Pure helpers around `AuthConfig.methods` — the list of login methods an app
 * offers (`'email-otp'`, `'google'`, `'email-password'`), in priority order.
 * Safe to import from server and client code: no side effects, types only.
 *
 * Portfolio policy (#126): the DEFAULT is the passwordless preset — a one-time
 * code by email + Google OAuth, no password field. Themes opt into the classic
 * preset (or any combination) from their app.config.ts.
 */

import type { AuthConfig, AuthLoginMethod, AuthPreset } from '../config/types'

/** Every method the core knows how to render/serve. */
export const AUTH_LOGIN_METHODS: readonly AuthLoginMethod[] = ['email-otp', 'google', 'email-password']

/** Named bundles of login methods. Arrays are in UI priority order. */
export const AUTH_PRESETS: Readonly<Record<AuthPreset, readonly AuthLoginMethod[]>> = {
  /** One-time code by email + Google. No password anywhere. DEFAULT. */
  passwordless: ['email-otp', 'google'],
  /** Email + password (with signup / reset flows) + Google. */
  classic: ['email-password', 'google'],
}

/** The preset applied when a theme does not set `auth.methods`. */
export const DEFAULT_AUTH_METHODS: readonly AuthLoginMethod[] = AUTH_PRESETS.passwordless

export function isAuthLoginMethod(value: unknown): value is AuthLoginMethod {
  return typeof value === 'string' && (AUTH_LOGIN_METHODS as readonly string[]).includes(value)
}

/**
 * Resolve the login methods an app offers.
 *
 * - Unknown values are dropped (with a warning), duplicates removed, order kept.
 * - No `methods` configured, or nothing valid left → the default (passwordless)
 *   preset.
 */
export function resolveAuthMethods(
  authConfig?: Pick<AuthConfig, 'methods'> | { methods?: readonly string[] } | null
): AuthLoginMethod[] {
  const configured = authConfig?.methods
  if (!Array.isArray(configured)) return [...DEFAULT_AUTH_METHODS]

  const valid: AuthLoginMethod[] = []
  for (const method of configured) {
    if (!isAuthLoginMethod(method)) {
      console.warn(`[Auth] Ignoring unknown auth.methods entry: ${String(method)}`)
      continue
    }
    if (!valid.includes(method)) valid.push(method)
  }

  if (valid.length === 0) {
    console.warn('[Auth] auth.methods resolved to an empty list; falling back to the passwordless preset')
    return [...DEFAULT_AUTH_METHODS]
  }
  return valid
}

export function isAuthMethodEnabled(methods: readonly AuthLoginMethod[], method: AuthLoginMethod): boolean {
  return methods.includes(method)
}

/**
 * True when the login has NO password path: a one-time code is offered and
 * `'email-password'` is not. Google may or may not be present.
 */
export function isPasswordlessPreset(methods: readonly AuthLoginMethod[]): boolean {
  return methods.includes('email-otp') && !methods.includes('email-password')
}

/**
 * The email-based method the login form should open with: the first of
 * `'email-otp'` / `'email-password'` in the configured order, or null when the
 * app is Google-only.
 */
export function getPrimaryEmailMethod(
  methods: readonly AuthLoginMethod[]
): Extract<AuthLoginMethod, 'email-otp' | 'email-password'> | null {
  for (const method of methods) {
    if (method === 'email-otp' || method === 'email-password') return method
  }
  return null
}

/**
 * Which named preset the resolved methods correspond to (order-insensitive),
 * or null for a custom combination.
 */
export function matchAuthPreset(methods: readonly AuthLoginMethod[]): AuthPreset | null {
  const sorted = [...methods].sort().join(',')
  for (const [preset, presetMethods] of Object.entries(AUTH_PRESETS) as [AuthPreset, readonly AuthLoginMethod[]][]) {
    if ([...presetMethods].sort().join(',') === sorted) return preset
  }
  return null
}

/**
 * Server-side: should Better Auth's email + password endpoints be enabled?
 * Defaults to true regardless of the UI preset (see `AuthConfig.emailAndPassword`).
 */
export function isPasswordLoginEnabled(
  authConfig?: Pick<AuthConfig, 'emailAndPassword'> | null
): boolean {
  return authConfig?.emailAndPassword?.enabled !== false
}
