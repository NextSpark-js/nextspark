/**
 * Core's CORS on every response of a route wrapped by withRateLimitTier, and on its preflight (corsPreflight),
 * for a route that sets no CORS headers itself: a listed origin gets itself back with credentials, any other
 * origin gets no origin and no credentials, whatever the status (the route's 200/401/403, the origin check's
 * 403, the wrapper's 429). The 'webhook' tier gets no CORS. A route that already answered CORS keeps its answer.
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
// The next/server mock's headers are a Map: give NextResponse case-insensitive headers, as in cors-headers.test.ts
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
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn() }))

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimitTier } from '@/core/lib/api/rate-limit'
import { corsPreflight } from '@/core/lib/api/cors-response'
import { addCorsHeaders } from '@/core/lib/api/helpers'

const APP = 'https://app.example.com'
const LISTED = 'https://partner.example'
const UNLISTED = 'https://other.example'
const SESSION = 'better-auth.session_token=abc.def'

let address = 0
/** A request from its own client address, so each test starts with an empty rate-limit bucket. */
function request(origin: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  address++
  return new NextRequest(`${APP}/api/v1/things`, {
    method: init.method ?? 'GET',
    headers: { origin, 'x-forwarded-for': `198.51.100.${address}`, ...init.headers },
  })
}

function cors(response: Response) {
  return {
    origin: response.headers.get('access-control-allow-origin') ?? null,
    credentials: response.headers.get('access-control-allow-credentials') ?? null,
  }
}

const GRANTED = { origin: LISTED, credentials: 'true' }
const NONE = { origin: null, credentials: null }

const saved = { app: process.env.NEXT_PUBLIC_APP_URL, auth: process.env.BETTER_AUTH_URL, disable: process.env.DISABLE_RATE_LIMITING }
beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP
  delete process.env.BETTER_AUTH_URL
  delete process.env.DISABLE_RATE_LIMITING
})
afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = saved.app
  if (saved.auth !== undefined) process.env.BETTER_AUTH_URL = saved.auth
  if (saved.disable !== undefined) process.env.DISABLE_RATE_LIMITING = saved.disable
})

describe.each([
  ['listed', LISTED, GRANTED],
  ['unlisted', UNLISTED, NONE],
])('a route without CORS of its own, %s origin', (_label, origin, expected) => {
  it.each([200, 401, 403])('the route’s %i', async status => {
    const route = withRateLimitTier(async () => NextResponse.json({ status }, { status }), 'api')
    const response = await route(request(origin))
    expect(response.status).toBe(status)
    expect(cors(response)).toEqual(expected)
    expect(response.headers.get('vary')).toBe('Origin')
  })

  it('the wrapper’s 429', async () => {
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'auth')
    const first = request(origin)
    const ip = first.headers.get('x-forwarded-for')!
    let response = await route(first)
    for (let i = 0; i < 5; i++) response = await route(request(origin, { headers: { 'x-forwarded-for': ip } }))
    expect(response.status).toBe(429)
    expect(cors(response)).toEqual(expected)
  })

  it('the preflight', async () => {
    const response = corsPreflight(request(origin, { method: 'OPTIONS' }))
    expect(response.status).toBe(204)
    expect(cors(response)).toEqual(expected)
    expect(response.headers.get('access-control-allow-methods')).toContain('PATCH')
  })
})

it('the origin check’s 403 for an unlisted origin carries no grant', async () => {
  const handler = jest.fn(async () => NextResponse.json({ ok: true }))
  const response = await withRateLimitTier(handler, 'write')(
    request(UNLISTED, { method: 'POST', headers: { cookie: SESSION, 'content-type': 'application/json' } })
  )
  expect(response.status).toBe(403)
  expect(handler).not.toHaveBeenCalled()
  expect(cors(response)).toEqual(NONE)
  expect(response.headers.get('vary')).toBe('Origin')
})

it('a cookie write from a listed origin passes the origin check and is granted', async () => {
  const response = await withRateLimitTier(async () => NextResponse.json({ ok: true }, { status: 201 }), 'write')(
    request(LISTED, { method: 'POST', headers: { cookie: SESSION, 'content-type': 'application/json' } })
  )
  expect(response.status).toBe(201)
  expect(cors(response)).toEqual(GRANTED)
})

it('the webhook tier sends no CORS headers, even to a listed origin', async () => {
  const response = await withRateLimitTier(async () => NextResponse.json({ received: true }), 'webhook')(request(LISTED, { method: 'POST' }))
  expect(response.status).toBe(200)
  expect(cors(response)).toEqual(NONE)
  expect(response.headers.get('access-control-allow-methods') ?? null).toBeNull()
  expect(response.headers.get('vary') ?? null).toBeNull()
})

it('a route that answered CORS itself keeps its answer, with Vary: Origin once', async () => {
  for (const origin of [LISTED, UNLISTED]) {
    const route = withRateLimitTier(async (req: NextRequest) => addCorsHeaders(NextResponse.json({ ok: true }), req), 'api')
    const response = await route(request(origin))
    expect(cors(response)).toEqual(origin === LISTED ? GRANTED : NONE)
    expect(response.headers.get('vary')).toBe('Origin')
  }
})

it('a route’s own origin policy is left alone', async () => {
  const route = withRateLimitTier(async () => {
    const response = NextResponse.json({ ok: true })
    response.headers.set('Access-Control-Allow-Origin', 'https://own-policy.example')
    return response
  }, 'api')
  const response = await route(request(LISTED))
  expect(cors(response)).toEqual({ origin: 'https://own-policy.example', credentials: null })
})

it('a request without Origin gets no grant', async () => {
  const response = await withRateLimitTier(async () => NextResponse.json({ ok: true }), 'api')(
    new NextRequest(`${APP}/api/v1/things`, { headers: { 'x-forwarded-for': '198.51.100.250' } })
  )
  expect(response.status).toBe(200)
  expect(cors(response)).toEqual(NONE)
})
