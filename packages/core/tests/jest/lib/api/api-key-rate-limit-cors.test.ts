/**
 * The 429 of the per-key limit carries core's CORS for the request, like the per-address tier response (#432):
 * the routes that authenticate with authenticateRequest / validateAndAuthenticate*Request return it as it comes, often
 * without withRateLimitTier around them, and a browser from another origin would otherwise see a CORS error
 * instead of the 429. A listed origin gets itself back with credentials; any other gets no origin.
 */
const mockConfig = {
  api: {
    cors: {
      allowedOrigins: { development: ['https://partner.example'], production: ['https://partner.example'] },
      additionalOrigins: {},
      allowAllOrigins: { development: false, production: false },
    },
  },
}
jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: mockConfig,
  getApplicationConfig: async () => mockConfig,
}))
// The next/server mock's headers are a Map: give NextResponse case-insensitive headers, as in route-cors.test.ts
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  class NextResponse extends actual.NextResponse {
    constructor(body?: unknown, init?: object) {
      super(body, init)
      const map = this.headers as Map<string, string>
      Object.assign(map, {
        get: (name: string) => Map.prototype.get.call(map, name.toLowerCase()) ?? null,
        set: (name: string, value: string) => Map.prototype.set.call(map, name.toLowerCase(), value),
        has: (name: string) => Map.prototype.has.call(map, name.toLowerCase()),
      })
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(JSON.stringify(body), init)
    }
  }
  return { ...actual, NextResponse }
})
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  queryWithRLS: jest.fn(async () => []),
  mutateWithRLS: jest.fn(async () => ({ rows: [], rowCount: 0 })),
}))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn(async () => null) } } }))

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { queryOne } from '@/core/lib/db'
import { ApiKeyManager } from '@/core/lib/api/keys'
import { rateLimitCache, getCacheKey } from '@/core/lib/api/cache'
import { withRateLimit } from '@/core/lib/api/rate-limit'
import { authenticateRequest, createAuthFailureResponse } from '@/core/lib/api/auth/dual-auth'
import { validateAndAuthenticateApiRequest, validateAndAuthenticateRequest } from '@/core/lib/api/helpers'

const LISTED = 'https://partner.example'
const UNLISTED = 'https://other.example'
const KEY_LIMIT = 1000

const keysByHash = new Map<string, { id: string; userId: string }>()
beforeEach(() => {
  ;(queryOne as unknown as jest.Mock).mockImplementation(async (sql: unknown, params: unknown) => {
    if (!String(sql).includes('WHERE "keyHash"')) return null
    const row = keysByHash.get((params as string[])[0])
    return row ? { ...row, scopes: ['users:read'], status: 'active', expiresAt: null, failedAttempts: 0, lockedUntil: null } : null
  })
})

/** A key that already used up its per-key budget for the minute. */
async function exhaustedKey(id: string) {
  const { key, hash } = await ApiKeyManager.generateApiKey()
  keysByHash.set(hash, { id, userId: `user-${id}` })
  rateLimitCache.set(getCacheKey('rate_limit', id), { count: KEY_LIMIT, resetTime: Date.now() + 60_000 }, 60_000)
  return key
}

const requestWith = (key: string, origin: string) =>
  new NextRequest('https://app.example.com/api/v1/things', { headers: { 'x-api-key': key, origin } })

function cors(response: Response) {
  return {
    origin: response.headers.get('access-control-allow-origin') ?? null,
    credentials: response.headers.get('access-control-allow-credentials') ?? null,
  }
}

/** What a browser needs of the 429: the CORS grant, and the limit's own answer left intact (its headers are in api-key-rate-limit.test.ts: the next/server mock above drops them). */
async function expectKeyLimit(response: Response, origin: string | null) {
  expect(response.status).toBe(429)
  expect(cors(response)).toEqual(origin ? { origin, credentials: 'true' } : { origin: null, credentials: null })
  expect(response.headers.get('vary')).toMatch(/origin/i)
  const body = await response.json()
  expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  expect(body.retryAfter).toBeGreaterThan(0)
}

describe('the per-key 429 carries core\'s CORS for the request (#432)', () => {
  it('authenticateRequest: a listed origin gets itself back with credentials, an unlisted one no origin', async () => {
    const key = await exhaustedKey('cors-a')
    const listed = await authenticateRequest(requestWith(key, LISTED), { requiredScope: 'users:read' })
    expect(listed.success).toBe(false)
    await expectKeyLimit(listed.rateLimitResponse as Response, LISTED)
    // What a route returns on a failed result is that same response
    await expectKeyLimit(createAuthFailureResponse(listed), LISTED)

    const unlisted = await authenticateRequest(requestWith(key, UNLISTED), { requiredScope: 'users:read' })
    await expectKeyLimit(unlisted.rateLimitResponse as Response, null)
  })

  it('validateAndAuthenticateRequest', async () => {
    const key = await exhaustedKey('cors-b')
    const { rateLimitResponse } = await validateAndAuthenticateRequest(requestWith(key, LISTED), { requiredScope: 'users:read' })
    await expectKeyLimit(rateLimitResponse as Response, LISTED)
  })

  it('validateAndAuthenticateApiRequest', async () => {
    const key = await exhaustedKey('cors-c')
    const { rateLimitResponse } = await validateAndAuthenticateApiRequest(requestWith(key, LISTED))
    await expectKeyLimit(rateLimitResponse as Response, LISTED)
  })

  it('withRateLimit (legacy), whose limit is per key and scopes too', async () => {
    const key = await exhaustedKey('cors-d')
    const limit = rateLimitCache.get(getCacheKey('rate_limit', 'cors-d'))
    expect(limit?.count).toBe(KEY_LIMIT)
    const response = await withRateLimit(async () => new Response('ok') as never)(requestWith(key, LISTED))
    expect(response.status).toBe(429)
    expect(cors(response)).toEqual({ origin: LISTED, credentials: 'true' })
  })
})
