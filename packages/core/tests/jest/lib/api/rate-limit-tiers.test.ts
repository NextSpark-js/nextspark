/**
 * Rate limit tiers: the defaults are unchanged, `rateLimit.tiers` of app.config overrides a built-in tier or
 * declares a new one, and a tier that is undeclared or invalid is still limited (as `api`), never open.
 * Both paths: the in-memory one and the Redis one (Upstash mocked).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  queryWithRLS: jest.fn(async () => []),
  mutateWithRLS: jest.fn(async () => ({ rows: [], rowCount: 0 })),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn(async () => null) } } }))

const mockConfig: { rateLimit?: { tiers?: Record<string, unknown> } } = {}
jest.mock('@/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: mockConfig, API_CONFIG: {} }))

const mockSlidingWindow = jest.fn((limit: number, window: string) => ({ limit, window }))
const mockCreated: Array<{ prefix: string; limiter: { limit: number; window: string } }> = []
jest.mock('@upstash/redis', () => ({ Redis: class {} }))
jest.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = (...a: [number, string]) => mockSlidingWindow(...a)
    private count = 0
    constructor(private opts: { prefix: string; limiter: { limit: number; window: string } }) {
      mockCreated.push(opts)
    }
    async limit() {
      this.count++
      const max = this.opts.limiter.limit
      return { success: this.count <= max, remaining: Math.max(0, max - this.count), reset: Date.now() + 1000, limit: max }
    }
  }
  return { Ratelimit }
})

import { checkDistributedRateLimit } from '@/core/lib/api/rate-limit'
import { getRateLimitTierConfig } from '@/core/lib/rate-limit-redis'

const saved = { ...process.env }
beforeEach(() => {
  delete process.env.DISABLE_RATE_LIMITING
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete mockConfig.rateLimit
  mockCreated.length = 0
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  process.env = { ...saved }
  jest.restoreAllMocks()
})

let n = 0
const id = () => `tiers-test-${++n}`

describe('defaults', () => {
  it('keeps the limit and window of every built-in tier', () => {
    expect(getRateLimitTierConfig('auth')).toEqual({ limit: 5, windowMs: 15 * 60_000 })
    expect(getRateLimitTierConfig('api')).toEqual({ limit: 100, windowMs: 60_000 })
    expect(getRateLimitTierConfig('strict')).toEqual({ limit: 10, windowMs: 3_600_000 })
    expect(getRateLimitTierConfig('read')).toEqual({ limit: 200, windowMs: 60_000 })
    expect(getRateLimitTierConfig('write')).toEqual({ limit: 50, windowMs: 60_000 })
    expect(getRateLimitTierConfig('webhook')).toEqual({ limit: 500, windowMs: 3_600_000 })
  })

  it('has an ingest tier', async () => {
    expect(getRateLimitTierConfig('ingest')).toEqual({ limit: 1000, windowMs: 60_000 })
    const r = await checkDistributedRateLimit(id(), 'ingest')
    expect(r.limit).toBe(1000)
    expect(r.remaining).toBe(999)
  })
})

describe('in-memory path', () => {
  it('limits a custom tier declared in config', async () => {
    mockConfig.rateLimit = { tiers: { exports: { limit: 2, windowMs: 60_000 } } }
    const who = id()
    expect((await checkDistributedRateLimit(who, 'exports')).allowed).toBe(true)
    expect((await checkDistributedRateLimit(who, 'exports')).allowed).toBe(true)
    const third = await checkDistributedRateLimit(who, 'exports')
    expect(third.allowed).toBe(false)
    expect(third.limit).toBe(2)
  })

  it('overrides the limit of a built-in tier and keeps its window', async () => {
    mockConfig.rateLimit = { tiers: { write: { limit: 1 } } }
    expect(getRateLimitTierConfig('write')).toEqual({ limit: 1, windowMs: 60_000 })
    const who = id()
    expect((await checkDistributedRateLimit(who, 'write')).allowed).toBe(true)
    expect((await checkDistributedRateLimit(who, 'write')).allowed).toBe(false)
    expect(getRateLimitTierConfig('read').limit).toBe(200)
  })

  it('limits an undeclared tier as api instead of leaving it open', async () => {
    expect(getRateLimitTierConfig('nope')).toEqual({ limit: 100, windowMs: 60_000 })
    const who = id()
    const results = []
    for (let i = 0; i < 101; i++) results.push((await checkDistributedRateLimit(who, 'nope')).allowed)
    expect(results.filter(Boolean)).toHaveLength(100)
  })

  it.each([
    ['a custom tier with a bad limit', { custom: { limit: 0, windowMs: 1000 } }, 'custom', { limit: 100, windowMs: 60_000 }],
    ['a custom tier with a missing window', { custom: { limit: 5 } }, 'custom', { limit: 100, windowMs: 60_000 }],
    ['a custom tier with NaN', { custom: { limit: Number.NaN, windowMs: 1000 } }, 'custom', { limit: 100, windowMs: 60_000 }],
    ['a built-in tier with a bad value', { auth: { limit: -3 } }, 'auth', { limit: 5, windowMs: 15 * 60_000 }],
    ['a built-in tier with a string value', { read: { windowMs: '1m' } }, 'read', { limit: 200, windowMs: 60_000 }],
  ])('falls back to a limit for %s', (_n, tiers, tier, expected) => {
    mockConfig.rateLimit = { tiers }
    expect(getRateLimitTierConfig(tier)).toEqual(expected)
  })
})

describe('Redis path', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
  })

  it('builds a limiter for a custom tier from its numbers', async () => {
    mockConfig.rateLimit = { tiers: { exports: { limit: 2, windowMs: 30_000 } } }
    const who = id()
    expect((await checkDistributedRateLimit(who, 'exports')).allowed).toBe(true)
    expect((await checkDistributedRateLimit(who, 'exports')).allowed).toBe(true)
    const third = await checkDistributedRateLimit(who, 'exports')
    expect(third.allowed).toBe(false)
    expect(third.limit).toBe(2)
    expect(mockCreated.map((c) => c.prefix)).toEqual(['ratelimit:exports'])
    expect(mockSlidingWindow).toHaveBeenLastCalledWith(2, '30000 ms')
  })

  it('applies an override of a built-in tier', async () => {
    mockConfig.rateLimit = { tiers: { api: { limit: 3 } } }
    const r = await checkDistributedRateLimit(id(), 'api')
    expect(r.limit).toBe(3)
  })

  it('uses the default numbers and the usual prefix for a built-in tier', async () => {
    await checkDistributedRateLimit(id(), 'auth')
    expect(mockCreated).toHaveLength(1)
    expect(mockCreated[0].prefix).toBe('ratelimit:auth')
    expect(mockCreated[0].limiter).toEqual({ limit: 5, window: '900000 ms' })
  })

  it('limits an undeclared tier as api', async () => {
    const r = await checkDistributedRateLimit(id(), 'nope')
    expect(r.limit).toBe(100)
  })
})
