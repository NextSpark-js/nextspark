/**
 * Which identity the API wrappers count and record a request under.
 * - withRateLimitTier counts per client address: an x-api-key value does not pick the bucket.
 * - withApiLogging records the API key the handler validated, and getApiAuth returns it; neither reads
 *   x-api-user-id / x-api-key-id / x-api-scopes from the request.
 * - withRateLimit (legacy) limits per validated key, never per a key id named in a header.
 */
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals'

jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, mutateWithRLS } from '@/core/lib/db'
import { ApiKeyManager } from '@/core/lib/api/keys'
import { validateApiKey } from '@/core/lib/api/auth'
import { withApiLogging, getApiAuth } from '@/core/lib/api/helpers'
import { withRateLimitTier, withRateLimit } from '@/core/lib/api/rate-limit'

const mockedQueryOne = queryOne as unknown as jest.Mock
const mockedMutate = mutateWithRLS as unknown as jest.Mock

const IDENTITY_HEADERS = {
  'x-api-user-id': 'someone-else',
  'x-api-key-id': 'someone-elses-key',
  'x-api-scopes': '["*"]',
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function keyRow(userId: string) {
  return { id: 'key-1', userId, scopes: ['users:read'], status: 'active', expiresAt: null, failedAttempts: 0, lockedUntil: null }
}

beforeEach(() => {
  mockedQueryOne.mockReset()
  mockedMutate.mockReset()
  mockedMutate.mockImplementation(async () => ({ rows: [], rowCount: 1 }))
})

describe('withRateLimitTier', () => {
  const saved = process.env.DISABLE_RATE_LIMITING
  delete process.env.DISABLE_RATE_LIMITING
  afterAll(() => {
    if (saved !== undefined) process.env.DISABLE_RATE_LIMITING = saved
  })

  it('counts requests from one address in one bucket, whatever x-api-key each one carries', async () => {
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'auth')
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const key = `sk_test_${String(i).repeat(64).slice(0, 64)}`
      const request = new NextRequest('https://app.example.com/api/v1/x', { headers: { 'x-api-key': key, 'x-forwarded-for': '198.51.100.7' } })
      statuses.push((await route(request)).status)
    }
    // The auth tier allows 5 per window
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429])

    // Another address has its own bucket
    const other = new NextRequest('https://app.example.com/api/v1/x', { headers: { 'x-forwarded-for': '198.51.100.8' } })
    expect((await route(other)).status).toBe(200)
  })
})

describe('withApiLogging', () => {
  it('writes no audit row from identity headers when no key was validated', async () => {
    const route = withApiLogging(async () => NextResponse.json({ ok: true }))
    const response = await route(new NextRequest('https://app.example.com/api/v1/users/u1', { method: 'POST', headers: IDENTITY_HEADERS, body: '{}' }))
    await flush()
    expect(response.status).toBe(200)
    expect(mockedMutate).not.toHaveBeenCalled()
  })

  it('attributes the audit row to the owner of the key the handler validated', async () => {
    const { key } = await ApiKeyManager.generateApiKey()
    mockedQueryOne.mockImplementation(async (sql: unknown) => (String(sql).includes('WHERE "keyHash"') ? keyRow('key-owner') : null))
    const route = withApiLogging(async (req: NextRequest) => {
      const auth = await validateApiKey(req)
      return NextResponse.json({ ok: Boolean(auth) })
    })

    const response = await route(new NextRequest('https://app.example.com/api/v1/users/u1', {
      headers: { authorization: `Bearer ${key}`, ...IDENTITY_HEADERS },
    }))
    await flush()

    expect(await response.json()).toEqual({ ok: true })
    expect(mockedMutate).toHaveBeenCalledTimes(1)
    const [sql, params, rlsUser] = mockedMutate.mock.calls[0] as [string, unknown[], string]
    expect(sql).toContain('INSERT INTO "api_audit_log"')
    expect(params.slice(0, 2)).toEqual(['key-1', 'key-owner'])
    expect(rlsUser).toBe('key-owner')
  })
})

describe('withRateLimitTier(withApiLogging(...))', () => {
  it('attributes the row to the key owner for a cookie write from another origin that presents a valid key', async () => {
    const { key } = await ApiKeyManager.generateApiKey()
    mockedQueryOne.mockImplementation(async (sql: unknown) => (String(sql).includes('WHERE "keyHash"') ? keyRow('key-owner') : null))
    const seen: Array<string | null> = []
    const route = withRateLimitTier(withApiLogging(async (req: NextRequest) => {
      seen.push(req.headers.get('cookie') ?? null)
      const auth = await validateApiKey(req)
      return NextResponse.json({ ok: Boolean(auth) })
    }), 'write')

    const response = await route(new NextRequest('https://app.example.com/api/v1/users/u1', {
      method: 'POST',
      headers: {
        cookie: 'better-auth.session_token=abc.def',
        origin: 'https://other.example',
        'content-type': 'application/json',
        'x-api-key': key,
        'x-forwarded-for': '198.51.100.40',
        ...IDENTITY_HEADERS,
      },
      body: '{}',
    }))
    await flush()

    expect(response.status).toBe(200)
    // The origin check hands the route the request without its session cookie
    expect(seen).toEqual([null])
    expect(mockedMutate).toHaveBeenCalledTimes(1)
    const [, params, rlsUser] = mockedMutate.mock.calls[0] as [string, unknown[], string]
    expect(params.slice(0, 2)).toEqual(['key-1', 'key-owner'])
    expect(rlsUser).toBe('key-owner')
  })
})

describe('getApiAuth', () => {
  it('refuses a request whose identity is only in headers', () => {
    expect(() => getApiAuth(new NextRequest('https://app.example.com/api/v1/x', { headers: IDENTITY_HEADERS }))).toThrow()
  })

  it('returns the key validateApiKey accepted for the request', async () => {
    const { key } = await ApiKeyManager.generateApiKey()
    mockedQueryOne.mockImplementation(async (sql: unknown) => (String(sql).includes('WHERE "keyHash"') ? keyRow('key-owner') : null))
    const request = new NextRequest('https://app.example.com/api/v1/x', { headers: { 'x-api-key': key, ...IDENTITY_HEADERS } })
    await validateApiKey(request)
    expect(getApiAuth(request)).toEqual({ userId: 'key-owner', keyId: 'key-1', scopes: ['users:read'] })
  })
})

describe('withRateLimit', () => {
  it('does not rate limit under a key id named in a header', async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const response = await withRateLimit(handler)(new NextRequest('https://app.example.com/api/v1/x', { headers: IDENTITY_HEADERS }))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.headers.get('X-RateLimit-Limit') ?? null).toBeNull()
  })

  it('limits a validated key under its own id', async () => {
    const { key } = await ApiKeyManager.generateApiKey()
    mockedQueryOne.mockImplementation(async (sql: unknown) => (String(sql).includes('WHERE "keyHash"') ? keyRow('key-owner') : null))
    const response = await withRateLimit(async () => NextResponse.json({ ok: true }))(
      new NextRequest('https://app.example.com/api/v1/x', { headers: { 'x-api-key': key } })
    )
    expect(response.headers.get('X-RateLimit-Limit')).toMatch(/^[0-9]+$/)
  })
})
