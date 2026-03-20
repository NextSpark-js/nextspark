/**
 * Tests for Rate Limiting System
 *
 * Tests the in-memory rate limiting, distributed rate limit fallback,
 * webhook tier configuration, getClientIp (via withRateLimitTier), and
 * rate limit utility functions.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  clearRateLimit,
  checkDistributedRateLimit,
  withRateLimitTier,
  createRateLimitErrorResponse,
  isDistributedRateLimitAvailable,
  getRateLimitStats,
  getRateLimitCacheStats,
  type RateLimitResult,
} from '@/core/lib/api/rate-limit'

// Ensure Redis is NOT configured so we always exercise the in-memory fallback path
const originalEnv = { ...process.env }

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.DISABLE_RATE_LIMITING
})

afterEach(() => {
  // Clean up any rate limit entries created during tests
  clearRateLimit('test-id')
  clearRateLimit('api:ip:1.2.3.4')
  clearRateLimit('webhook:ip:10.0.0.1')
  clearRateLimit('read:ip:10.0.0.1')
  clearRateLimit('write:ip:10.0.0.1')
  clearRateLimit('auth:ip:10.0.0.1')
  clearRateLimit('strict:ip:10.0.0.1')
  clearRateLimit('api:ip:10.0.0.1')
  clearRateLimit('api:apikey:sk_test_12345678')
  clearRateLimit('webhook:ip:192.168.1.1')
  clearRateLimit('webhook:ip:unknown')
  clearRateLimit('api:ip:unknown')
  clearRateLimit('api:ip:203.0.113.50')
  clearRateLimit('api:ip:198.51.100.1')
  clearRateLimit('api:ip:100.200.300.400')
  clearRateLimit('burst-test')
  clearRateLimit('window-test')
  // Restore env
  process.env = { ...originalEnv }
})

// ---------------------------------------------------------------------------
// checkRateLimit (in-memory)
// ---------------------------------------------------------------------------

describe('checkRateLimit (in-memory)', () => {
  it('should allow the first request', () => {
    const result = checkRateLimit('test-id', 10, 60000)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
    expect(result.limit).toBe(10)
    expect(result.resetTime).toBeGreaterThan(Date.now() - 1000)
  })

  it('should track count across consecutive calls', () => {
    const r1 = checkRateLimit('test-id', 5, 60000)
    const r2 = checkRateLimit('test-id', 5, 60000)
    const r3 = checkRateLimit('test-id', 5, 60000)

    expect(r1.remaining).toBe(4)
    expect(r2.remaining).toBe(3)
    expect(r3.remaining).toBe(2)
  })

  it('should block requests when limit is exceeded', () => {
    const limit = 3

    checkRateLimit('test-id', limit, 60000) // 1
    checkRateLimit('test-id', limit, 60000) // 2
    checkRateLimit('test-id', limit, 60000) // 3 - at limit

    const blocked = checkRateLimit('test-id', limit, 60000) // 4 - over limit

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('should return correct remaining count at each step', () => {
    const limit = 5

    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit('test-id', limit, 60000)
      expect(r.remaining).toBe(limit - 1 - i)
      expect(r.allowed).toBe(true)
    }

    // One more should be blocked
    const blocked = checkRateLimit('test-id', limit, 60000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('should use default limit and window when not specified', () => {
    const result = checkRateLimit('test-id')

    expect(result.allowed).toBe(true)
    // Default limit is 1000 per the function signature
    expect(result.remaining).toBe(999)
    expect(result.limit).toBe(1000)
  })

  it('should maintain separate counters for different identifiers', () => {
    checkRateLimit('id-a', 2, 60000)
    checkRateLimit('id-a', 2, 60000)
    const blockedA = checkRateLimit('id-a', 2, 60000)

    const allowedB = checkRateLimit('id-b', 2, 60000)

    expect(blockedA.allowed).toBe(false)
    expect(allowedB.allowed).toBe(true)
    expect(allowedB.remaining).toBe(1)

    // Clean up extra identifiers
    clearRateLimit('id-a')
    clearRateLimit('id-b')
  })
})

// ---------------------------------------------------------------------------
// clearRateLimit
// ---------------------------------------------------------------------------

describe('clearRateLimit', () => {
  it('should reset the counter so subsequent requests are allowed', () => {
    const limit = 2
    checkRateLimit('test-id', limit, 60000)
    checkRateLimit('test-id', limit, 60000)

    // Should be blocked now
    expect(checkRateLimit('test-id', limit, 60000).allowed).toBe(false)

    // Clear and retry
    clearRateLimit('test-id')

    const afterClear = checkRateLimit('test-id', limit, 60000)
    expect(afterClear.allowed).toBe(true)
    expect(afterClear.remaining).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// checkDistributedRateLimit (fallback to in-memory)
// ---------------------------------------------------------------------------

describe('checkDistributedRateLimit (in-memory fallback)', () => {
  it('should allow first request and return correct shape', async () => {
    const result = await checkDistributedRateLimit('api:ip:1.2.3.4', 'api')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeLessThanOrEqual(100)
    expect(result.limit).toBe(100)
    expect(result.resetTime).toBeGreaterThan(Date.now() - 1000)
    expect(result.retryAfter).toBeUndefined()
  })

  it('should use webhook tier with 500 limit and 1hr window', async () => {
    const result = await checkDistributedRateLimit('webhook:ip:10.0.0.1', 'webhook')

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(500)
    expect(result.remaining).toBe(499)
    // The reset time should be roughly 1 hour from now (within tolerance)
    const oneHourMs = 60 * 60 * 1000
    const resetDelta = result.resetTime - Date.now()
    expect(resetDelta).toBeGreaterThan(oneHourMs - 5000)
    expect(resetDelta).toBeLessThanOrEqual(oneHourMs + 1000)
  })

  it('should use auth tier with 5 limit', async () => {
    const result = await checkDistributedRateLimit('auth:ip:10.0.0.1', 'auth')
    expect(result.limit).toBe(5)
    expect(result.remaining).toBe(4)
  })

  it('should use strict tier with 10 limit', async () => {
    const result = await checkDistributedRateLimit('strict:ip:10.0.0.1', 'strict')
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
  })

  it('should use read tier with 200 limit', async () => {
    const result = await checkDistributedRateLimit('read:ip:10.0.0.1', 'read')
    expect(result.limit).toBe(200)
    expect(result.remaining).toBe(199)
  })

  it('should use write tier with 50 limit', async () => {
    const result = await checkDistributedRateLimit('write:ip:10.0.0.1', 'write')
    expect(result.limit).toBe(50)
    expect(result.remaining).toBe(49)
  })

  it('should block after exceeding in-memory webhook limit', async () => {
    // Exhaust the webhook limit (500 requests)
    // To avoid 500 iterations, we use checkRateLimit directly with the same key
    // that checkDistributedRateLimit would use
    const identifier = 'webhook:webhook:ip:192.168.1.1'

    // Use the lower-level checkRateLimit to fill up the counter quickly
    for (let i = 0; i < 500; i++) {
      checkRateLimit(identifier, 500, 60 * 60 * 1000)
    }

    // Now the distributed check should show blocked
    const result = await checkDistributedRateLimit('webhook:ip:192.168.1.1', 'webhook')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)

    // Clean up
    clearRateLimit(identifier)
  })

  it('should return retryAfter when blocked', async () => {
    const identifier = 'webhook:webhook:ip:192.168.1.1'

    for (let i = 0; i < 500; i++) {
      checkRateLimit(identifier, 500, 60 * 60 * 1000)
    }

    const result = await checkDistributedRateLimit('webhook:ip:192.168.1.1', 'webhook')
    expect(result.retryAfter).toBeDefined()
    expect(typeof result.retryAfter).toBe('number')
    // retryAfter should be in seconds, roughly up to 3600
    expect(result.retryAfter!).toBeGreaterThan(0)
    expect(result.retryAfter!).toBeLessThanOrEqual(3600)

    clearRateLimit(identifier)
  })
})

// ---------------------------------------------------------------------------
// isDistributedRateLimitAvailable
// ---------------------------------------------------------------------------

describe('isDistributedRateLimitAvailable', () => {
  it('should return false when Redis env vars are not set', () => {
    expect(isDistributedRateLimitAvailable()).toBe(false)
  })

  it('should return true when Redis env vars are set', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    expect(isDistributedRateLimitAvailable()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// withRateLimitTier - getClientIp and getUserIdentifier integration
// ---------------------------------------------------------------------------

describe('withRateLimitTier', () => {
  function createMockRequest(
    url: string = 'http://localhost:3000/api/test',
    options: { method?: string; headers?: Record<string, string> } = {}
  ) {
    return new NextRequest(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }) as unknown as NextRequest
  }

  const successHandler = async (_req: NextRequest) => {
    return NextResponse.json({ success: true })
  }

  it('should pass requests through when within rate limit', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')
    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const res = await wrapped(req)
    const body = typeof res.body === 'object' ? res.body : JSON.parse(String(res.body))

    expect(body.success).toBe(true)
  })

  it('should add rate limit headers to successful responses', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')
    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const res = await wrapped(req)

    // The mock NextResponse uses a Map for headers
    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
  })

  it('should extract IP from cf-connecting-ip header (Cloudflare)', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')

    // First exhaust limit for cf IP
    const cfIp = '203.0.113.50'
    const cfIdentifier = `api:api:ip:${cfIp}`
    for (let i = 0; i < 100; i++) {
      checkRateLimit(cfIdentifier, 100, 60000)
    }

    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'cf-connecting-ip': cfIp },
    })

    const res = await wrapped(req)
    // Should be rate limited (429)
    expect(res.status).toBe(429)

    clearRateLimit(cfIdentifier)
  })

  it('should extract rightmost IP from x-forwarded-for header', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')

    // The rightmost IP is 198.51.100.1
    const rightmostIp = '198.51.100.1'
    const identifier = `api:api:ip:${rightmostIp}`
    for (let i = 0; i < 100; i++) {
      checkRateLimit(identifier, 100, 60000)
    }

    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1, 198.51.100.1' },
    })

    const res = await wrapped(req)
    expect(res.status).toBe(429)

    clearRateLimit(identifier)
  })

  it('should extract IP from x-real-ip header', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')

    const realIp = '100.200.300.400'
    const identifier = `api:api:ip:${realIp}`
    for (let i = 0; i < 100; i++) {
      checkRateLimit(identifier, 100, 60000)
    }

    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-real-ip': realIp },
    })

    const res = await wrapped(req)
    expect(res.status).toBe(429)

    clearRateLimit(identifier)
  })

  it('should fall back to "unknown" when no IP headers present', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')

    const identifier = 'api:api:ip:unknown'
    for (let i = 0; i < 100; i++) {
      checkRateLimit(identifier, 100, 60000)
    }

    const req = createMockRequest('http://localhost:3000/api/test')

    const res = await wrapped(req)
    expect(res.status).toBe(429)

    clearRateLimit(identifier)
  })

  it('should use API key as identifier when x-api-key header is present', async () => {
    const wrapped = withRateLimitTier(successHandler, 'api')
    const apiKey = 'sk_test_1234567890abcdef1234567890abcdef'

    const identifier = `api:api:apikey:${apiKey.substring(0, 16)}`
    for (let i = 0; i < 100; i++) {
      checkRateLimit(identifier, 100, 60000)
    }

    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-api-key': apiKey },
    })

    const res = await wrapped(req)
    expect(res.status).toBe(429)

    clearRateLimit(identifier)
  })

  it('should use the specified rate limit tier', async () => {
    const wrapped = withRateLimitTier(successHandler, 'webhook')
    const req = createMockRequest('http://localhost:3000/api/webhook', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const res = await wrapped(req)
    const body = typeof res.body === 'object' ? res.body : JSON.parse(String(res.body))

    expect(body.success).toBe(true)
    // webhook tier has 500 limit
    expect(res.headers.get('X-RateLimit-Limit')).toBe('500')
  })

  it('should skip rate limiting when DISABLE_RATE_LIMITING is true', async () => {
    process.env.DISABLE_RATE_LIMITING = 'true'

    // Exhaust the limit first
    const identifier = 'api:api:ip:10.0.0.1'
    for (let i = 0; i < 100; i++) {
      checkRateLimit(identifier, 100, 60000)
    }

    const wrapped = withRateLimitTier(successHandler, 'api')
    const req = createMockRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    const res = await wrapped(req)
    // Should NOT be rate limited because DISABLE_RATE_LIMITING=true
    const body = typeof res.body === 'object' ? res.body : JSON.parse(String(res.body))
    expect(body.success).toBe(true)

    clearRateLimit(identifier)
  })
})

// ---------------------------------------------------------------------------
// createRateLimitErrorResponse
// ---------------------------------------------------------------------------

describe('createRateLimitErrorResponse', () => {
  it('should return a 429 response with correct structure', () => {
    const rateLimitResult: RateLimitResult & { retryAfter?: number } = {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      limit: 100,
      retryAfter: 60,
    }

    const response = createRateLimitErrorResponse(rateLimitResult)

    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('should include error details in response body', () => {
    const rateLimitResult: RateLimitResult & { retryAfter?: number } = {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      limit: 50,
      retryAfter: 30,
    }

    const response = createRateLimitErrorResponse(rateLimitResult)
    // Body should be the data object passed to NextResponse.json
    const body = typeof response.body === 'object' ? response.body : null

    expect(body).toBeDefined()
    if (body && typeof body === 'object') {
      expect((body as Record<string, unknown>).success).toBe(false)
      expect((body as Record<string, unknown>).error).toBe('Rate limit exceeded')
      expect((body as Record<string, unknown>).code).toBe('RATE_LIMIT_EXCEEDED')
    }
  })
})

// ---------------------------------------------------------------------------
// getRateLimitStats
// ---------------------------------------------------------------------------

describe('getRateLimitStats', () => {
  it('should return null for unknown keyId', () => {
    const stats = getRateLimitStats('nonexistent-key')
    expect(stats).toBeNull()
  })

  it('should return stats after rate limit entries exist', () => {
    // Create some rate limit entries
    checkRateLimit('test-id', 100, 60000)

    const stats = getRateLimitStats('test-id')

    expect(stats).not.toBeNull()
    expect(stats!.currentUsage).toBe(1)
    expect(stats!.resetTime).toBeGreaterThan(Date.now() - 1000)
    expect(typeof stats!.isNearLimit).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// getRateLimitCacheStats
// ---------------------------------------------------------------------------

describe('getRateLimitCacheStats', () => {
  it('should return cache statistics', () => {
    const stats = getRateLimitCacheStats()

    expect(stats).toBeDefined()
    expect(typeof stats.total).toBe('number')
    expect(typeof stats.active).toBe('number')
    expect(typeof stats.expired).toBe('number')
    expect(typeof stats.maxSize).toBe('number')
  })
})
