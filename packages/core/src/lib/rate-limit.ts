/**
 * Rate Limiting System
 * 
 * Simple in-memory rate limiting for API endpoints.
 * In production, this should be replaced with Redis or similar.
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitOptions {
  key: string
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Check if request is within rate limit
 */
export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, windowMs, maxRequests } = options
  const now = Date.now()
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupExpiredEntries(now)
  }
  
  const entry = store[key]
  
  if (!entry || now >= entry.resetTime) {
    // Create new entry or reset expired entry
    store[key] = {
      count: 1,
      resetTime: now + windowMs
    }
    
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs
    }
  }
  
  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds
    }
  }
  
  // Increment counter
  entry.count++
  
  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number) {
  Object.keys(store).forEach(key => {
    if (store[key].resetTime <= now) {
      delete store[key]
    }
  })
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string) {
  delete store[key]
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): RateLimitResult | null {
  const entry = store[key]
  const now = Date.now()
  
  if (!entry || now >= entry.resetTime) {
    return null
  }
  
  return {
    success: entry.count < entry.resetTime,
    remaining: Math.max(0, entry.resetTime - entry.count),
    resetTime: entry.resetTime
  }
}