/**
 * Proxy identity-header hardening (#87)
 *
 * Inbound x-user-id / x-user-email / x-pathname must never reach the app:
 * they are stripped on EVERY path (public, /api/v1, unmatched) and re-added
 * only from the verified session on protected routes.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

jest.mock('@nextsparkjs/core/lib/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}))

const mockGetAppConfig = jest.fn(() => undefined)
jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: () => false,
  executeProjectMiddleware: jest.fn(),
  getProjectAppConfig: mockGetAppConfig,
}))

import { auth } from '@nextsparkjs/core/lib/auth'
import { getProjectAppConfig } from '@nextsparkjs/core/lib/middleware'
import { NextRequest } from 'next/server'
import { proxy } from '../../../templates/proxy'

type PassThrough = { type?: string; requestHeaders?: Headers | null; redirectUrl?: string; setCookies?: Array<{ name: string; value: string; maxAge?: number }> }

const FORGED = {
  'x-user-id': 'attacker-controlled-id',
  'x-user-email': 'attacker@example.com',
  'x-pathname': '/admin',
  'x-active-team-id': 'attacker-team',
  'x-api-user-id': 'forged-user-id',
  'x-api-key-id': 'forged-key-id',
  'x-api-scopes': '["*"]',
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

const mockedGetSession = auth.api.getSession as unknown as jest.Mock

describe('proxy identity headers (#87)', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
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
    expect(forwarded.get('x-active-team-id')).toBeNull()
    expect(forwarded.get('x-api-user-id')).toBeNull()
    expect(forwarded.get('x-api-key-id')).toBeNull()
    expect(forwarded.get('x-api-scopes')).toBeNull()
    // x-pathname is always the real pathname, never the inbound value
    expect(forwarded.get('x-pathname')).toBe(path)
    // Unrelated headers still pass through
    expect(forwarded.get('next-action')).toBe('abc123')
    expect(mockedGetSession).not.toHaveBeenCalled()
  })

  test('re-adds identity headers only from the verified session on protected routes', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'real-user-id', email: 'real@example.com', role: 'member' } })

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('next')
    const forwarded = response.requestHeaders as Headers
    expect(forwarded.get('x-user-id')).toBe('real-user-id')
    expect(forwarded.get('x-user-email')).toBe('real@example.com')
    expect(forwarded.get('x-pathname')).toBe('/dashboard')
  })

  test('a suspended account\'s session is no session: login', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'user-1@example.com', role: 'suspended' } })
    const response = (await proxy(makeRequest('/dashboard', { cookie: 'better-auth.session_token=abc' }))) as unknown as PassThrough
    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/login')
  })

  test('redirects to login on protected routes without a session (forged header does not help)', async () => {
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/login')
  })
})

describe('proxy role-gated areas', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
  })

  const signedInAs = (role: string) => ({ user: { id: 'user-1', email: 'user-1@example.com', role } })

  test.each(['/superadmin', '/superadmin/users', '/devtools', '/devtools/config'])(
    'sends a visitor without a session on %s to login',
    async path => {
      mockedGetSession.mockResolvedValue(null)

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
    mockedGetSession.mockResolvedValue(signedInAs(role))

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
    expect(mockedGetSession).not.toHaveBeenCalled()
  })
})

describe('proxy path boundaries and redirect targets', () => {
  const mockedAppConfig = getProjectAppConfig as unknown as jest.Mock

  beforeEach(() => {
    mockedGetSession.mockReset()
    mockedAppConfig.mockReset()
    mockedAppConfig.mockReturnValue(undefined)
  })

  test.each(['/administrator', '/dashboard-guide', '/settings-icon.svg', '/profile-photo.jpg', '/update-password-help.png'])(
    '%s only starts like a protected area and passes without a session check',
    async path => {
      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('next')
      expect(mockedGetSession).not.toHaveBeenCalled()
    }
  )

  test('with private docs, /docs-logo.png is not docs, but /docs/intro is', async () => {
    mockedAppConfig.mockReturnValue({ docs: { publicAccess: false } })
    mockedGetSession.mockResolvedValue(null)

    const asset = (await proxy(makeRequest('/docs-logo.png'))) as unknown as PassThrough
    const page = (await proxy(makeRequest('/docs/intro?section=install'))) as unknown as PassThrough

    expect(asset.type).toBe('next')
    expect(page.type).toBe('redirect')
    // LoginForm returns to `callbackUrl` after signing in, and reads no other parameter.
    expect(page.redirectUrl).toContain(`/login?callbackUrl=${encodeURIComponent('/docs/intro?section=install')}`)
  })

  // docs.publicAccess decides who reads /docs; docs.public holds the sidebar
  // settings of that category. The boolean `docs.public: false` of app
  // configs written before publicAccess still means private, and either one
  // set to false keeps the docs private.
  const DOCS_CATEGORY = { enabled: true, open: true, label: 'Documentation' }

  test.each([
    ['publicAccess: false beside the public category settings', { publicAccess: false, public: DOCS_CATEGORY }],
    ['publicAccess: false alone', { publicAccess: false }],
    ['the older public: false', { public: false }],
    ['a leftover public: false beside publicAccess: true', { publicAccess: true, public: false }],
  ])('docs with %s ask for a session', async (_label, docs) => {
    mockedAppConfig.mockReturnValue({ docs })
    mockedGetSession.mockResolvedValue(null)

    for (const path of ['/docs', '/docs/getting-started/introduction']) {
      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('redirect')
      expect(response.redirectUrl).toContain(`/login?callbackUrl=${encodeURIComponent(path)}`)
    }
  })

  test.each([
    ['publicAccess: true beside the public category settings', { publicAccess: true, public: DOCS_CATEGORY }],
    ['only the public category settings', { public: DOCS_CATEGORY }],
    ['a public category that is hidden from the sidebar', { publicAccess: true, public: { ...DOCS_CATEGORY, enabled: false } }],
    ['no docs block at all', undefined],
  ])('docs with %s are served without asking for a session', async (_label, docs) => {
    mockedAppConfig.mockReturnValue(docs === undefined ? {} : { docs })

    for (const path of ['/docs', '/docs/getting-started/introduction']) {
      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('next')
    }
    expect(mockedGetSession).not.toHaveBeenCalled()
  })

  test('private docs are served to a signed-in user', async () => {
    mockedAppConfig.mockReturnValue({ docs: { publicAccess: false, public: DOCS_CATEGORY } })
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'user-1@example.com', role: 'member' } })

    const response = (await proxy(makeRequest('/docs/getting-started/introduction'))) as unknown as PassThrough

    expect(response.type).toBe('next')
  })

  test('says once per server process what to change when docs.public is still the access boolean', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await jest.isolateModulesAsync(async () => {
        const middleware = await import('@nextsparkjs/core/lib/middleware')
        const authModule = await import('@nextsparkjs/core/lib/auth')
        ;(middleware.getProjectAppConfig as unknown as jest.Mock).mockReturnValue({ docs: { public: false } })
        ;(authModule.auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null)
        const { proxy: freshProxy } = await import('../../../templates/proxy')

        await freshProxy(makeRequest('/docs'))
        await freshProxy(makeRequest('/docs/getting-started/introduction'))
      })

      const docsWarnings = warn.mock.calls.filter(([message]) => String(message).includes('docs.public'))
      expect(docsWarnings).toHaveLength(1)
      expect(String(docsWarnings[0][0])).toContain('docs.publicAccess: false')
    } finally {
      warn.mockRestore()
    }
  })

  test('says nothing about the docs block when it already uses publicAccess', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      mockedAppConfig.mockReturnValue({ docs: { publicAccess: false, public: DOCS_CATEGORY } })
      mockedGetSession.mockResolvedValue(null)

      await proxy(makeRequest('/docs'))

      expect(warn.mock.calls.filter(([message]) => String(message).includes('docs.public'))).toHaveLength(0)
    } finally {
      warn.mockRestore()
    }
  })

  // The docs pages live at /docs/[section]/[page] — a two-segment path — so a
  // real page link such as /docs/overview/customization must reach the app
  // unredirected. A stale 2-level -> 3-level rewrite here would send it to a
  // /docs/core/overview/customization that no route answers.
  test('a docs page link passes through, not redirected to a 3-level path', async () => {
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(makeRequest('/docs/getting-started/installation'))) as unknown as PassThrough

    expect(response.type).toBe('next')
  })

  // A historical /docs/<core|theme>/<section>/<page> link (from before the
  // 3-level -> 2-level migration) is redirected to wherever that section
  // lives today, not left to 404. The mock registry (docs-registry.ts) has
  // 'getting-started' under public and 'setup' under superadmin.
  test('a historical 3-level link to a section that is public today redirects there', async () => {
    const response = (await proxy(makeRequest('/docs/theme/getting-started/introduction'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/docs/getting-started/introduction')
  })

  test('a historical 3-level link to a section that is superadmin today redirects there', async () => {
    const response = (await proxy(makeRequest('/docs/core/setup/configuration'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/superadmin/docs/setup/configuration')
  })

  // core/theme-system, core/entities, core/api and core/authentication were
  // real sections under the old 3-level scheme but were dropped, not
  // renamed, when docs were rebuilt around public/superadmin - there is no
  // page left to send these to, so they land on the docs home instead of a
  // redirect into another 404.
  test('a historical 3-level link to a section that no longer exists anywhere redirects to the docs home', async () => {
    const response = (await proxy(makeRequest('/docs/core/theme-system/introduction'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toMatch(/\/docs$/)
  })

  // The section survived the public/superadmin split (it is 'getting-started'
  // in the mock registry) but this particular page did not - redirecting into
  // /docs/getting-started/does-not-exist would just trade one dead link for
  // another, so this has to land on the docs home like a dropped section does.
  test('a historical 3-level link whose section exists but whose page does not redirects to the docs home', async () => {
    const response = (await proxy(makeRequest('/docs/theme/getting-started/does-not-exist'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toMatch(/\/docs$/)
  })

  test('a 2-segment path is never mistaken for the historical 3-level shape', async () => {
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(makeRequest('/docs/core'))) as unknown as PassThrough

    expect(response.type).toBe('next')
  })

  test('a redirect to login carries the query of the page asked for', async () => {
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(makeRequest('/dashboard/settings/billing?plan=pro&cycle=annual'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain(`callbackUrl=${encodeURIComponent('/dashboard/settings/billing?plan=pro&cycle=annual')}`)
  })

  // S80 / D1: behind a proxy that terminates TLS the request's origin is https on a plain-HTTP port. The check used to
  // fetch /api/auth/get-session from that origin, failed, and sent every signed-in user to /login.
  test('the session is read in process from the cookie alone, whatever the forwarded scheme and host say', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'user-1@example.com', role: 'member' } })
    const fetchSpy = jest.fn()
    const realFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      const response = (await proxy(makeRequest('/dashboard', {
        cookie: 'better-auth.session_token=abc',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'evil.example',
        host: 'evil.example',
      }))) as unknown as PassThrough

      expect(response.type).toBe('next')
      expect(response.requestHeaders?.get('x-user-id')).toBe('user-1')
    } finally {
      globalThis.fetch = realFetch
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockedGetSession).toHaveBeenCalledTimes(1)
    const [{ headers, query }] = mockedGetSession.mock.calls[0] as [{ headers: Headers; query?: object }]
    expect([...headers.entries()]).toEqual([['cookie', 'better-auth.session_token=abc']])
    // disableCookieCache: a signed-out or revoked session, or a changed role, counts on the next request
    expect(query).toEqual({ disableRefresh: true, disableCookieCache: true })
  })

  test('a session lookup that throws is no session', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockedGetSession.mockRejectedValue(new Error('database down'))
    try {
      const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough
      expect(response.type).toBe('redirect')
      expect(error).toHaveBeenCalledWith('Proxy error:', expect.any(Error))
    } finally {
      error.mockRestore()
    }
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
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(underBasePath('/superadmin'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/base/es/login?callbackUrl=%2Fsuperadmin')
  })

  test('private docs under a base path redirect to the login under it', async () => {
    mockedAppConfig.mockReturnValue({ docs: { publicAccess: false, public: { enabled: true, open: true, label: 'Documentation' } } })
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(underBasePath('/docs/getting-started/introduction'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain(`/base/es/login?callbackUrl=${encodeURIComponent('/docs/getting-started/introduction')}`)
  })

  test('an access-denied redirect keeps the base path and locale too', async () => {
    mockedGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'user-1@example.com', role: 'member' } })

    const response = (await proxy(underBasePath('/devtools/config'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/base/es/dashboard?error=access_denied')
  })
})

// A docs page route whose section or page the registry lacks is answered with
// the app's not-found page before anything renders: the pages' own notFound()
// runs after their layouts have sent a 200. The mock registry
// (docs-registry.ts) has getting-started/{introduction,installation} and
// features/{components,styling} under public, setup/{configuration,deployment}
// and management/users under superadmin.
describe('proxy docs pages the registry lacks', () => {
  const mockedAppConfig = getProjectAppConfig as unknown as jest.Mock
  const superadmin = { user: { id: 'user-1', email: 'user-1@example.com', role: 'superadmin' }, session: { id: 'session-1' } }

  beforeEach(() => {
    mockedGetSession.mockReset()
    mockedAppConfig.mockReset()
    mockedAppConfig.mockReturnValue(undefined)
  })

  test.each([
    ['a file that does not exist', '/docs/getting-started/99-does-not-exist.md'],
    ['a page that does not exist', '/docs/getting-started/does-not-exist'],
    ['a section that does not exist', '/docs/nope/introduction'],
    ['a superadmin page under a public section name', '/docs/setup/configuration'],
  ])('public docs: %s gets the not-found page', async (_label, path) => {
    const response = (await proxy(makeRequest(path))) as unknown as PassThrough & { rewriteUrl?: string }

    expect(response.type).toBe('rewrite')
    expect(new URL(response.rewriteUrl as string).pathname).toBe('/_not-found')
    expect(response.requestHeaders?.get('x-user-id')).toBeNull()
  })

  test.each(['/docs/getting-started/introduction', '/docs/features/styling', '/docs/getting%2Dstarted/introduction', '/docs', '/docs/getting-started'])(
    'public docs: %s is left to the app',
    async path => {
      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('next')
    }
  )

  test('private docs send a visitor without a session to login before saying whether a page exists', async () => {
    mockedAppConfig.mockReturnValue({ docs: { publicAccess: false } })
    mockedGetSession.mockResolvedValue(null)

    const response = (await proxy(makeRequest('/docs/nope/99-does-not-exist.md'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/login')
  })

  test.each([
    ['a file that does not exist', '/superadmin/docs/setup/99-does-not-exist.md'],
    ['a page that does not exist', '/superadmin/docs/setup/does-not-exist'],
    ['a section that does not exist', '/superadmin/docs/nope/configuration'],
    ['a public page under the superadmin path', '/superadmin/docs/getting-started/introduction'],
  ])('superadmin docs: %s gets the not-found page', async (_label, path) => {
    mockedGetSession.mockResolvedValue(superadmin)

    const response = (await proxy(makeRequest(path))) as unknown as PassThrough & { rewriteUrl?: string }

    expect(response.type).toBe('rewrite')
    expect(new URL(response.rewriteUrl as string).pathname).toBe('/_not-found')
    expect(response.requestHeaders?.get('x-user-id')).toBe('user-1')
  })

  test.each(['/superadmin/docs/setup/configuration', '/superadmin/docs/management/users', '/superadmin/docs'])(
    'superadmin docs: %s is left to the app',
    async path => {
      mockedGetSession.mockResolvedValue(superadmin)

      const response = (await proxy(makeRequest(path))) as unknown as PassThrough

      expect(response.type).toBe('next')
    }
  )

  test('superadmin docs: the session and role are checked before saying whether a page exists', async () => {
    mockedGetSession.mockResolvedValue(null)
    const anonymous = (await proxy(makeRequest('/superadmin/docs/nope/configuration'))) as unknown as PassThrough

    mockedGetSession.mockResolvedValue({ user: { id: 'user-2', email: 'user-2@example.com', role: 'member' } })
    const member = (await proxy(makeRequest('/superadmin/docs/nope/configuration'))) as unknown as PassThrough

    expect(anonymous.type).toBe('redirect')
    expect(anonymous.redirectUrl).toContain('/login')
    expect(member.type).toBe('redirect')
    expect(member.redirectUrl).toContain('error=access_denied')
  })

  test('under a base path, the not-found page is served from under it', async () => {
    const { NextURL } = jest.requireActual('next/dist/server/web/next-url') as {
      NextURL: new (url: string, options: object) => { href: string }
    }
    mockedGetSession.mockResolvedValue(superadmin)
    const request = makeRequest('/superadmin/docs/nope/configuration')
    ;(request as unknown as { nextUrl: unknown }).nextUrl = new NextURL('http://localhost:3000/base/superadmin/docs/nope/configuration', {
      nextConfig: { basePath: '/base' },
    })

    const response = (await proxy(request)) as unknown as PassThrough & { rewriteUrl?: string }

    expect(response.type).toBe('rewrite')
    expect(new URL(response.rewriteUrl as string).pathname).toBe('/base/_not-found')
  })
})

describe('proxy active team header', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
  })

  const session = { user: { id: 'user-1', email: 'user-1@example.com', role: 'member' }, session: { id: 'session-1' } }

  test('forwards the team from a cookie this session wrote', async () => {
    mockedGetSession.mockResolvedValue(session)

    const response = (await proxy(makeRequest('/dashboard/tasks', { cookie: 'activeTeamId=session-1%3Ateam-a' }))) as unknown as PassThrough

    expect(response.type).toBe('next')
    expect(response.requestHeaders?.get('x-active-team-id')).toBe('team-a')
  })

  test.each([
    ['belongs to another session', 'activeTeamId=session-2%3Ateam-a'],
    ['carries no session', 'activeTeamId=team-a'],
    ['is missing', ''],
  ])('forwards no team, whatever the request claims, when the cookie %s', async (_label, cookie) => {
    mockedGetSession.mockResolvedValue(session)

    const response = (await proxy(makeRequest('/dashboard/tasks', { cookie }))) as unknown as PassThrough

    expect(response.type).toBe('next')
    expect(response.requestHeaders?.get('x-active-team-id')).toBeNull()
  })
})

describe('proxy session hint', () => {
  beforeEach(() => {
    mockedGetSession.mockReset()
  })

  const hintCookie = (response: PassThrough) => response.setCookies?.find(cookie => cookie.name === 'nextspark.signed_in')

  test.each([
    ['better-auth.session_token=abc.def'],
    ['__Secure-better-auth.session_token=abc.def'],
  ])('a request with a session cookie (%s) and no hint gets the hint', async cookie => {
    const response = (await proxy(makeRequest('/', { cookie }))) as unknown as PassThrough

    expect(hintCookie(response)).toEqual(expect.objectContaining({ value: '1', path: '/', maxAge: 60 * 60 * 24 * 400 }))
  })

  test('a request with the hint and no session cookie loses the hint', async () => {
    const response = (await proxy(makeRequest('/pricing', { cookie: 'nextspark.signed_in=1' }))) as unknown as PassThrough

    expect(hintCookie(response)).toEqual(expect.objectContaining({ value: '', maxAge: 0 }))
  })

  test.each([
    ['both', 'better-auth.session_token=abc; nextspark.signed_in=1'],
    ['neither', 'theme=dark'],
  ])('a request with %s leaves the hint as it is', async (_label, cookie) => {
    const response = (await proxy(makeRequest('/', { cookie }))) as unknown as PassThrough

    expect(hintCookie(response)).toBeUndefined()
  })
})
