import { checkRateLimit, _clearForTesting, rateLimitResponse, AI_RATE_LIMITS } from './rate-limit'

beforeEach(() => {
  _clearForTesting()
})

const WINDOWS = [
  { limit: 3, windowMs: 60 * 1000 },      // 3 per minute
  { limit: 5, windowMs: 60 * 60 * 1000 },  // 5 per hour
]

describe('checkRateLimit', () => {
  it('allows requests within limits', () => {
    const r1 = checkRateLimit('user-1', WINDOWS)
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2) // 3-1 = 2 (minute window is tighter)

    const r2 = checkRateLimit('user-1', WINDOWS)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)
  })

  it('blocks requests exceeding the short window limit', () => {
    checkRateLimit('user-2', WINDOWS)
    checkRateLimit('user-2', WINDOWS)
    checkRateLimit('user-2', WINDOWS)

    const r4 = checkRateLimit('user-2', WINDOWS)
    expect(r4.allowed).toBe(false)
    expect(r4.remaining).toBe(0)
    expect(r4.resetAt).toBeGreaterThan(Date.now())
  })

  it('blocks requests exceeding the long window limit', () => {
    // Use windows where the short limit is high
    const longOnly = [
      { limit: 100, windowMs: 60 * 1000 },
      { limit: 2, windowMs: 60 * 60 * 1000 },
    ]

    checkRateLimit('user-3', longOnly)
    checkRateLimit('user-3', longOnly)

    const r3 = checkRateLimit('user-3', longOnly)
    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('returns correct remaining count', () => {
    const r1 = checkRateLimit('user-4', WINDOWS)
    expect(r1.remaining).toBe(2) // 3-1

    const r2 = checkRateLimit('user-4', WINDOWS)
    expect(r2.remaining).toBe(1) // 3-2

    const r3 = checkRateLimit('user-4', WINDOWS)
    expect(r3.remaining).toBe(0) // 3-3
  })

  it('tracks users independently', () => {
    checkRateLimit('alice', WINDOWS)
    checkRateLimit('alice', WINDOWS)
    checkRateLimit('alice', WINDOWS)

    // Alice is blocked
    const rAlice = checkRateLimit('alice', WINDOWS)
    expect(rAlice.allowed).toBe(false)

    // Bob is fine
    const rBob = checkRateLimit('bob', WINDOWS)
    expect(rBob.allowed).toBe(true)
    expect(rBob.remaining).toBe(2)
  })
})

describe('rateLimitResponse', () => {
  it('returns 429 with Retry-After header', () => {
    const futureReset = Date.now() + 30_000 // 30 seconds from now
    const response = rateLimitResponse(futureReset)
    expect(response.status).toBe(429)
    const retryAfter = Number(response.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(31) // ~30 seconds, with 1s tolerance
  })

  it('sets Retry-After to at least 1 even with past resetAt', () => {
    const pastReset = Date.now() - 5000 // 5 seconds ago
    const response = rateLimitResponse(pastReset)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('1')
  })
})

describe('AI_RATE_LIMITS', () => {
  it('defines 2 windows: hourly and daily', () => {
    expect(AI_RATE_LIMITS).toHaveLength(2)
    expect(AI_RATE_LIMITS[0].limit).toBe(10)
    expect(AI_RATE_LIMITS[0].windowMs).toBe(60 * 60 * 1000)
    expect(AI_RATE_LIMITS[1].limit).toBe(50)
    expect(AI_RATE_LIMITS[1].windowMs).toBe(24 * 60 * 60 * 1000)
  })
})
