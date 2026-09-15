/**
 * Proxy identity-header hardening (#87)
 *
 * Inbound x-user-id / x-user-email / x-pathname must never reach the app:
 * they are stripped on EVERY path (public, /api/v1, unmatched) and re-added
 * only from the verified session on protected routes.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

jest.mock('@better-fetch/fetch', () => ({
  betterFetch: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasThemeMiddleware: () => false,
  executeThemeMiddleware: jest.fn(),
  getThemeAppConfig: jest.fn(() => undefined),
}))

import { betterFetch } from '@better-fetch/fetch'
import { getThemeAppConfig } from '@nextsparkjs/core/lib/middleware'
import { NextRequest } from 'next/server'
import { proxy } from '../../../templates/proxy'

type PassThrough = { type?: string; requestHeaders?: Headers | null; redirectUrl?: string }

const FORGED = {
  'x-user-id': 'attacker-controlled-id',
  'x-user-email': 'attacker@example.com',
  'x-pathname': '/admin',
}

function makeRequest(path: string, extraHeaders: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'POST' }) as unknown as NextRequest
  // Use the global Headers polyfill (tests/jest/setup.ts) so `new Headers(request.headers)`
  // inside the proxy copies the inbound headers exactly like the runtime does.
  ;(request as unknown as { headers: Headers }).headers = new Headers({
    ...FORGED,
    'next-action': 'abc123',
    cookie: '',
    ...extraHeaders,
  })
  return request
}

const mockedFetch = betterFetch as unknown as jest.Mock

describe('proxy identity headers (#87)', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
    delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  })

  test.each([
    ['public path', '/login'],
    ['root', '/'],
    ['api v1', '/api/v1/teams'],
    ['unmatched path', '/some-marketing-page'],
  ])('strips forged identity headers on %s', async (_label, path) => {
    const response = (await proxy(makeRequest(path))) as unknown as PassThrough

    expect(response.type).toBe('next')
    const forwarded = response.requestHeaders as Headers
    expect(forwarded).toBeTruthy()
    expect(forwarded.get('x-user-id')).toBeNull()
    expect(forwarded.get('x-user-email')).toBeNull()
    // x-pathname is always the real pathname, never the inbound value
    expect(forwarded.get('x-pathname')).toBe(path)
    // Unrelated headers still pass through
    expect(forwarded.get('next-action')).toBe('abc123')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test('re-adds identity headers only from the verified session on protected routes', async () => {
    mockedFetch.mockResolvedValue({
      data: { user: { id: 'real-user-id', email: 'real@example.com', role: 'member' } },
    })

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('next')
    const forwarded = response.requestHeaders as Headers
    expect(forwarded.get('x-user-id')).toBe('real-user-id')
    expect(forwarded.get('x-user-email')).toBe('real@example.com')
    expect(forwarded.get('x-pathname')).toBe('/dashboard')
  })

  test('redirects to login on protected routes without a session (forged header does not help)', async () => {
    mockedFetch.mockResolvedValue({ data: null })

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/login')
  })
})

describe('proxy role-gated areas', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
    delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  })

  const signedInAs = (role: string) => ({ data: { user: { id: 'user-1', email: 'user-1@example.com', role } } })

  test.each(['/superadmin', '/superadmin/users', '/devtools', '/devtools/config'])(
    'sends a visitor without a session on %s to login',
    async path => {
      mockedFetch.mockResolvedValue({ data: null })

      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('redirect')
      expect(response.redirectUrl).toContain('/login')
      expect(response.redirectUrl).toContain(`callbackUrl=${encodeURIComponent(path)}`)
    }
  )

  test.each([
    ['/superadmin/users', 'superadmin', 'next'],
    ['/superadmin/users', 'developer', 'next'],
    ['/superadmin/users', 'member', 'redirect'],
    ['/devtools/config', 'developer', 'next'],
    ['/devtools/config', 'superadmin', 'redirect'],
    ['/devtools/config', 'member', 'redirect'],
  ])('%s signed in as %s: %s', async (path, role, outcome) => {
    mockedFetch.mockResolvedValue(signedInAs(role))

    const response = (await proxy(makeRequest(path))) as unknown as PassThrough

    expect(response.type).toBe(outcome)
    if (outcome === 'redirect') {
      expect(response.redirectUrl).toContain('/dashboard?error=access_denied')
    } else {
      expect((response.requestHeaders as Headers).get('x-user-id')).toBe('user-1')
    }
  })

  test('a path that only starts like a gated area is not gated', async () => {
    const response = (await proxy(makeRequest('/devtools-guide'))) as unknown as PassThrough

    expect(response.type).toBe('next')
    expect(mockedFetch).not.toHaveBeenCalled()
  })
})

describe('proxy path boundaries and redirect targets', () => {
  const mockedAppConfig = getThemeAppConfig as unknown as jest.Mock

  beforeEach(() => {
    mockedFetch.mockReset()
    mockedAppConfig.mockReset()
    mockedAppConfig.mockReturnValue(undefined)
    delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  })

  test.each(['/administrator', '/dashboard-guide', '/settings-icon.svg', '/profile-photo.jpg', '/update-password-help.png'])(
    '%s only starts like a protected area and passes without a session check',
    async path => {
      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('next')
      expect(mockedFetch).not.toHaveBeenCalled()
    }
  )

  test('with private docs, /docs-logo.png is not docs, but /docs/intro is', async () => {
    mockedAppConfig.mockReturnValue({ docs: { public: false } })
    mockedFetch.mockResolvedValue({ data: null })

    const asset = (await proxy(makeRequest('/docs-logo.png'))) as unknown as PassThrough
    const page = (await proxy(makeRequest('/docs/intro?section=install'))) as unknown as PassThrough

    expect(asset.type).toBe('next')
    expect(page.type).toBe('redirect')
    // LoginForm returns to `callbackUrl` after signing in, and reads no other parameter.
    expect(page.redirectUrl).toContain(`/login?callbackUrl=${encodeURIComponent('/docs/intro?section=install')}`)
  })

  test('a redirect to login carries the query of the page asked for', async () => {
    mockedFetch.mockResolvedValue({ data: null })

    const response = (await proxy(makeRequest('/dashboard/settings/billing?plan=pro&cycle=annual'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain(`callbackUrl=${encodeURIComponent('/dashboard/settings/billing?plan=pro&cycle=annual')}`)
  })

  test("the session is asked of the app's own auth route", async () => {
    mockedFetch.mockResolvedValue({ data: null })

    await proxy(makeRequest('/dashboard'))

    expect(mockedFetch).toHaveBeenCalledWith('/api/auth/get-session', expect.objectContaining({ baseURL: 'http://localhost:3000' }))
  })

  function underBasePath(path: string) {
    const { NextURL } = jest.requireActual('next/dist/server/web/next-url') as {
      NextURL: new (url: string, options: object) => unknown
    }
    const request = makeRequest(path)
    ;(request as unknown as { nextUrl: unknown }).nextUrl = new NextURL(`http://localhost:3000/base/es${path}`, {
      nextConfig: { basePath: '/base', i18n: { locales: ['en', 'es'], defaultLocale: 'en' } },
    })
    return request
  }

  test('a redirect to login keeps the base path and locale the request came in with', async () => {
    mockedFetch.mockResolvedValue({ data: null })

    const response = (await proxy(underBasePath('/superadmin'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/base/es/login?callbackUrl=%2Fsuperadmin')
  })

  test('under a base path, the session is asked of the auth route under it', async () => {
    mockedFetch.mockResolvedValue({ data: null })

    await proxy(underBasePath('/dashboard'))

    expect(mockedFetch).toHaveBeenCalledWith('/api/auth/get-session', expect.objectContaining({ baseURL: 'http://localhost:3000/base' }))
  })

  test('an access-denied redirect keeps the base path and locale too', async () => {
    mockedFetch.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user-1@example.com', role: 'member' } } })

    const response = (await proxy(underBasePath('/devtools/config'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/base/es/dashboard?error=access_denied')
  })
})
