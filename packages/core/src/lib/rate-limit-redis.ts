/**
 * Distributed Rate Limiting System with Redis (Upstash)
 *
 * This module provides distributed rate limiting using Upstash Redis,
 * which works correctly in multi-instance deployments.
 *
 * Falls back gracefully when Redis is not configured or dependencies aren't available.
 */

import { APP_CONFIG_MERGED } from './config/config-client'

// Type definitions for Upstash
type UpstashRedis = {
  new (config: { url: string; token: string }): unknown
}

type UpstashRatelimit = {
  new (config: {
    redis: unknown
    limiter: unknown
    analytics?: boolean
    prefix?: string
    ephemeralCache?: Map<string, number>
  }): {
    limit: (identifier: string) => Promise<{
      success: boolean
      remaining: number
      reset: number
      limit: number
    }>
  }
  slidingWindow: (requests: number, window: string) => unknown
}

// Lazy-loaded modules
let Redis: UpstashRedis | null = null
let Ratelimit: UpstashRatelimit | null = null
let modulesLoaded = false
let loadError: Error | null = null
let redisUnconfiguredLogged = false  // Log once, not on every request

// Lazy-loaded instances
let redis: unknown | null = null
type Limiter = { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number; limit: number }> }

// One limiter per tier and limit, created on first use (a project can change a tier's numbers)
const limiters = new Map<string, Limiter>()

/**
 * Load Upstash modules dynamically
 * This allows the app to start even if @upstash packages aren't installed
 */
async function loadUpstashModules(): Promise<boolean> {
  if (modulesLoaded) return !loadError

  try {
    const [ratelimitModule, redisModule] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])

    Ratelimit = ratelimitModule.Ratelimit as unknown as UpstashRatelimit
    Redis = redisModule.Redis as unknown as UpstashRedis

    // Initialize Redis client only if credentials are configured
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }

    modulesLoaded = true
    return true
  } catch (error) {
    loadError = error as Error
    modulesLoaded = true
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RateLimit] Upstash modules not available, using fallback:', (error as Error).message)
    }
    return false
  }
}

// Exported getters for rate limiters (for backwards compatibility)
export const authRateLimiter = null // Deprecated: use checkRateLimit with type 'auth'
export const apiRateLimiter = null // Deprecated: use checkRateLimit with type 'api'
export const strictRateLimiter = null // Deprecated: use checkRateLimit with type 'strict'

export interface RateLimitCheckResult {
  success: boolean
  remaining: number
  reset: number
  limit?: number
  retryAfter?: number
}

/**
 * The tiers core ships
 */
export type BuiltInRateLimitTier = 'auth' | 'api' | 'strict' | 'read' | 'write' | 'webhook' | 'ingest'

/**
 * Rate limit tiers available for API endpoints: the built-in ones and any name declared in
 * `rateLimit.tiers` of app.config (the `string & {}` keeps the built-in names in autocomplete).
 */
export type RateLimitTier = BuiltInRateLimitTier | (string & {})

export interface RateLimitTierConfig {
  /** Requests allowed per window */
  limit: number
  /** Window length in milliseconds */
  windowMs: number
}

/**
 * Default limits of the built-in tiers (the in-memory path and the Redis path both use them)
 */
const DEFAULT_TIERS: Record<BuiltInRateLimitTier, RateLimitTierConfig> = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },
  api: { limit: 100, windowMs: 60 * 1000 },
  strict: { limit: 10, windowMs: 60 * 60 * 1000 },
  read: { limit: 200, windowMs: 60 * 1000 },
  write: { limit: 50, windowMs: 60 * 1000 },
  webhook: { limit: 500, windowMs: 60 * 60 * 1000 },
  ingest: { limit: 1000, windowMs: 60 * 1000 },
}

const warned = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.error(`[RateLimit] ${message}`)
}

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

/**
 * The limit and window of a tier: the default of a built-in tier, with the fields `rateLimit.tiers` of
 * app.config sets on top, or the declared numbers of a custom tier (both fields required). A tier that is
 * not built in and not declared, or a declaration with a field that is not a positive integer, never leaves
 * the endpoint without a limit: an invalid field of a built-in tier keeps its default, and an invalid or
 * unknown custom tier is limited as the `api` tier (an error is logged once).
 */
