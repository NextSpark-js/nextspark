/**
 * getThemeSettings — the root layout's theme settings come from configuration
 * alone: no session read, no request data, no request back to the app.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const mockGetByName = jest.fn<(name: string) => unknown>()
const mockGetAppConfig = jest.fn<(name: string) => unknown>()
jest.mock('@/core/lib/services/theme.service', () => ({
  ThemeService: {
    getByName: (name: string) => mockGetByName(name),
    getAppConfig: (name: string) => mockGetAppConfig(name),
  },
}))

const mockHeaders = jest.fn(() => new Headers({ cookie: 'better-auth.session_token=abc' }))
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => ({ get: () => undefined }),
}))

const mockGetSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } } }))

import { getThemeSettings } from '@/core/lib/theme/get-default-theme-mode'

const fetchMock = jest.fn()

beforeEach(() => {
  mockGetByName.mockReset().mockReturnValue({ defaultMode: 'dark', forcedThemeRoutes: { '/docs': 'light' } })
  mockGetAppConfig.mockReset().mockReturnValue({ ui: { theme: { allowUserToggle: true } } })
  // A signed-in user whose profile saves a theme other than the configured one
  mockGetSession.mockReset().mockResolvedValue({ user: { id: 'user-1' } })
  mockHeaders.mockClear()
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ meta: { uiPreferences: { theme: 'light' } } }) })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('getThemeSettings', () => {
  test('returns the configured mode, toggle and forced routes without reading the session or fetching', async () => {
    await expect(getThemeSettings()).resolves.toEqual({
      defaultMode: 'dark',
      allowUserToggle: true,
      forcedThemeRoutes: { '/docs': 'light' },
    })
    expect(mockGetSession).not.toHaveBeenCalled()
    expect(mockHeaders).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('defaults to system and a toggle the user can use', async () => {
    mockGetByName.mockReturnValue(undefined)
    mockGetAppConfig.mockReturnValue(undefined)

    await expect(getThemeSettings()).resolves.toEqual({ defaultMode: 'system', allowUserToggle: true, forcedThemeRoutes: undefined })
  })
})
