/**
 * The per-credential limit shared between instances (#541): with Redis configured an API key or an MCP connection
 * is counted in the shared store, so every instance of a serverless deployment sees the same count. Without Redis
 * the count is the one of the process, as before.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  queryWithRLS: jest.fn(async () => []),
  mutateWithRLS: jest.fn(async () => ({ rows: [], rowCount: 0 })),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn(async () => null) } } }))

const redis = {
  configured: false,
  check: jest.fn<(identifier: string, tier: string) => Promise<{ success: boolean; remaining: number; reset: number; limit?: number }>>(),
}
jest.mock('@/core/lib/rate-limit-redis', () => ({
  checkRateLimit: (identifier: string, tier: string) => redis.check(identifier, tier),
  maybeRedisConfigured: () => redis.configured,
  getRateLimitTierConfig: () => ({ limit: 1000, windowMs: 60_000 }),
}))

import { NextRequest } from 'next/server'
import { rateLimitCache, getCacheKey } from '@/core/lib/api/cache'
import { credentialRateLimitResponse } from '@/core/lib/api/rate-limit'

const request = () => new NextRequest('http://localhost:3000/api/mcp', { method: 'POST' })
const credential = (keyId: string) => ({ keyId, userId: 'user-1', scopes: ['tasks:read'] })
const allowed = () => ({ success: true, remaining: 10, reset: Date.now() + 60_000, limit: 1000 })
const over = () => ({ success: false, remaining: 0, reset: Date.now() + 30_000, limit: 1000 })

beforeEach(() => {
  jest.clearAllMocks()
  redis.configured = false
  redis.check.mockResolvedValue(allowed())
})

describe('the per-credential limit', () => {
  it('without Redis is the count of this process, and the shared store is not asked', async () => {
    expect(await credentialRateLimitResponse(request(), credential('oauth:no-redis'))).toBeNull()
    expect(redis.check).not.toHaveBeenCalled()
  })

  it('with Redis is counted in the shared store, by the credential, in the tier of its own', async () => {
    redis.configured = true
    expect(await credentialRateLimitResponse(request(), credential('oauth:client|user|team'))).toBeNull()
    expect(redis.check).toHaveBeenCalledTimes(1)
    expect(redis.check).toHaveBeenCalledWith('oauth:client|user|team', 'credential')
  })

  it('counts a request once in the shared store however many times it is authenticated', async () => {
    redis.configured = true
    const one = request()
    await credentialRateLimitResponse(one, credential('key-once'))
    await credentialRateLimitResponse(one, credential('key-once'))
    await credentialRateLimitResponse(request(), credential('key-once'))
    expect(redis.check).toHaveBeenCalledTimes(2)
  })

  it('refuses with a 429 that says when to retry once the shared count is over, though this process counted little', async () => {
    redis.configured = true
    redis.check.mockResolvedValue(over())
    const response = await credentialRateLimitResponse(request(), credential('key-shared-over'))
    expect(response?.status).toBe(429)
    expect(await response!.json()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', message: expect.stringContaining('1000') })
    const retryAfter = Number(response!.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(30)
  })

  it('a credential over the count of this process is refused without asking the shared store', async () => {
    redis.configured = true
    rateLimitCache.set(getCacheKey('rate_limit', 'key-local-over'), { count: 1000, resetTime: Date.now() + 60_000 }, 60_000)
    const response = await credentialRateLimitResponse(request(), credential('key-local-over'))
    expect(response?.status).toBe(429)
    expect(redis.check).not.toHaveBeenCalled()
  })

  it('two instances share one count: the request that takes it over the limit is refused wherever it lands', async () => {
    redis.configured = true
    // the shared store as two instances see it: one counter for the credential, limit 3
    let count = 0
    redis.check.mockImplementation(async () => (++count <= 3 ? allowed() : over()))
    const results: Array<number | null> = []
    for (let i = 0; i < 5; i++) results.push((await credentialRateLimitResponse(request(), credential('key-two-instances')))?.status ?? null)
    expect(results).toEqual([null, null, null, 429, 429])
  })
})
