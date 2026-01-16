/**
 * Distributed Rate Limiting System with Redis (Upstash)
 *
 * This module provides distributed rate limiting using Upstash Redis,
 * which works correctly in multi-instance deployments.
 *
 * Falls back gracefully when Redis is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client only if credentials are configured
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

/**
 * Auth Rate Limiter
 * Strict limits for authentication endpoints (login, register, password reset)
 * 5 requests per 15 minutes per identifier
 */
export const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : null

/**
 * API Rate Limiter
 * Standard limits for general API endpoints
 * 100 requests per 1 minute per identifier
 */
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null

/**
 * Strict Rate Limiter
 * Very strict limits for sensitive operations (password change, email change)
 * 10 requests per 1 hour per identifier
 */
export const strictRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:strict',
    })
  : null

export interface RateLimitCheckResult {
  success: boolean
  remaining: number
  reset: number
  limit?: number
}

/**
 * Check rate limit for a given identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID, or combination)
 * @param limiter - The rate limiter to use (authRateLimiter, apiRateLimiter, or strictRateLimiter)
 * @returns Promise with success status, remaining requests, and reset timestamp
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit | null
): Promise<RateLimitCheckResult> {
  // If no limiter (Redis not configured), allow all requests
  if (!limiter) {
    return {
      success: true,
      remaining: 100,
      reset: Date.now() + 60000,
    }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
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
export function isRedisConfigured(): boolean {
  return redis !== null
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitCheckResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
    ...(result.limit ? { 'X-RateLimit-Limit': String(result.limit) } : {}),
  }
}
