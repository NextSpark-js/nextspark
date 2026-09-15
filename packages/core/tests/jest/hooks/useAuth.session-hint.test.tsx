/**
 * @jest-environment jsdom
 *
 * useAuth keeps the session hint and the locale cookie in line with the session.
 */
import { renderHook, act } from '@testing-library/react'

let mockSession: { data: unknown; isPending: boolean; error: unknown } = { data: null, isPending: true, error: null }
const mockSignInEmail = jest.fn()
const mockSignOut = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => mockSession,
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args), emailOtp: jest.fn() },
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({ useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }) }))

import { useAuth } from '@/core/hooks/useAuth'
import { hasSessionHint } from '@/core/lib/auth/session-hint'

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

beforeEach(() => {
  clearCookies()
  mockSignInEmail.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', language: 'es' } }, error: null })
  mockSignOut.mockReset().mockResolvedValue({ data: { success: true }, error: null })
})

describe('useAuth and the session hint', () => {
  test('a session sets the hint, no session clears it, and a failed request leaves it', () => {
    mockSession = { data: { user: { id: 'user-1' } }, isPending: false, error: null }
    const { rerender } = renderHook(() => useAuth())
    expect(hasSessionHint()).toBe(true)

    mockSession = { data: null, isPending: false, error: { status: 500 } }
    rerender()
    expect(hasSessionHint()).toBe(true)

    mockSession = { data: null, isPending: false, error: null }
    rerender()
    expect(hasSessionHint()).toBe(false)
  })

  test('signing in sets the hint and the locale cookie to the account language; signing out clears the hint', async () => {
    mockSession = { data: null, isPending: true, error: null }
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signIn({ email: 'a@example.com', password: 'secret-1234' })
    })
    expect(hasSessionHint()).toBe(true)
    expect(document.cookie).toContain('locale=es')

    await act(async () => {
      await result.current.signOut()
    })
    expect(hasSessionHint()).toBe(false)
  })
})
