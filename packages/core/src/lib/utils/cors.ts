/**
 * CORS Configuration Helper
 *
 * Single source of truth for all CORS origin checks.
 * Merges origins from:
 * 1. APP_URL environment variable (always included)
 * 2. Core config (api.cors.allowedOrigins)
 * 3. Theme extensions (api.cors.additionalOrigins)
 * 4. Runtime env var (CORS_ADDITIONAL_ORIGINS)
 */

import type { ApplicationConfig } from '../config/config-types'

/**
 * Supported environments for CORS configuration
 * - development: Local development
 * - production: Production deployment
 * - staging: Pre-production testing
 * - qa: QA testing environment
 */
export type CorsEnvironment = 'development' | 'production' | 'staging' | 'qa'

/**
 * Environments that use development CORS settings (more permissive)
 */
const DEV_LIKE_ENVIRONMENTS: CorsEnvironment[] = ['development', 'staging', 'qa']

/**
 * Check if debug logging is enabled (evaluated at runtime for testability)
 */
function isDebugEnabled(): boolean {
  return process.env.NEXTSPARK_DEBUG_CORS === 'true'
}

/**
 * Normalize environment string to a valid CorsEnvironment
 * Maps staging/qa to use development origins, unknown environments default to development
 *
 * @param env - Raw environment string
 * @returns Normalized environment key for config lookup
 */
export function normalizeCorsEnvironment(env: string): 'development' | 'production' {
  const normalized = env.toLowerCase() as CorsEnvironment

  // staging and qa use development origins (more permissive for testing)
  if (DEV_LIKE_ENVIRONMENTS.includes(normalized)) {
    return 'development'
  }

  // production uses production origins (restrictive)
  if (normalized === 'production') {
    return 'production'
  }

  // Unknown environments default to development for safety during dev
  if (isDebugEnabled()) {
    console.log(`[cors] Unknown environment "${env}", defaulting to development`)
  }
  return 'development'
}

/**
 * Get merged CORS origins from config + theme + env vars
 * Single source of truth for all CORS origin checks
 *
 * @param config - Application configuration (merged core + theme)
 * @param env - Environment ('development', 'production', 'staging', 'qa')
 * @returns Array of allowed origins (deduplicated)
 *
 * @example
 * ```ts
 * import { getCorsOrigins } from '@/lib/utils/cors'
 * import { APP_CONFIG_MERGED } from '@/lib/config'
 *
 * const allowedOrigins = getCorsOrigins(APP_CONFIG_MERGED)
 * if (allowedOrigins.includes(requestOrigin)) {
 *   // Origin is allowed
 * }
 * ```
 */
export function getCorsOrigins(
  config: ApplicationConfig,
  env: string = process.env.NODE_ENV || 'development'
): string[] {
  // Type-safe environment normalization
  const key = normalizeCorsEnvironment(env)

  if (isDebugEnabled()) {
    console.log(`[cors] Environment: ${env} -> normalized: ${key}`)
  }

  // 1. Core origins from config (already merged with theme's allowedOrigins)
  const coreOrigins = [...(config.api.cors.allowedOrigins[key] || [])]

  // 2. Theme additional origins (new extensible pattern)
  const themeOrigins = [...(config.api.cors.additionalOrigins?.[key] || [])]

  // 3. Runtime env var (comma-separated)
  const envVar = process.env.CORS_ADDITIONAL_ORIGINS || ''
  const envOrigins = envVar.split(',').map(o => o.trim()).filter(Boolean)

  // 4. Always include APP_URL and BETTER_AUTH_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const authUrl = process.env.BETTER_AUTH_URL
  const baseOrigins: string[] = []
  if (appUrl) baseOrigins.push(appUrl)
  if (authUrl && authUrl !== appUrl) baseOrigins.push(authUrl)

  // Return deduplicated union
  const origins = [...new Set([...baseOrigins, ...coreOrigins, ...themeOrigins, ...envOrigins])]

  if (isDebugEnabled()) {
    console.log(`[cors] Merged origins (${origins.length}):`, origins)
    console.log(`[cors]   - Base origins: ${baseOrigins.length}`)
    console.log(`[cors]   - Core origins: ${coreOrigins.length}`)
    console.log(`[cors]   - Theme origins: ${themeOrigins.length}`)
    console.log(`[cors]   - Env origins: ${envOrigins.length}`)
  }

  return origins
}
