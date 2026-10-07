/**
 * The admin and developer areas' CORS rule (isAppOnlyCorsPath) decodes each path segment on its own, and a
 * request whose path cannot be determined gets the same answer as those areas, in corsGrant and in the
 * cookie-write origin check.
 */

jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: {
    api: {
      cors: {
        allowedOrigins: { development: ['https://partner.example.com'], production: [] },
        additionalOrigins: {},
        allowAllOrigins: { development: false, production: false },
      },
    },
  },
}))

import { NextRequest, NextResponse } from 'next/server'
import { APP_CONFIG_MERGED } from '@/core/lib/config'
import { corsGrant, isAppOnlyCorsPath } from '@/core/lib/api/cors-response'
import { checkRequestOrigin } from '@/core/lib/api/request-origin'

const APP = 'https://app.example.com'
const PARTNER = 'https://partner.example.com'
const SESSION = 'better-auth.session_token=abc.def'
const config = APP_CONFIG_MERGED as Parameters<typeof corsGrant>[1]

const saved = { app: process.env.NEXT_PUBLIC_APP_URL, auth: process.env.BETTER_AUTH_URL }
beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP
  delete process.env.BETTER_AUTH_URL
})
afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = saved.app
  if (saved.auth !== undefined) process.env.BETTER_AUTH_URL = saved.auth
})

describe('isAppOnlyCorsPath', () => {
  it.each([
    '/api/%73uperadmin/users/%zz',
    '/api/superadmin/%E0%A4%A',
    '/%zz/api/v1/%64evtools/docs',
    '/base%zz/api/%64%65vtools/x',
  ])('finds the admin area in %s although another segment does not decode', path => {
    expect(isAppOnlyCorsPath(path)).toBe(true)
  })

  it.each(['/api/v1/tasks/%zz', '/api/v1/%73uperadmin-public'])('leaves %s alone', path => {
    expect(isAppOnlyCorsPath(path)).toBe(false)
  })
})

describe('a request whose path cannot be determined', () => {
  it('gets no CORS grant for a listed origin, and the app origin keeps its grant', () => {
    expect(corsGrant(PARTNER, config, 'development', '/api/v1/tasks')).toEqual({ origin: PARTNER, credentials: true })
    expect(corsGrant(PARTNER, config, 'development', undefined)).toBeNull()
    expect(corsGrant(PARTNER, config, 'development')).toBeNull()
    expect(corsGrant(APP, config, 'development', undefined)).toEqual({ origin: APP, credentials: true })
  })

  it('has a cookie-authenticated write from a listed origin refused, and from the app origin allowed', async () => {
    const unparsable = (origin: string) =>
      ({ method: 'POST', url: 'not a url', headers: new Headers({ cookie: SESSION, origin }) }) as unknown as NextRequest

    const refused = checkRequestOrigin(unparsable(PARTNER))
    expect(refused).toBeInstanceOf(NextResponse)
    expect((refused as NextResponse).status).toBe(403)
    expect((await (refused as NextResponse).json()).code).toBe('ORIGIN_NOT_ALLOWED')

    expect(checkRequestOrigin(unparsable(APP))).not.toBeInstanceOf(NextResponse)
    // The same write to a known, ordinary path from the listed origin passes
    expect(checkRequestOrigin(new NextRequest(`${APP}/api/v1/tasks`, { method: 'POST', headers: { cookie: SESSION, origin: PARTNER } }))).not.toBeInstanceOf(NextResponse)
  })
})
