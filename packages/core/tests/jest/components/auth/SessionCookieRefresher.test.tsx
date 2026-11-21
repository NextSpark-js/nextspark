/**
 * @jest-environment jsdom
 *
 * SessionCookieRefresher — asks for the session only while the browser is
 * signed in, and brings the locale cookie and the hint in line with each
 * answer.
 */

const mockRefreshSessionCookie = jest.fn()
jest.mock('@/core/lib/auth-client', () => ({
  refreshSessionCookie: () => mockRefreshSessionCookie(),
}))

const mockRouterRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: jest.fn() }),
}))

const mockSetTheme = jest.fn()
let mockForcedTheme: string | undefined
jest.mock('@nextsparkjs/core/providers/theme-provider', () => ({
  useTheme: () => ({ setTheme: mockSetTheme, forcedTheme: mockForcedTheme }),
}))

const fetchMock = jest.fn()

import { render, act } from '@testing-library/react'
import { SessionCookieRefresher } from '@/core/components/auth/SessionCookieRefresher'
import type { UseSessionCookieRefreshOptions } from '@/core/hooks/useSessionCookieRefresh'
import { hasSessionHint, setSessionHint } from '@/core/lib/auth/session-hint'
import * as localeClient from '@/core/lib/locale-client'

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

/** Let pending requests and their handlers finish. */
function settle() {
  return act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function mountRefresher(props: UseSessionCookieRefreshOptions = {}) {
  render(<SessionCookieRefresher {...props} />)
  await settle()
}

beforeEach(() => {
  clearCookies()
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.lang = 'en'
  mockForcedTheme = undefined
  mockRefreshSessionCookie.mockReset()
  mockRouterRefresh.mockReset()
  mockSetTheme.mockReset()
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ meta: { uiPreferences: { theme: 'dark' } } }) })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('SessionCookieRefresher', () => {
  test('an anonymous browser makes no session request', async () => {
    await mountRefresher()

    expect(mockRefreshSessionCookie).not.toHaveBeenCalled()
  })

  test('a browser last seen signed in asks, and the account language follows; the theme is not looked up (#495, #510)', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'es' } }, error: null })

    await mountRefresher()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)
    expect(document.cookie).toContain('locale=es')
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
    // Public pages have one theme; the areas apply the account's from the cookie the server writes
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockSetTheme).not.toHaveBeenCalled()
  })

  test('a page already rendered in the account language is not refreshed', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    document.cookie = 'locale=es; Path=/'
    document.documentElement.lang = 'es'
    localStorage.setItem('theme', 'light')
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'es' } }, error: null })

    await mountRefresher()

    expect(mockRouterRefresh).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockSetTheme).not.toHaveBeenCalled()
  })

  test('no session any more clears the hint', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    mockRefreshSessionCookie.mockResolvedValue({ data: null, error: null })

    await mountRefresher()

    expect(document.cookie).not.toContain('nextspark.signed_in=1')
  })

  test('a failed request keeps the hint', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    mockRefreshSessionCookie.mockResolvedValue({ data: null, error: { status: 500 } })

    await mountRefresher()

    expect(document.cookie).toContain('nextspark.signed_in=1')
  })

  test('signing in on the page starts the requests without a reload, and signing out stops them', async () => {
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'en' } }, error: null })
    await mountRefresher({ minIntervalMs: 0 })
    expect(mockRefreshSessionCookie).not.toHaveBeenCalled()

    await act(async () => {
      setSessionHint(true)
    })
    await settle()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    await act(async () => {
      setSessionHint(false)
    })
    mockRefreshSessionCookie.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
    })
    await settle()

    expect(mockRefreshSessionCookie).not.toHaveBeenCalled()
  })

  test('a hint set by a response is noticed when the tab comes back into view', async () => {
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'en' } }, error: null })
    await mountRefresher()

    document.cookie = 'nextspark.signed_in=1; Path=/'
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await settle()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)
  })

  test('a session read still on the wire when the user signs out does not sign the browser back in', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    let answer: (value: unknown) => void = () => {}
    mockRefreshSessionCookie.mockImplementation(() => new Promise(resolve => { answer = resolve }))
    await mountRefresher()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    await act(async () => {
      setSessionHint(false)
    })
    await act(async () => {
      answer({ data: { user: { id: 'user-1', language: 'es' } }, error: null })
    })
    await settle()

    expect(hasSessionHint()).toBe(false)
    expect(document.cookie).not.toContain('locale=es')
    expect(mockRouterRefresh).not.toHaveBeenCalled()
  })

  test('signing in again after a sign-out reads the new session at once, inside the throttle window', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'en' } }, error: null })
    await mountRefresher()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    await act(async () => {
      setSessionHint(false)
    })
    await act(async () => {
      setSessionHint(true)
    })
    await settle()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(2)
  })

  test('a page that stays in another language after one refresh is not refreshed on each session read', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    localStorage.setItem('theme', 'light')
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'es' } }, error: null })
    await mountRefresher({ minIntervalMs: 0 })
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1)

    // A layout that renders a fixed locale keeps the page in English
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await settle()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(2)
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
  })

  test('a locale cookie the page cannot replace does not refresh the page on each session read', async () => {
    document.cookie = 'nextspark.signed_in=1; Path=/'
    localStorage.setItem('theme', 'light')
    mockRefreshSessionCookie.mockResolvedValue({ data: { user: { id: 'user-1', language: 'es' } }, error: null })
    // A cookie written HttpOnly is invisible to document.cookie and a script's write does not replace it
    const writeLocale = jest.spyOn(localeClient, 'setUserLocaleClient').mockImplementation(() => {})

    try {
      await mountRefresher()

      expect(writeLocale).toHaveBeenCalledWith('es')
      expect(mockRouterRefresh).not.toHaveBeenCalled()
    } finally {
      writeLocale.mockRestore()
    }
  })
})
