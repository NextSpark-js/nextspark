/**
 * In-memory sliding window rate limiter.
 */

interface RateLimitWindow {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Map<userId, timestamp[]>
const requestLog = new Map<string, number[]>()

// Cleanup old entries every 10 minutes
const cleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [key, timestamps] of requestLog) {
    const filtered = timestamps.filter((t) => t > cutoff)
    if (filtered.length === 0) {
      requestLog.delete(key)
    } else {
      requestLog.set(key, filtered)
    }
  }
}, 10 * 60 * 1000)
cleanupInterval.unref()

/**
 * Check rate limits against multiple windows.
 * Returns the most restrictive result.
 */
export function checkRateLimit(
  userId: string,
  windows: RateLimitWindow[]
): RateLimitResult {
  const now = Date.now()
  const timestamps = requestLog.get(userId) || []

  // Check each window — return first violation
  for (const window of windows) {
    const windowStart = now - window.windowMs
    const recentRequests = timestamps.filter((t) => t > windowStart)

    if (recentRequests.length >= window.limit) {
      const oldestInWindow = Math.min(...recentRequests)
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + window.windowMs,
      }
    }
  }

  // All windows pass — record the request
  timestamps.push(now)
  requestLog.set(userId, timestamps)

  // Calculate minimum remaining across all windows
  const remaining = Math.min(
    ...windows.map((w) => {
      const recent = timestamps.filter((t) => t > now - w.windowMs)
      return w.limit - recent.length
    })
  )

  return {
    allowed: true,
    remaining,
    resetAt: now + Math.min(...windows.map((w) => w.windowMs)),
  }
}

/** Preset rate limits for AI endpoints */
export const AI_RATE_LIMITS: RateLimitWindow[] = [
  { limit: 10, windowMs: 60 * 60 * 1000 },        // 10 per hour
  { limit: 50, windowMs: 24 * 60 * 60 * 1000 },    // 50 per day
]

/** Build a 429 Response with Retry-After header */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return Response.json(
    { error: 'Rate limit exceeded. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(retryAfter, 1)) },
    }
  )
}

// Export for testing
export function _clearForTesting() {
  requestLog.clear()
}
