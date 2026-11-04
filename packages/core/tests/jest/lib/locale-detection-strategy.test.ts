/**
 * i18n.detectionStrategy — which sources may pick a request's locale (#379).
 * Sources: cookie, user_database (session language), header (Accept-Language);
 * the order is fixed and `default` is always the fallback.
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

const headersWith = (entries: Record<string, string> = {}) => {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null }
}
const cookiesWith = (entries: Record<string, string> = {}) => ({
  get: (name: string) => (name in entries ? { value: entries[name] } : undefined),
})

type Source = 'user_database' | 'cookie' | 'header' | 'default'
async function load(detectionStrategy?: Source[]) {
  jest.resetModules()
  jest.doMock('@/core/lib/config', () => ({
    I18N_CONFIG: { supportedLocales: ['en', 'es', 'pt'], defaultLocale: 'en', cookie: { name: 'locale' }, detectionStrategy },
  }))
  return import('@/core/lib/locale')
}

const SESSION = 'better-auth.session_token=abc'
const ANON = { 'accept-language': 'es' }

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue({ user: { language: 'pt' } })
  mockHeaders.mockReset().mockReturnValue(headersWith(ANON))
  mockCookies.mockReset().mockReturnValue(cookiesWith())
})

describe('detectionStrategy', () => {
  test.each([
    ['unset', undefined],
    ['with header', ['user_database', 'cookie', 'header', 'default'] as Source[]],
  ])('%s: a visitor without session or cookie gets the Accept-Language locale', async (_l, strategy) => {
    const { getUserLocale } = await load(strategy)
    await expect(getUserLocale()).resolves.toBe('es')
  })

  test('without header: Accept-Language is ignored and the default locale is used', async () => {
    const { getUserLocale } = await load(['user_database', 'cookie', 'default'])
    await expect(getUserLocale()).resolves.toBe('en')
  })

  test('without header: the locale cookie still wins over the default', async () => {
    mockCookies.mockReturnValue(cookiesWith({ locale: 'pt' }))
    const { getUserLocale } = await load(['user_database', 'cookie', 'default'])
    await expect(getUserLocale()).resolves.toBe('pt')
  })

  test('without header: the signed-in user language still applies', async () => {
    mockHeaders.mockReturnValue(headersWith({ ...ANON, cookie: SESSION }))
    const { getUserLocale } = await load(['user_database', 'default'])
    await expect(getUserLocale()).resolves.toBe('pt')
  })

  test('without cookie: the locale cookie is ignored, the header applies', async () => {
    mockCookies.mockReturnValue(cookiesWith({ locale: 'pt' }))
    const { getUserLocale } = await load(['header', 'default'])
    await expect(getUserLocale()).resolves.toBe('es')
  })

  test('without user_database: the session is never read', async () => {
    mockHeaders.mockReturnValue(headersWith({ ...ANON, cookie: SESSION }))
    const { getUserLocale } = await load(['cookie', 'header', 'default'])
    await expect(getUserLocale()).resolves.toBe('es')
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  test('only default: the locale is fixed and the request is not read', async () => {
    const { getUserLocale, isLocaleFixed } = await load(['default'])
    expect(isLocaleFixed()).toBe(true)
    await expect(getUserLocale()).resolves.toBe('en')
    expect(mockHeaders).not.toHaveBeenCalled()
    expect(mockCookies).not.toHaveBeenCalled()
  })
})
