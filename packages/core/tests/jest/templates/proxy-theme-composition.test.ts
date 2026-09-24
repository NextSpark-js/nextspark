/**
 * Project-hook proxy composition (#204)
 *
 * These tests deliberately use Next's real NextRequest/NextResponse classes.
 * In particular, request overrides are asserted through the
 * x-middleware-override-headers protocol Next actually consumes.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockHasThemeMiddleware = jest.fn()
const mockExecuteThemeMiddleware = jest.fn()
const mockGetThemeAppConfig = jest.fn()

jest.mock('@better-fetch/fetch', () => ({
  betterFetch: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: mockHasThemeMiddleware,
  executeProjectMiddleware: (...args: unknown[]) => mockExecuteThemeMiddleware('test-theme', ...args),
  getProjectAppConfig: mockGetThemeAppConfig,
}))

// The core Jest configuration maps next/server to a lightweight mock. This
// suite instead installs Next's fetch primitives and loads the shipped
// NextRequest/NextResponse implementations so middleware request metadata is
// exercised exactly as Next encodes it.
jest.mock('next/server', () => {
  Object.assign(globalThis, jest.requireActual('node:stream/web'))
  const primitives = jest.requireActual('next/dist/compiled/@edge-runtime/primitives/fetch') as {
    Headers: typeof Headers
    Request: typeof Request
    Response: typeof Response
  }
  Object.assign(globalThis, primitives)
  return {
    ...jest.requireActual('next/dist/server/web/spec-extension/request'),
    ...jest.requireActual('next/dist/server/web/spec-extension/response'),
  }
})

import { betterFetch } from '@better-fetch/fetch'
import { NextRequest, NextResponse } from 'next/server'
import { proxy } from '../../../templates/proxy'

const FORGED_IDENTITY = {
  'x-user-id': 'forged-user',
  'x-user-email': 'forged@example.com',
  'x-pathname': '/superadmin',
  'x-active-team-id': 'forged-team',
}

const mockedFetch = betterFetch as unknown as jest.Mock

function request(path: string, headers: Record<string, string> = {}, nextConfig?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { ...FORGED_IDENTITY, ...headers },
    nextConfig,
  } as ConstructorParameters<typeof NextRequest>[1])
}

function forwardedHeaders(response: NextResponse): Headers | null {
  const overridden = response.headers.get('x-middleware-override-headers')
  if (overridden === null) return null

  const headers = new Headers()
  for (const rawName of overridden.split(',')) {
    const name = rawName.trim().toLowerCase()
    if (!name) continue
    const value = response.headers.get(`x-middleware-request-${name}`)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

function responseCookies(response: NextResponse): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  return headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''].filter(Boolean)
}

const memberSession = {
  data: {
    user: { id: 'real-user', email: 'real@example.com', role: 'member' },
    session: { id: 'session-1' },
  },
}

describe('project-hook proxy composition (#204)', () => {
  beforeEach(() => {
    mockHasThemeMiddleware.mockReset().mockReturnValue(true)
    mockExecuteThemeMiddleware.mockReset()
    mockGetThemeAppConfig.mockReset().mockReturnValue(undefined)
    mockedFetch.mockReset()
  })

  test('passes a sanitized request to the theme hook', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) => {
      expect(themeRequest).toBeInstanceOf(NextRequest)
      expect(themeRequest.nextUrl.pathname).toBe('/login')
      expect(themeRequest.headers.get('x-user-id')).toBeNull()
      expect(themeRequest.headers.get('x-user-email')).toBeNull()
      expect(themeRequest.headers.get('x-active-team-id')).toBeNull()
      expect(themeRequest.headers.get('x-pathname')).toBe('/login')
      expect(themeRequest.headers.get('x-custom-inbound')).toBe('kept')
      return NextResponse.next()
    })

    await proxy(request('/login', { 'x-custom-inbound': 'kept' }))

    expect(mockExecuteThemeMiddleware).toHaveBeenCalledWith('test-theme', expect.any(NextRequest), null)
  })

  test('denies an anonymous theme continuation on a protected route', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(NextResponse.next())
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/dashboard?tab=tasks'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(`/login?callbackUrl=${encodeURIComponent('/dashboard?tab=tasks')}`)
  })

  test('denies a theme continuation when the verified user has the wrong role', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(NextResponse.next())
    mockedFetch.mockResolvedValue(memberSession)

    const response = await proxy(request('/devtools/config'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard?error=access_denied')
  })

  test('allows an authenticated continuation and overwrites theme-forged identity with the session', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async () => NextResponse.next({
      request: {
        headers: new Headers({
          'x-user-id': 'theme-user',
          'x-user-email': 'theme@example.com',
          'x-active-team-id': 'theme-team',
          'x-theme-request': 'kept',
        }),
      },
      headers: { 'x-theme-response': 'kept', 'x-user-id': 'theme-response-user' },
    }))
    mockedFetch.mockResolvedValue(memberSession)

    const response = await proxy(request('/dashboard', { cookie: 'activeTeamId=session-1%3Ateam-real' }))
    const forwarded = forwardedHeaders(response)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('x-theme-response')).toBe('kept')
    expect(response.headers.get('x-user-id')).toBeNull()
    expect(forwarded?.get('x-user-id')).toBe('real-user')
    expect(forwarded?.get('x-user-email')).toBe('real@example.com')
    expect(forwarded?.get('x-active-team-id')).toBe('team-real')
    expect(forwarded?.get('x-pathname')).toBe('/dashboard')
    expect(forwarded?.get('x-theme-request')).toBe('kept')
  })

  test('does not restore forged identity on a public continuation', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(NextResponse.next({
      request: {
        headers: new Headers({
          'x-user-id': 'theme-user',
          'x-user-email': 'theme@example.com',
          'x-active-team-id': 'theme-team',
          'x-theme-request': 'kept',
        }),
      },
      headers: { 'x-user-id': 'theme-response-user' },
    }))

    const response = await proxy(request('/login'))
    const forwarded = forwardedHeaders(response)

    expect(forwarded?.get('x-user-id')).toBeNull()
    expect(forwarded?.get('x-user-email')).toBeNull()
    expect(forwarded?.get('x-active-team-id')).toBeNull()
    expect(forwarded?.get('x-pathname')).toBe('/login')
    expect(forwarded?.get('x-theme-request')).toBe('kept')
    expect(response.headers.get('x-user-id')).toBeNull()
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test('preserves a legitimate theme redirect without forwarding request identity metadata', async () => {
    const redirect = NextResponse.redirect('http://localhost:3000/welcome?from=theme')
    redirect.headers.set('x-middleware-override-headers', 'x-user-id')
    redirect.headers.set('x-middleware-request-x-user-id', 'theme-user')
    redirect.headers.set('x-theme-response', 'kept')
    mockExecuteThemeMiddleware.mockResolvedValue(redirect)

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/welcome?from=theme')
    expect(response.headers.get('x-theme-response')).toBe('kept')
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-user-id')).toBeNull()
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test('gates a terminal theme response before it can replace protected content', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async () => new NextResponse('theme content', {
      status: 201,
      headers: { 'x-theme-response': 'kept', 'x-user-id': 'theme-response-user' },
    }))
    mockedFetch.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce(memberSession)

    const anonymous = await proxy(request('/dashboard'))
    const authenticated = await proxy(request('/dashboard'))

    expect(anonymous.status).toBe(307)
    expect(authenticated.status).toBe(201)
    expect(authenticated.headers.get('x-theme-response')).toBe('kept')
    expect(authenticated.headers.get('x-user-id')).toBeNull()
    expect(await authenticated.text()).toBe('theme content')
  })

  test('keeps same-origin rewrites, query, headers, cookies and nonidentity request overrides', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) => {
      const rewrite = NextResponse.rewrite(new URL('/pricing?campaign=fall', themeRequest.url), {
        request: { headers: new Headers({ 'x-theme-request': 'kept' }) },
        headers: { 'x-theme-response': 'kept' },
      })
      rewrite.cookies.set('theme-cookie', 'yes', { path: '/' })
      return rewrite
    })

    const response = await proxy(request('/login'))
    const forwarded = forwardedHeaders(response)

    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/pricing?campaign=fall')
    expect(response.headers.get('x-theme-response')).toBe('kept')
    expect(responseCookies(response).join(';')).toContain('theme-cookie=yes')
    expect(forwarded?.get('x-theme-request')).toBe('kept')
    expect(forwarded?.get('x-pathname')).toBe('/pricing')
  })

  test('a public route rewritten to a protected destination cannot bypass authentication', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/dashboard?tab=team', themeRequest.url)))
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(`/login?callbackUrl=${encodeURIComponent('/dashboard?tab=team')}`)
  })

  test('normalizes repeated slashes before authorizing an anonymous rewrite destination', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(
      NextResponse.rewrite(new URL('http://localhost:3000//dashboard?tab=team'))
    )
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/x'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(`/login?callbackUrl=${encodeURIComponent('/dashboard?tab=team')}`)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  test('normalizes repeated slashes before enforcing a rewrite destination role', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(
      NextResponse.rewrite(new URL('http://localhost:3000///admin/users'))
    )
    mockedFetch.mockResolvedValue(memberSession)

    const response = await proxy(request('/x'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard?error=access_denied')
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  test('decodes an encoded route segment once for access policy without changing the rewrite URL', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(
      NextResponse.rewrite(new URL('http://localhost:3000/%64ashboard?tab=team'))
    )
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/x'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(`/login?callbackUrl=${encodeURIComponent('/dashboard?tab=team')}`)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  test.each([
    '/%2fdashboard',
    '/dashboard%2fsettings',
    '/%252fdashboard',
    '/%zzdashboard',
  ])('fails closed for an ambiguous encoded rewrite pathname %s', async (pathname) => {
    const rewrite = NextResponse.next()
    rewrite.headers.set('x-middleware-rewrite', `http://localhost:3000${pathname}`)
    mockExecuteThemeMiddleware.mockResolvedValue(rewrite)

    const response = await proxy(request('/x'))

    expect(response.status).toBe(502)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test.each(['', 'http://[::1'])(
    'fails closed when a rewrite control header has a malformed destination %j',
    async (destination) => {
      const rewrite = NextResponse.next()
      rewrite.headers.set('x-middleware-rewrite', destination)
      mockExecuteThemeMiddleware.mockResolvedValue(rewrite)

      const response = await proxy(request('/x'))

      expect(response.status).toBe(502)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(mockedFetch).not.toHaveBeenCalled()
    }
  )

  test('preserves a benign encoded segment and query while using its decoded policy pathname', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(
      NextResponse.rewrite(new URL('http://localhost:3000/caf%C3%A9?view=full'))
    )

    const response = await proxy(request('/x'))
    const forwarded = forwardedHeaders(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/caf%C3%A9?view=full')
    expect(forwarded?.get('x-pathname')).toBe('/café')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test('an authenticated same-origin rewrite reaches a protected destination with core identity', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/dashboard?tab=team', themeRequest.url), {
        request: { headers: new Headers({ 'x-user-id': 'theme-user', 'x-theme-request': 'kept' }) },
      }))
    mockedFetch.mockResolvedValue(memberSession)

    const response = await proxy(request('/login'))
    const forwarded = forwardedHeaders(response)

    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/dashboard?tab=team')
    expect(forwarded?.get('x-user-id')).toBe('real-user')
    expect(forwarded?.get('x-pathname')).toBe('/dashboard')
    expect(forwarded?.get('x-theme-request')).toBe('kept')
  })

  test('a rewrite to a role-gated destination enforces the destination role', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/devtools/config', themeRequest.url)))
    mockedFetch.mockResolvedValue(memberSession)

    const response = await proxy(request('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard?error=access_denied')
  })

  test('a protected original route remains protected when rewritten to a public destination', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/pricing', themeRequest.url)))
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(`/login?callbackUrl=${encodeURIComponent('/dashboard')}`)
  })

  test('private docs protection still runs on an internal theme rewrite', async () => {
    mockGetThemeAppConfig.mockReturnValue({ docs: { publicAccess: false } })
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/docs/getting-started/introduction', themeRequest.url)))
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?callbackUrl=')
  })

  test('a null or throwing theme hook safely falls back to core protection', async () => {
    mockedFetch.mockResolvedValue({ data: null })
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      mockExecuteThemeMiddleware.mockResolvedValueOnce(null)
      const nullResponse = await proxy(request('/dashboard'))

      mockExecuteThemeMiddleware.mockRejectedValueOnce(new Error('theme failure'))
      const thrownResponse = await proxy(request('/dashboard'))

      expect(nullResponse.status).toBe(307)
      expect(thrownResponse.status).toBe(307)
      expect(consoleError).toHaveBeenCalledWith(
        'Error executing the project request hook:',
        expect.any(Error)
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  test('keeps basePath and query when a theme rewrite is denied', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async (_theme, themeRequest: NextRequest) =>
      NextResponse.rewrite(new URL('/base/es/dashboard?tab=team', themeRequest.url)))
    mockedFetch.mockResolvedValue({ data: null })

    const response = await proxy(request(
      '/base/es/login',
      {},
      { basePath: '/base', i18n: { locales: ['en', 'es'], defaultLocale: 'en' } }
    ))

    expect(response.headers.get('location')).toContain('/base/es/login?callbackUrl=%2Fdashboard%3Ftab%3Dteam')
  })

  test('keeps theme cookies and synchronizes the session hint on a continuation', async () => {
    mockExecuteThemeMiddleware.mockImplementation(async () => {
      const response = NextResponse.next()
      response.cookies.set('theme-cookie', 'yes', { path: '/' })
      return response
    })

    const response = await proxy(request('/login', { cookie: 'better-auth.session_token=abc.def' }))
    const cookies = responseCookies(response).join(';')

    expect(cookies).toContain('theme-cookie=yes')
    expect(cookies).toContain('nextspark.signed_in=1')
  })

  test('fails closed on external rewrites without forwarding identity', async () => {
    mockExecuteThemeMiddleware.mockResolvedValue(NextResponse.rewrite('https://outside.example/private'))

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(502)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
    expect(mockedFetch).not.toHaveBeenCalled()
  })
})
