/**
 * Origin check for cookie-authenticated writes (lib/api/request-origin), on its
 * own and through withRateLimitTier, which every core API route uses. Under the
 * admin and developer areas only the app's own origin is trusted (#217).
 */

jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: {
    api: {
      cors: {
        allowedOrigins: { development: ['https://partner.example.com', 'https://*.tenants.example.com'], production: [] },
        additionalOrigins: {},
        allowAllOrigins: { development: false, production: false },
      },
    },
  },
}))

import { NextRequest, NextResponse } from 'next/server'
import { checkRequestOrigin } from '@/core/lib/api/request-origin'
import { withRateLimitTier } from '@/core/lib/api/rate-limit'
import { presentedApiKey } from '@/core/lib/api/keys'

const APP = 'https://app.example.com'
const SESSION = 'better-auth.session_token=abc.def'

function makeRequest(method: string, headers: Record<string, string> = {}, path = '/api/v1/tasks') {
  return new NextRequest(`${APP}${path}`, { method, headers })
}

async function refusal(method: string, headers: Record<string, string>, path?: string) {
  const res = checkRequestOrigin(makeRequest(method, headers, path))
  return res instanceof NextResponse ? { status: res.status, code: (await res.json()).code } : null
}

/** A value in the API-key format (validateApiKey still has to find it). */
const KEY = `sk_test_${'a'.repeat(64)}`
const FOREIGN = 'https://other.example'
const REFUSED = { status: 403, code: 'ORIGIN_NOT_ALLOWED' }

