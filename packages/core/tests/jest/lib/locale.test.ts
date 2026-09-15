/**
 * getUserLocale — which locale a request renders in, and what it reads to know.
 *
 * It runs for every page (root layout, i18n request config, server
 * translations). A page an anonymous visitor opens must not read the session or
 * the database, an app with a fixed locale must not read the request at all,
 * and a session read never consumes Better Auth's rolling renewal (#125).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const mockGetSession = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))

const mockHeaders = jest.fn<() => unknown>()
const mockCookies = jest.fn<() => unknown>()
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}))

const mockQueryOne = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}))

function headersWith(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null }
}

function cookiesWith(entries: Record<string, string> = {}) {
  return { get: (name: string) => (name in entries ? { value: entries[name] } : undefined) }
}

async function load(i18n: { supportedLocales: string[]; defaultLocale: string; localeDetection?: boolean }) {
  jest.resetModules()
  jest.doMock('@/core/lib/config', () => ({
    I18N_CONFIG: { ...i18n, cookie: { name: 'locale' } },
  }))
  return import('@/core/lib/locale')
}

const MULTI = { supportedLocales: ['en', 'es', 'pt', 'pt-BR'], defaultLocale: 'en' }

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue(null)
  mockHeaders.mockReset().mockReturnValue(headersWith())
  mockCookies.mockReset().mockReturnValue(cookiesWith())
  mockQueryOne.mockReset()
})

describe('getUserLocale', () => {
  test('an anonymous visitor gets the Accept-Language locale without any session read or query', async () => {
    mockHeaders.mockReturnValue(headersWith({ 'accept-language': 'es-AR,es;q=0.9,en;q=0.8', cookie: 'theme=dark' }))
    const { getUserLocale } = await load(MULTI)

    await expect(getUserLocale()).resolves.toBe('es')
    expect(mockGetSession).not.toHaveBeenCalled()
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  test('the locale cookie wins, and nothing else is read', async () => {
    mockCookies.mockReturnValue(cookiesWith({ locale: 'pt' }))
    mockHeaders.mockReturnValue(headersWith({ cookie: 'better-auth.session_token=abc', 'accept-language': 'es' }))
    const { getUserLocale } = await load(MULTI)

    await expect(getUserLocale()).resolves.toBe('pt')
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  test.each([
    ['better-auth.session_token=abc.def'],
    ['__Secure-better-auth.session_token=abc.def'],
  ])('with a session cookie (%s) and no locale cookie, the user language comes from the session, not a query', async cookie => {
    mockHeaders.mockReturnValue(headersWith({ cookie, 'accept-language': 'en' }))
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', language: 'es' } })
    const { getUserLocale } = await load(MULTI)

    await expect(getUserLocale()).resolves.toBe('es')
    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockGetSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ disableRefresh: true }) })
    )
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  test('an unreadable session falls through to the header', async () => {
    mockHeaders.mockReturnValue(headersWith({ cookie: 'better-auth.session_token=abc', 'accept-language': 'es' }))
    mockGetSession.mockRejectedValue(new Error('database unavailable'))
    const { getUserLocale } = await load(MULTI)

    await expect(getUserLocale()).resolves.toBe('es')
  })

  test('Accept-Language is ranked by quality, and a full tag counts before its language', async () => {
    const { preferredLocaleFromHeader } = await load(MULTI)

    expect(preferredLocaleFromHeader('fr;q=0.9, es;q=0.2, pt;q=0.5')).toBe('pt')
    expect(preferredLocaleFromHeader('pt-BR, en;q=0.1')).toBe('pt-BR')
    expect(preferredLocaleFromHeader('pt-PT')).toBe('pt')
    expect(preferredLocaleFromHeader('es;q=0, *')).toBeNull()
    expect(preferredLocaleFromHeader(null)).toBeNull()
  })

  test.each([
    ['a single supported locale', { supportedLocales: ['es'], defaultLocale: 'es' }],
    ['localeDetection: false', { ...MULTI, localeDetection: false }],
  ])('with %s, the default locale is rendered without reading the request', async (_label, i18n) => {
    mockHeaders.mockImplementation(() => { throw new Error('headers() read') })
    mockCookies.mockImplementation(() => { throw new Error('cookies() read') })
    const { getUserLocale } = await load(i18n)

    await expect(getUserLocale()).resolves.toBe(i18n.defaultLocale)
    expect(mockHeaders).not.toHaveBeenCalled()
    expect(mockCookies).not.toHaveBeenCalled()
  })

  test('outside a request (static generation) it renders the default locale', async () => {
    mockHeaders.mockImplementation(() => { throw new Error('headers() called outside request scope') })
    mockCookies.mockImplementation(() => { throw new Error('cookies() called outside request scope') })
    const { getUserLocale } = await load(MULTI)

    await expect(getUserLocale()).resolves.toBe('en')
  })
})
