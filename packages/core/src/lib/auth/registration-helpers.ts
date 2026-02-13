/**
 * Registration Helper Functions
 *
 * Pure helper functions for registration mode logic.
 * These functions have no side effects and can be used
 * on both server and client (where appropriate).
 */

import type { AuthConfig, RegistrationMode, PublicAuthConfig } from '../config/types'

/**
 * Check if public registration (self-signup) is allowed.
 *
 * Only 'open' mode allows unrestricted public registration.
 * 'domain-restricted' allows registration only via Google OAuth for allowed domains.
 */
export function isRegistrationOpen(mode: RegistrationMode): boolean {
  return mode === 'open'
}

/**
 * Check if an email domain is in the allowed domains list.
 *
 * @param email - Full email address (e.g., "user@nextspark.dev")
 * @param allowedDomains - List of allowed domains without @ (e.g., ["nextspark.dev"])
 * @returns true if the email domain is allowed
 */
export function isDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (!allowedDomains.length) return false

  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  return allowedDomains.some(
    (allowed) => domain === allowed.toLowerCase()
  )
}

/**
 * Check if Google OAuth should be enabled based on auth config.
 *
 * Google is disabled when:
 * - providers.google.enabled is explicitly false
 * - mode is 'closed' (no OAuth at all)
 * - GOOGLE_CLIENT_ID env var is not set (runtime check, not done here)
 */
export function isGoogleAuthEnabled(authConfig: AuthConfig): boolean {
  if (authConfig.registration.mode === 'closed') return false
  return authConfig.providers?.google?.enabled !== false
}

/**
 * Check if the signup page should be accessible.
 *
 * Signup page is hidden for:
 * - 'closed': No registration at all
 * - 'domain-restricted': Registration happens via Google OAuth on login page
 * - 'invitation-only': Only accessible with valid invite params
 */
export function isSignupPageVisible(mode: RegistrationMode): boolean {
  return mode === 'open'
}

/**
 * Check if email+password signup form should be shown.
 */
export function isEmailSignupEnabled(mode: RegistrationMode): boolean {
  return mode === 'open'
}

/**
 * Check if signup should be blocked entirely (server-side enforcement).
 *
 * In 'closed' mode, ALL signup attempts are blocked.
 * In 'domain-restricted' mode, email+password signup is blocked
 * but Google OAuth may be allowed (with domain check).
 */
export function shouldBlockSignup(
  mode: RegistrationMode,
  isOAuth: boolean
): boolean {
  if (mode === 'closed') return true
  if (mode === 'domain-restricted' && !isOAuth) return true
  return false
}

/**
 * Build a PublicAuthConfig from the full AuthConfig.
 * Strips sensitive data (allowedDomains) for client exposure.
 */
export function getPublicAuthConfig(authConfig: AuthConfig): PublicAuthConfig {
  return {
    registration: {
      mode: authConfig.registration.mode,
    },
    providers: {
      google: {
        enabled: isGoogleAuthEnabled(authConfig),
      },
    },
  }
}
