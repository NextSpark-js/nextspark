/**
 * The per-key limit (1000 requests per minute per validated API key) on routes that authenticate with
 * authenticateRequest, on top of the per-address limit of withRateLimitTier; counted once per request.
 */
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  queryWithRLS: jest.fn(async () => []),
  mutateWithRLS: jest.fn(async () => ({ rows: [], rowCount: 0 })),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn(async () => null) } } }))

import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/core/lib/db'
import { ApiKeyManager } from '@/core/lib/api/keys'
import { rateLimitCache, getCacheKey } from '@/core/lib/api/cache'
import { withRateLimitTier } from '@/core/lib/api/rate-limit'
import { authenticateRequest, createAuthFailureResponse } from '@/core/lib/api/auth/dual-auth'
import { validateAndAuthenticateRequest } from '@/core/lib/api/helpers'

const mockedQueryOne = queryOne as unknown as jest.Mock
const KEY_LIMIT = 1000

const saved = process.env.DISABLE_RATE_LIMITING
delete process.env.DISABLE_RATE_LIMITING
afterAll(() => {
  if (saved !== undefined) process.env.DISABLE_RATE_LIMITING = saved
})

/** Keys the mocked database knows, by hash. */
const keysByHash = new Map<string, { id: string; userId: string }>()
async function newKey(id: string, userId: string) {
  const { key, hash } = await ApiKeyManager.generateApiKey()
  keysByHash.set(hash, { id, userId })
  return key
}

beforeEach(() => {
  mockedQueryOne.mockImplementation(async (sql: unknown, params: unknown) => {
    if (!String(sql).includes('WHERE "keyHash"')) return null
    const row = keysByHash.get((params as string[])[0])
    return row ? { ...row, scopes: ['users:read'], status: 'active', expiresAt: null, failedAttempts: 0, lockedUntil: null } : null
  })
})

/** A dual-auth route behind the per-address wrapper, like /api/v1/users/[id]. */
const route = withRateLimitTier(async (req: NextRequest) => {
  const authResult = await authenticateRequest(req, { requiredScope: 'users:read' })
  if (!authResult.success || !authResult.user) return createAuthFailureResponse(authResult)
  return NextResponse.json({ user: authResult.user.id })
}, 'read')

const call = (key: string, address: string) =>
  route(new NextRequest('https://app.example.com/api/v1/users/me', { headers: { 'x-api-key': key, 'x-forwarded-for': address } }))

/** `count` requests with `key`, each from its own address, so only the per-key limit can stop them. */
async function spread(key: string, count: number, tag: string): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < count; i++) {
    statuses.push((await call(key, `10.${tag}.${Math.floor(i / 250)}.${i % 250}`)).status)
  }
  return statuses
}

describe('authenticateRequest per-key limit', () => {
  it('limits one key used from many addresses, and leaves another key from the same address alone', async () => {
    const keyA = await newKey('key-a', 'user-a')
    const keyB = await newKey('key-b', 'user-b')

    const statuses = await spread(keyA, KEY_LIMIT, '1')
    expect(statuses.every(status => status === 200)).toBe(true)

    // Over its budget: refused from a fresh address, with a 429 that says when to retry
    const limited = await call(keyA, '192.0.2.10')
    expect(limited.status).toBe(429)
    expect((await limited.json()).code).toBe('RATE_LIMIT_EXCEEDED')
    expect(limited.headers.get('Retry-After')).toMatch(/^\d+$/)
    // The per-key limit's own headers, not the address bucket's (which has room left)
    expect(limited.headers.get('X-RateLimit-Limit')).toBe(String(KEY_LIMIT))
    expect(limited.headers.get('X-RateLimit-Remaining')).toBe('0')

    // Another key behind that same address has its own budget
    const other = await call(keyB, '192.0.2.10')
    expect(other.status).toBe(200)
    expect((await other.json()).user).toBe('user-b')
  })

  it('keeps the per-address limit: several keys from one address share it', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 201; i++) statuses.push((await call(await newKey(`key-addr-${i}`, 'user-c'), '198.51.100.20')).status)
    // The read tier allows 200 per minute per address
    expect(statuses.slice(0, 200).every(status => status === 200)).toBe(true)
    expect(statuses[200]).toBe(429)
  })

  it('reports a key over its limit as a failed result carrying the 429', async () => {
    const key = await newKey('key-d', 'user-d')
    await spread(key, KEY_LIMIT, '4')
    const result = await authenticateRequest(new NextRequest('https://app.example.com/api/v1/users/me', { headers: { 'x-api-key': key } }), { requiredScope: 'users:read' })
    expect(result.success).toBe(false)
    expect(result.error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', status: 429 })
    expect(result.rateLimitResponse?.status).toBe(429)
    expect(createAuthFailureResponse(result).status).toBe(429)
  })

  it('keeps the per-key limit with DISABLE_RATE_LIMITING, which only turns off the per-address one', async () => {
    const key = await newKey('key-f', 'user-f')
    await spread(key, KEY_LIMIT, '6')
    process.env.DISABLE_RATE_LIMITING = 'true'
    try {
      expect((await call(key, '192.0.2.60')).status).toBe(429)
      // The address limit is off: one address goes past the read tier's 200
      const other = await newKey('key-g', 'user-g')
      const statuses: number[] = []
      for (let i = 0; i < 201; i++) statuses.push((await call(other, '198.51.100.60')).status)
      expect(statuses.every(status => status === 200)).toBe(true)
    } finally {
      delete process.env.DISABLE_RATE_LIMITING
    }
  })

  it('counts once on the copy the origin check hands the handler (session cookie refused, valid key)', async () => {
    const key = await newKey('key-h', 'user-h')
    const original = new NextRequest('https://app.example.com/api/v1/x', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        cookie: 'better-auth.session_token=abc.def',
        origin: 'https://untrusted.example',
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.80',
      },
      body: '{}',
    })
    let seen: NextRequest | undefined
    const twice = withRateLimitTier(async (req: NextRequest) => {
      seen = req
      const first = await authenticateRequest(req, { requiredScope: 'users:read' })
      const second = await authenticateRequest(req, { requiredScope: 'users:read' })
      return NextResponse.json({ ok: first.success && second.success })
    }, 'write')

    const response = await twice(original)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(seen).not.toBe(original)
    expect(seen?.headers.get('cookie') ?? '').not.toContain('session_token')
    expect(rateLimitCache.get(getCacheKey('rate_limit', 'key-h'))?.count).toBe(1)
  })

  it('counts a request once, however many times it is authenticated', async () => {
    const key = await newKey('key-e', 'user-e')
    const twice = withRateLimitTier(async (req: NextRequest) => {
      await authenticateRequest(req, { requiredScope: 'users:read' })
      await authenticateRequest(req, { requiredScope: 'users:read' })
      await validateAndAuthenticateRequest(req, { requiredScope: 'users:read' })
      await validateAndAuthenticateRequest(req, { requiredScope: 'users:read' })
      return NextResponse.json({ ok: true })
    }, 'read')
    for (let i = 0; i < 3; i++) {
      await twice(new NextRequest('https://app.example.com/api/v1/x', { headers: { 'x-api-key': key, 'x-forwarded-for': `203.0.113.${i}` } }))
    }
    expect(rateLimitCache.get(getCacheKey('rate_limit', 'key-e'))?.count).toBe(3)
  })
})
