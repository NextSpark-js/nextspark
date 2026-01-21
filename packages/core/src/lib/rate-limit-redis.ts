/**
 * Distributed Rate Limiting System with Redis (Upstash)
 *
 * This module provides distributed rate limiting using Upstash Redis,
 * which works correctly in multi-instance deployments.
 *
 * Falls back gracefully when Redis is not configured or dependencies aren't available.
 */

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

// Lazy-loaded instances
let redis: unknown | null = null
let authRateLimiterInstance: ReturnType<UpstashRatelimit['prototype']['limit']> extends Promise<infer R>
  ? { limit: (id: string) => Promise<R> } | null
  : never = null
let apiRateLimiterInstance: ReturnType<UpstashRatelimit['prototype']['limit']> extends Promise<infer R>
  ? { limit: (id: string) => Promise<R> } | null
  : never = null
let strictRateLimiterInstance: ReturnType<UpstashRatelimit['prototype']['limit']> extends Promise<infer R>
  ? { limit: (id: string) => Promise<R> } | null
  : never = null
let readRateLimiterInstance: ReturnType<UpstashRatelimit['prototype']['limit']> extends Promise<infer R>
  ? { limit: (id: string) => Promise<R> } | null
  : never = null
let writeRateLimiterInstance: ReturnType<UpstashRatelimit['prototype']['limit']> extends Promise<infer R>
  ? { limit: (id: string) => Promise<R> } | null
  : never = null

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

      // Initialize rate limiters
      authRateLimiterInstance = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '15 m'),
        analytics: true,
        prefix: 'ratelimit:auth',
        ephemeralCache: new Map(),
      })

      apiRateLimiterInstance = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
        prefix: 'ratelimit:api',
        ephemeralCache: new Map(),
      })

      strictRateLimiterInstance = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        analytics: true,
        prefix: 'ratelimit:strict',
        ephemeralCache: new Map(),
      })

      readRateLimiterInstance = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, '1 m'),
        analytics: true,
        prefix: 'ratelimit:read',
        ephemeralCache: new Map(),
      })

      writeRateLimiterInstance = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 m'),
        analytics: true,
        prefix: 'ratelimit:write',
        ephemeralCache: new Map(),
      })
    }

    modulesLoaded = true
    return true
  } catch (error) {
    loadError = error as Error
    modulesLoaded = true
    // Log only in development, not during build
    if (process.env.NODE_ENV === 'development') {
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
 * Rate limit tiers available for API endpoints
 */
export type RateLimitTier = 'auth' | 'api' | 'strict' | 'read' | 'write'

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID, or combination)
 * @param type - Rate limit tier: 'auth' (5/15min), 'api' (100/1min), 'strict' (10/1hr), 'read' (200/1min), 'write' (50/1min)
 * @returns Promise with success status, remaining requests, and reset timestamp
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitTier = 'api'
): Promise<RateLimitCheckResult> {
  // Try to load modules if not already loaded
  await loadUpstashModules()

  // Select the appropriate limiter
  const limiterMap: Record<RateLimitTier, typeof authRateLimiterInstance> = {
    auth: authRateLimiterInstance,
    api: apiRateLimiterInstance,
    strict: strictRateLimiterInstance,
    read: readRateLimiterInstance,
    write: writeRateLimiterInstance,
  }
  const limiter = limiterMap[type]

  // If no limiter (Redis not configured or modules not available), allow all requests
  // Log warning to alert operators that rate limiting is disabled
  if (!limiter) {
    console.warn('[RateLimit] FALLBACK MODE: Rate limiting disabled - Redis unavailable. Identifier:', identifier, 'Tier:', type)
    return {
      success: true,
      remaining: 100,
      reset: Date.now() + 60000,
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
      remaining: 100,
      reset: Date.now() + 60000,
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
