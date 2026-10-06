/**
 * Origin check for cookie-authenticated writes (lib/api/request-origin), on its
 * own and through withRateLimitTier, which every core API route uses.
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

const APP = 'https://app.example.com'
const SESSION = 'better-auth.session_token=abc.def'

function makeRequest(method: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${APP}/api/v1/tasks`, { method, headers })
}

async function refusal(method: string, headers: Record<string, string>) {
  const res = checkRequestOrigin(makeRequest(method, headers))
  return res ? { status: res.status, code: (await res.json()).code } : null
}

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

  it('leaves requests with an API key or bearer token alone', async () => {
    expect(await refusal('POST', { authorization: 'Bearer sk_test', cookie: SESSION, origin: 'https://other.example' })).toBeNull()
    expect(await refusal('POST', { 'x-api-key': 'sk_test', cookie: SESSION })).toBeNull()
    expect(await refusal('POST', { authorization: 'Bearer sk_test', 'content-type': 'text/plain' })).toBeNull()
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
})
