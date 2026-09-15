/**
 * useAuth — where each way of signing in returns the user.
 *
 * The destination comes from `callbackUrl` in the login URL, which anyone can
 * write, so email and code sign-in only follow a path on this app. Google gets
 * a relative callback that Better Auth accepts, whatever the page's query holds.
 */
import { renderHook, act } from '@testing-library/react'

const mockPush = jest.fn()
const mockSignInEmail = jest.fn()
const mockSignInEmailOtp = jest.fn()
const mockSignInSocial = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}))

jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }),
    signIn: {
      email: (...args: unknown[]) => mockSignInEmail(...args),
      emailOtp: (...args: unknown[]) => mockSignInEmailOtp(...args),
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}))

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }),
}))

import { useAuth } from '@/core/hooks/useAuth'

/** Better Auth 1.6's test for a relative callbackURL (trusted-origins matchesOriginPattern). */
const BETTER_AUTH_RELATIVE_CALLBACK = /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/

beforeEach(() => {
  mockPush.mockReset()
  mockSignInEmail.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockSignInEmailOtp.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockSignInSocial.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('useAuth sign-in destinations', () => {
  test.each([
    ['//evil.example/phish', '/dashboard'],
    ['https://evil.example/phish', '/dashboard'],
    ['/superadmin/users?page=2&search=admin', '/superadmin/users?page=2&search=admin'],
    [undefined, '/dashboard'],
  ])('email and code sign-in with callback %p go to %s', async (redirectTo, expected) => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signIn({ email: 'a@example.com', password: 'secret-1234', redirectTo })
      await result.current.signInWithOtp({ email: 'a@example.com', otp: '123456', redirectTo })
    })

    expect(mockPush.mock.calls).toEqual([[expected], [expected]])
  })

  test.each([
    ['/dashboard?at=2026-09-14T12:30:00Z&filter=status:open', '/dashboard?at=2026-09-14T12%3A30%3A00Z&filter=status%3Aopen&auth_method=google'],
    ['/dashboard?auth_method=email', '/dashboard?auth_method=google'],
    ['/reports?cols=*', '/reports?cols=%2A&auth_method=google'],
    ['//evil.example/phish', '/dashboard?auth_method=google'],
    [undefined, '/dashboard?auth_method=google'],
  ])('Google sign-in with callback %p returns to %s', async (redirectTo, expected) => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.googleSignIn(redirectTo)
    })

    const { callbackURL } = mockSignInSocial.mock.calls[0][0] as { callbackURL: string }
    expect(callbackURL).toBe(expected)
    expect(callbackURL).toMatch(BETTER_AUTH_RELATIVE_CALLBACK)
  })
})
