/**
 * Core's CORS on every response of a route wrapped by withRateLimitTier, and on its preflight (corsPreflight),
 * for a route that sets no CORS headers itself: a listed origin gets itself back with credentials, any other
 * origin gets no origin and no credentials, whatever the status (the route's 200/401/403, the origin check's
 * 403, the wrapper's 429). The 'webhook' tier gets no CORS. A route that already answered CORS keeps its answer.
 * The preflight allows every header core's clients send (#217). The admin and developer areas answer CORS only
 * to the app's own origin, never to another listed origin (#217).
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
import { addCorsHeaders, handleCorsPreflightRequest, wrapAuthHandlerWithCors } from '@/core/lib/api/helpers'
import { CLIENT_REQUEST_HEADERS } from '@/core/lib/api/client-headers'
import { readFileSync } from 'fs'
import { join } from 'path'

const APP = 'https://app.example.com'
const LISTED = 'https://partner.example'
const UNLISTED = 'https://other.example'
const SESSION = 'better-auth.session_token=abc.def'

let address = 0
/** A request from its own client address, so each test starts with an empty rate-limit bucket. */
function request(origin: string, init: { method?: string; headers?: Record<string, string>; path?: string } = {}) {
  address++
  return new NextRequest(`${APP}${init.path ?? '/api/v1/things'}`, {
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

/** The headers a preflight response allows, lower-cased. */
function allowedHeaders(response: Response) {
  return (response.headers.get('access-control-allow-headers') ?? '').split(',').map(h => h.trim().toLowerCase())
}

describe('allowed headers (#217)', () => {
  it.each([
    ['a signup with an intent', '/api/auth/sign-up/email', 'POST', 'content-type, x-signup-intent'],
    ['an email verification from the UI', '/api/auth/verify-email', 'GET', 'x-verify-from-ui'],
  ])('the auth route’s preflight for %s from a listed origin allows its headers', async (_label, path, method, requested) => {
    const response = await handleCorsPreflightRequest(request(LISTED, {
      method: 'OPTIONS',
      path,
      headers: { 'access-control-request-method': method, 'access-control-request-headers': requested },
    }))
    expect(cors(response)).toEqual(GRANTED)
    for (const header of requested.split(',').map(h => h.trim())) expect(allowedHeaders(response)).toContain(header)
  })

  it('every header core’s clients send is allowed, on core’s preflight and the route wrapper’s', async () => {
    const preflight = corsPreflight(request(LISTED, { method: 'OPTIONS' }))
    const auth = await handleCorsPreflightRequest(request(LISTED, { method: 'OPTIONS', path: '/api/auth/sign-up/email' }))
    for (const header of [...CLIENT_REQUEST_HEADERS, 'content-type', 'authorization', 'x-api-key']) {
      expect(allowedHeaders(preflight)).toContain(header)
      expect(allowedHeaders(auth)).toContain(header)
    }
  })

  it('every custom header @nextsparkjs/mobile’s client sends is allowed', () => {
    const client = readFileSync(join(__dirname, '../../../../../mobile/src/api/client.ts'), 'utf8')
    const sent = [...client.matchAll(/\[\s*'(x-[a-z0-9-]+)'\s*\]\s*=/g)].map(match => match[1])
    expect(sent).toContain('x-team-id')
    for (const header of sent) expect(allowedHeaders(corsPreflight(request(LISTED, { method: 'OPTIONS' })))).toContain(header)
  })
})

describe('the admin and developer areas answer CORS only to the app’s own origin (#217)', () => {
  const OWN = { origin: APP, credentials: 'true' }
  const ADMIN_PATHS = [
    '/api/superadmin/users',
    '/api/superadmin',
    '/api/devtools/tests',
    '/api/v1/devtools/blocks',
    '/API/SuperAdmin/users',
    '//api//superadmin/users',
    '/api/%73uperadmin/users',
    '/base/api/superadmin/users',
  ]

  describe.each(ADMIN_PATHS)('%s', path => {
    it.each([
      ['the app’s own origin', APP, OWN],
      ['a listed origin', LISTED, NONE],
      ['an unlisted origin', UNLISTED, NONE],
    ])('%s: the route’s 200 and 401, and the preflight', async (_label, origin, expected) => {
      for (const status of [200, 401]) {
        const response = await withRateLimitTier(async () => NextResponse.json({ status }, { status }), 'api')(request(origin, { path }))
        expect(response.status).toBe(status)
        expect(cors(response)).toEqual(expected)
        expect(response.headers.get('vary')).toBe('Origin')
      }
      expect(cors(corsPreflight(request(origin, { method: 'OPTIONS', path })))).toEqual(expected)
    })
  })

  it.each([
    ['the app’s own origin', APP, { origin: APP, credentials: 'true' }],
    ['a listed origin', LISTED, NONE],
  ])('%s: the wrapper’s 429 and the origin check’s 403', async (_label, origin, expected) => {
    const path = '/api/superadmin/users'
    const route = withRateLimitTier(async () => NextResponse.json({ ok: true }), 'auth')
    const first = request(origin, { path })
    const ip = first.headers.get('x-forwarded-for')!
    let response = await route(first)
    for (let i = 0; i < 5; i++) response = await route(request(origin, { path, headers: { 'x-forwarded-for': ip } }))
    expect(response.status).toBe(429)
    expect(cors(response)).toEqual(expected)

    const write = await withRateLimitTier(async () => NextResponse.json({ ok: true }), 'write')(
      request(UNLISTED, { method: 'POST', path, headers: { cookie: SESSION, 'content-type': 'application/json' } })
    )
    expect(write.status).toBe(403)
    expect(cors(write)).toEqual(NONE)
  })

  it('addCorsHeaders and wrapAuthHandlerWithCors follow the same rule', async () => {
    const path = '/api/devtools/config/theme'
    expect(cors(await addCorsHeaders(NextResponse.json({}), request(LISTED, { path })))).toEqual(NONE)
    expect(cors(await addCorsHeaders(NextResponse.json({}), request(APP, { path })))).toEqual({ origin: APP, credentials: 'true' })
    expect(cors(await wrapAuthHandlerWithCors(async () => new Response('{}'), request(LISTED, { path })))).toEqual(NONE)
  })

  it('BETTER_AUTH_URL is the app’s own origin too', async () => {
    process.env.BETTER_AUTH_URL = 'https://auth.example.com/api/auth'
    try {
      const response = corsPreflight(request('https://auth.example.com', { method: 'OPTIONS', path: '/api/superadmin/users' }))
      expect(cors(response)).toEqual({ origin: 'https://auth.example.com', credentials: 'true' })
    } finally {
      delete process.env.BETTER_AUTH_URL
    }
  })

  it.each(['/api/v1/things', '/api/superadmins', '/api/v1/superadmin-reports', '/api/auth/sign-in/email'])(
    'other routes still grant a listed origin: %s',
    async path => {
      expect(cors(corsPreflight(request(LISTED, { method: 'OPTIONS', path })))).toEqual(GRANTED)
      const response = await withRateLimitTier(async () => NextResponse.json({ ok: true }), 'api')(request(LISTED, { path }))
      expect(cors(response)).toEqual(GRANTED)
    }
  )
})