describe('checkRequestOrigin', () => {
  const saved = { app: process.env.NEXT_PUBLIC_APP_URL, auth: process.env.BETTER_AUTH_URL }
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP
    delete process.env.BETTER_AUTH_URL
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = saved.app
    if (saved.auth !== undefined) process.env.BETTER_AUTH_URL = saved.auth
  })

  it('allows a cookie-authenticated write from the app origin', async () => {
    expect(await refusal('POST', { cookie: SESSION, origin: APP })).toBeNull()
  })

  it('allows the app origin given only as Referer', async () => {
    expect(await refusal('DELETE', { cookie: SESSION, referer: `${APP}/dashboard/tasks` })).toBeNull()
  })

  it('allows a configured trusted origin, including a wildcard entry', async () => {
    expect(await refusal('PATCH', { cookie: SESSION, origin: 'https://partner.example.com' })).toBeNull()
    expect(await refusal('PUT', { cookie: SESSION, origin: 'https://acme.tenants.example.com' })).toBeNull()
  })

  it('refuses a cookie-authenticated write from another origin with 403 ORIGIN_NOT_ALLOWED', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(await refusal(method, { cookie: SESSION, origin: 'https://other.example' })).toEqual({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
    }
    expect(await refusal('POST', { cookie: SESSION, referer: 'https://other.example/page' })).toEqual({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
    expect(await refusal('POST', { cookie: SESSION, origin: 'null' })).toEqual({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  it('checks the __Secure- session cookie too', async () => {
    expect(await refusal('POST', { cookie: `__Secure-${SESSION}`, origin: 'https://other.example' })).toEqual({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  it('leaves reads alone', async () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(await refusal(method, { cookie: SESSION, origin: 'https://other.example' })).toBeNull()
    }
  })

  it('leaves requests without a session cookie alone', async () => {
    expect(await refusal('POST', { origin: 'https://other.example' })).toBeNull()
    expect(await refusal('POST', { cookie: 'theme=dark', origin: 'https://other.example' })).toBeNull()
  })

  it('lets a write that presents an API key through, without its session cookie', async () => {
    for (const headers of [{ authorization: `Bearer ${KEY}` }, { 'x-api-key': KEY }]) {
      const out = checkRequestOrigin(makeRequest('POST', { ...headers, cookie: `${SESSION}; theme=dark; __Secure-better-auth.session_data=x`, origin: FOREIGN }))
      expect(out).toBeInstanceOf(NextRequest)
      const passed = out as NextRequest
      expect(passed.headers.get('cookie')).toBe('theme=dark')
      expect(presentedApiKey(passed.headers as Headers)).toBe(KEY)
    }
    const noOrigin = checkRequestOrigin(makeRequest('POST', { 'x-api-key': KEY, cookie: SESSION, 'content-type': 'text/plain' })) as NextRequest
    expect(noOrigin.headers.get('cookie') ?? null).toBeNull()
  })

  it('keeps the request unchanged when the origin is trusted', async () => {
    const same = makeRequest('POST', { authorization: `Bearer ${KEY}`, cookie: SESSION, origin: APP })
    expect(checkRequestOrigin(same)).toBe(same)
  })

  it('applies the check to a Bearer value that is not in the API-key format', async () => {
    for (const authorization of ['Bearer junk', 'Bearer some.session-token', `bearer ${KEY}`, `Bearer  ${KEY}`]) {
      expect(await refusal('POST', { authorization, cookie: SESSION, origin: FOREIGN })).toEqual(REFUSED)
    }
    expect(await refusal('POST', { 'x-api-key': 'junk', cookie: SESSION, origin: FOREIGN })).toEqual(REFUSED)
    expect(await refusal('POST', { authorization: 'Bearer junk', cookie: SESSION, 'content-type': 'text/plain' })).toEqual({ status: 403, code: 'ORIGIN_REQUIRED' })
  })

  it('reads the key from Authorization before x-api-key, as validateApiKey does', async () => {
    expect(await refusal('POST', { authorization: 'Bearer junk', 'x-api-key': KEY, cookie: SESSION, origin: FOREIGN })).toEqual(REFUSED)
  })

  it('refuses Origin: null with the session cookie and a JSON body', async () => {
    expect(await refusal('POST', { cookie: SESSION, origin: 'null', 'content-type': 'application/json' })).toEqual(REFUSED)
  })

  it('leaves requests without a session cookie alone, whatever their Authorization', async () => {
    expect(await refusal('POST', { authorization: 'Bearer junk', origin: FOREIGN })).toBeNull()
    expect(await refusal('POST', { authorization: `Bearer ${KEY}`, 'content-type': 'text/plain' })).toBeNull()
  })

  it('does not count a non-Bearer Authorization scheme or an empty credential', async () => {
    const refused = { status: 403, code: 'ORIGIN_NOT_ALLOWED' }
    expect(await refusal('POST', { authorization: 'Basic x', cookie: SESSION, origin: 'https://other.example' })).toEqual(refused)
    expect(await refusal('POST', { authorization: 'Bearer ', cookie: SESSION, origin: 'https://other.example' })).toEqual(refused)
    expect(await refusal('POST', { 'x-api-key': ' ', cookie: SESSION, origin: 'https://other.example' })).toEqual(refused)
  })

  it('refuses look-alike origins', async () => {
    const refused = { status: 403, code: 'ORIGIN_NOT_ALLOWED' }
    for (const origin of [
      'https://app.example.com.attacker.test',
      'https://evilapp.example.com',
      'http://app.example.com',
      'https://app.example.com:8443',
    ]) {
      expect(await refusal('POST', { cookie: SESSION, origin })).toEqual(refused)
    }
  })

  it('matches a wildcard entry on exactly one label', async () => {
    const refused = { status: 403, code: 'ORIGIN_NOT_ALLOWED' }
    expect(await refusal('POST', { cookie: SESSION, origin: 'https://a.tenants.example.com' })).toBeNull()
    expect(await refusal('POST', { cookie: SESSION, origin: 'https://a.b.tenants.example.com' })).toEqual(refused)
    expect(await refusal('POST', { cookie: SESSION, origin: 'https://tenants.example.com' })).toEqual(refused)
  })

  it('trusts a private-LAN origin outside production only', async () => {
    const lan = 'http://192.168.1.20:3000'
    const env = process.env as Record<string, string | undefined>
    const saved = env.NODE_ENV
    try {
      env.NODE_ENV = 'development'
      expect(await refusal('POST', { cookie: SESSION, origin: lan })).toBeNull()
      env.NODE_ENV = 'production'
      expect(await refusal('POST', { cookie: SESSION, origin: lan })).toEqual({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
    } finally {
      env.NODE_ENV = saved
    }
  })

  it('allows a native client that sends JSON with no Origin or Referer (the mobile client)', async () => {
    expect(await refusal('POST', { cookie: SESSION, 'content-type': 'application/json' })).toBeNull()
    expect(await refusal('DELETE', { cookie: SESSION })).toBeNull()
  })

  it('refuses a form-encodable body with no Origin or Referer with 403 ORIGIN_REQUIRED', async () => {
    for (const ct of ['text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      expect(await refusal('POST', { cookie: SESSION, 'content-type': ct })).toEqual({ status: 403, code: 'ORIGIN_REQUIRED' })
    }
  })

  it('accepts a text/plain body from the app origin', async () => {
    expect(await refusal('POST', { cookie: SESSION, origin: APP, 'content-type': 'text/plain' })).toBeNull()
  })
})

describe('withRateLimitTier runs the origin check first', () => {
  const savedDisable = process.env.DISABLE_RATE_LIMITING
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP
    process.env.DISABLE_RATE_LIMITING = 'true'
  })
  afterAll(() => {
    if (savedDisable === undefined) delete process.env.DISABLE_RATE_LIMITING
    else process.env.DISABLE_RATE_LIMITING = savedDisable
  })

  it('does not call the handler for a refused request, and does for an allowed one', async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }, { status: 201 }))
    const route = withRateLimitTier(handler, 'write')

    const refused = await route(makeRequest('POST', { cookie: SESSION, origin: 'https://other.example', 'content-type': 'text/plain' }))
    expect(refused.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()

    const ok = await route(makeRequest('POST', { cookie: SESSION, origin: APP, 'content-type': 'application/json' }))
    expect(ok.status).toBe(201)
    expect(handler).toHaveBeenCalledTimes(1)

    const get = await route(makeRequest('GET', { cookie: SESSION, origin: 'https://other.example' }))
    expect(get.status).toBe(201)
  })

  it('hands the handler a request without the session cookie when it passes on an API key', async () => {
    const seen: (string | null)[] = []
    const route = withRateLimitTier(async (req: NextRequest) => {
      seen.push(req.headers.get('cookie') ?? null)
      return NextResponse.json({ ok: true }, { status: 201 })
    }, 'write')
    const res = await route(makeRequest('POST', { authorization: `Bearer ${KEY}`, cookie: SESSION, origin: 'https://other.example' }))
    expect(res.status).toBe(201)
    expect(seen).toEqual([null])

    const junk = await route(makeRequest('POST', { authorization: 'Bearer junk', cookie: SESSION, origin: 'https://other.example' }))
    expect(junk.status).toBe(403)
    expect(seen).toHaveLength(1)
  })
})

describe('the admin and developer areas accept cookie writes only from the app’s own origin (#217)', () => {
  const PARTNER = 'https://partner.example.com'
  const ADMIN_PATHS = ['/api/superadmin/users', '/api/superadmin/teams/t1', '/api/devtools/tests', '/api/v1/devtools/scheduled-actions/run', '/API//SuperAdmin/users', '/api/%73uperadmin/users']
  const saved = { app: process.env.NEXT_PUBLIC_APP_URL, auth: process.env.BETTER_AUTH_URL }
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP
    delete process.env.BETTER_AUTH_URL
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = saved.app
    if (saved.auth !== undefined) process.env.BETTER_AUTH_URL = saved.auth
  })

  it.each(ADMIN_PATHS)('%s: a simple text/plain POST with the cookie from a listed origin gets 403', async path => {
    expect(await refusal('POST', { cookie: SESSION, origin: PARTNER, 'content-type': 'text/plain' }, path)).toEqual(REFUSED)
    expect(await refusal('PATCH', { cookie: SESSION, origin: 'https://acme.tenants.example.com', 'content-type': 'application/json' }, path)).toEqual(REFUSED)
    expect(await refusal('DELETE', { cookie: SESSION, referer: `${PARTNER}/admin` }, path)).toEqual(REFUSED)
  })

  it.each(ADMIN_PATHS)('%s: the same write from the app’s own origin passes', async path => {
    expect(await refusal('POST', { cookie: SESSION, origin: APP, 'content-type': 'text/plain' }, path)).toBeNull()
    expect(await refusal('DELETE', { cookie: SESSION, referer: `${APP}/superadmin/users` }, path)).toBeNull()
  })

  it('the same write from a listed origin to a normal path passes, as before', async () => {
    expect(await refusal('POST', { cookie: SESSION, origin: PARTNER, 'content-type': 'text/plain' })).toBeNull()
    expect(await refusal('POST', { cookie: SESSION, origin: PARTNER, 'content-type': 'text/plain' }, '/api/superadmins')).toBeNull()
  })

  it('BETTER_AUTH_URL is the app’s own origin too', async () => {
    process.env.BETTER_AUTH_URL = 'https://auth.example.com/api/auth'
    try {
      expect(await refusal('POST', { cookie: SESSION, origin: 'https://auth.example.com' }, '/api/superadmin/users')).toBeNull()
    } finally {
      delete process.env.BETTER_AUTH_URL
    }
  })

  it('an API-key request and a native request without Origin behave as on other paths', async () => {
    const keyed = checkRequestOrigin(makeRequest('POST', { cookie: SESSION, origin: PARTNER, authorization: `Bearer ${KEY}` }, '/api/superadmin/users'))
    expect(keyed).toBeInstanceOf(NextRequest)
    expect((keyed as NextRequest).headers.get('cookie') ?? null).toBeNull()
    expect(await refusal('POST', { cookie: SESSION, 'content-type': 'application/json' }, '/api/superadmin/users')).toBeNull()
    expect(await refusal('POST', { cookie: SESSION, 'content-type': 'text/plain' }, '/api/superadmin/users')).toEqual({ status: 403, code: 'ORIGIN_REQUIRED' })
  })

  it('a private-LAN origin is trusted there outside production only, as elsewhere', async () => {
    const lan = 'http://192.168.1.20:3000'
    const env = process.env as Record<string, string | undefined>
    const savedEnv = env.NODE_ENV
    try {
      env.NODE_ENV = 'development'
      expect(await refusal('POST', { cookie: SESSION, origin: lan }, '/api/superadmin/users')).toBeNull()
      env.NODE_ENV = 'production'
      expect(await refusal('POST', { cookie: SESSION, origin: lan }, '/api/superadmin/users')).toEqual(REFUSED)
    } finally {
      env.NODE_ENV = savedEnv
    }
  })

  it('through withRateLimitTier the handler is not called for the listed origin, and is for the own origin', async () => {
    const savedDisable = process.env.DISABLE_RATE_LIMITING
    process.env.DISABLE_RATE_LIMITING = 'true'
    try {
      const handler = jest.fn(async () => NextResponse.json({ ok: true }))
      const route = withRateLimitTier(handler, 'write')
      const refused = await route(makeRequest('POST', { cookie: SESSION, origin: PARTNER, 'content-type': 'text/plain' }, '/api/superadmin/users'))
      expect(refused.status).toBe(403)
      expect((await refused.json()).code).toBe('ORIGIN_NOT_ALLOWED')
      expect(handler).not.toHaveBeenCalled()
      const ok = await route(makeRequest('POST', { cookie: SESSION, origin: APP, 'content-type': 'text/plain' }, '/api/superadmin/users'))
      expect(ok.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)
    } finally {
      if (savedDisable === undefined) delete process.env.DISABLE_RATE_LIMITING
      else process.env.DISABLE_RATE_LIMITING = savedDisable
    }
  })
})