export function getRateLimitTierConfig(tier: RateLimitTier): RateLimitTierConfig {
  // own properties only: a name like "constructor" or "__proto__" is an unknown tier, not an inherited member
  const own = <T extends object>(table: T | undefined): T[keyof T] | undefined =>
    table && Object.prototype.hasOwnProperty.call(table, tier) ? (table as Record<string, T[keyof T]>)[tier] : undefined
  const base = own(DEFAULT_TIERS as Record<string, RateLimitTierConfig>)
  const declared = own((APP_CONFIG_MERGED as { rateLimit?: { tiers?: Record<string, Partial<RateLimitTierConfig>> } }).rateLimit?.tiers)
  const fallback = DEFAULT_TIERS.api

  if (!declared) {
    if (base) return base
    warnOnce(tier, `Unknown rate limit tier "${tier}": limiting it as "api". Declare it in rateLimit.tiers of app.config.`)
    return fallback
  }

  const limit = declared.limit ?? base?.limit
  const windowMs = declared.windowMs ?? base?.windowMs
  const badField = (declared.limit !== undefined && !isPositiveInt(declared.limit)) || (declared.windowMs !== undefined && !isPositiveInt(declared.windowMs))
  if (badField) {
    warnOnce(tier, `Invalid rate limit tier "${tier}" in rateLimit.tiers: limit and windowMs must be positive integers; using ${base ? 'the default of the tier' : '"api"'}.`)
    return base ?? fallback
  }
  if (!isPositiveInt(limit) || !isPositiveInt(windowMs)) {
    warnOnce(tier, `Rate limit tier "${tier}" in rateLimit.tiers needs both limit and windowMs: limiting it as "api".`)
    return fallback
  }
  return { limit, windowMs }
}

function getLimiter(tier: string, { limit, windowMs }: RateLimitTierConfig): Limiter | null {
  if (!redis || !Ratelimit) return null
  const key = `${tier}:${limit}:${windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: true,
      prefix: `ratelimit:${tier}`,
      ephemeralCache: new Map(),
    })
    limiters.set(key, limiter)
  }
  return limiter
}

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID, or combination)
 * @param type - Rate limit tier: 'auth' (5/15min), 'api' (100/1min), 'strict' (10/1hr), 'read' (200/1min), 'write' (50/1min), 'webhook' (500/1hr), 'ingest' (1000/1min), or a tier declared in `rateLimit.tiers` of app.config
 * @returns Promise with success status, remaining requests, and reset timestamp
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitTier = 'api'
): Promise<RateLimitCheckResult> {
  // Try to load modules if not already loaded
  await loadUpstashModules()

  const config = getRateLimitTierConfig(type)
  const limiter = getLimiter(type, config)

  // If no limiter (Redis not configured or modules not available), allow all requests.
  // Log once at error level — this is a security degradation, not just a warning.
  if (!limiter) {
    if (!redisUnconfiguredLogged) {
      redisUnconfiguredLogged = true
      console.error(
        '[RateLimit] CRITICAL: Rate limiting is DISABLED (Redis unavailable).',
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable distributed rate limiting.',
        'All requests are currently allowed through without limit enforcement.'
      )
    }
    return {
      success: true,
      remaining: config.limit,
      reset: Date.now() + 60000,
      limit: config.limit,
    }
  }

  try {
    const result = await limiter.limit(identifier) as { success: boolean; remaining: number; reset: number; limit: number }
    const retryAfter = result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000)

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
      retryAfter,
    }
  } catch (error) {
    // On Redis error, fail open (allow the request) but log the error
    console.error('[RateLimit] Redis error:', error)
    return {
      success: true,
      remaining: config.limit,
      reset: Date.now() + 60000,
      limit: config.limit,
    }
  }
}

/**
 * Check if Redis is configured and available
 */
export async function isRedisConfigured(): Promise<boolean> {
  await loadUpstashModules()
  return redis !== null
}

/**
 * Synchronous check if Redis might be configured (based on env vars)
 * Use this for quick checks, but isRedisConfigured() is more accurate
 */
export function maybeRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitCheckResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }

  if (result.limit) {
    headers['X-RateLimit-Limit'] = String(result.limit)
  }

  if (result.retryAfter !== undefined && result.retryAfter > 0) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}

/**
 * Create rate limit error response
 * Use this to return a consistent 429 response when rate limited
 */
export function createRateLimitResponse(result: RateLimitCheckResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result),
      },
    }
  )
}
