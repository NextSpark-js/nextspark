/**
 * getUserLocale runs while rendering Server Components (root layout / i18n
 * request config). It must read the session with `disableRefresh` so it never
 * consumes Better Auth's rolling renewal in a context that cannot write the
 * re-issued cookie (#125).
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const mockGetSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...(args as [])) } },
}))

const mockHeaders = jest.fn()
const mockCookies = jest.fn()
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}))

const mockQueryOne = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...(args as [])),
}))

import { getUserLocale } from '@/core/lib/locale'
import { I18N_CONFIG } from '@/core/lib/config'

function headersWith(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null }
}

function cookiesWith(entries: Record<string, string> = {}) {
  return { get: (name: string) => (name in entries ? { value: entries[name] } : undefined) }
}

describe('getUserLocale (render-time session read)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHeaders.mockReturnValue(headersWith())
    mockCookies.mockReturnValue(cookiesWith())
    mockQueryOne.mockResolvedValue(null)
    mockGetSession.mockResolvedValue(null)
  })

  test('reads the session with disableRefresh so render never consumes the rolling renewal', async () => {
    await getUserLocale()

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockGetSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ disableRefresh: true }) })
    )
  })

  test('returns the authenticated user language when it is a supported locale', async () => {
    const supported = I18N_CONFIG.supportedLocales.find((l) => l !== I18N_CONFIG.defaultLocale)
      ?? I18N_CONFIG.defaultLocale
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockQueryOne.mockResolvedValue({ language: supported })

    await expect(getUserLocale()).resolves.toBe(supported)
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('"users"'), ['user-1'])
  })

  test('falls back to the locale cookie for anonymous visitors', async () => {
    const supported = I18N_CONFIG.supportedLocales.find((l) => l !== I18N_CONFIG.defaultLocale)
      ?? I18N_CONFIG.defaultLocale
    mockCookies.mockReturnValue(cookiesWith({ [I18N_CONFIG.cookie.name]: supported }))

    await expect(getUserLocale()).resolves.toBe(supported)
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  test('falls back to the default locale when the session read throws (static generation)', async () => {
    mockGetSession.mockRejectedValue(new Error('headers() called outside request scope'))

    await expect(getUserLocale()).resolves.toBe(I18N_CONFIG.defaultLocale)
  })
})
