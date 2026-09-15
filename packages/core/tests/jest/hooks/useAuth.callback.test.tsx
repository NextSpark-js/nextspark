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
const mockRequestPasswordReset = jest.fn()

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
    requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
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
  mockRequestPasswordReset.mockReset().mockResolvedValue({ data: { status: true }, error: null })
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

  test('the password reset email returns to the reset-password page', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.resetPassword('a@example.com')
    })

    const { redirectTo } = mockRequestPasswordReset.mock.calls[0][0] as { redirectTo: string }
    expect(new URL(redirectTo).pathname).toBe('/reset-password')
  })

  describe('under a basePath', () => {
    const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

    beforeEach(() => {
      process.env.__NEXT_ROUTER_BASEPATH = '/base'
    })

    afterEach(() => {
      if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
      else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
    })

    test.each([
      ['/dashboard?at=2026-09-14T12:30:00Z&filter=status:open', '/base/dashboard?at=2026-09-14T12%3A30%3A00Z&filter=status%3Aopen&auth_method=google'],
      ['/reports?cols=*', '/base/reports?cols=%2A&auth_method=google'],
      ['//evil.example/phish', '/base/dashboard?auth_method=google'],
      [undefined, '/base/dashboard?auth_method=google'],
    ])('Google sign-in with callback %p returns to %s, base path included', async (redirectTo, expected) => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.googleSignIn(redirectTo)
      })

      // This is exactly the `callbackURL` Better Auth's client sends the server
      // and later stores in OAuth state, so this is the value its callback
      // route will hand back to the browser as the post sign-in redirect.
      const { callbackURL } = mockSignInSocial.mock.calls[0][0] as { callbackURL: string }
      expect(callbackURL).toBe(expected)
      expect(callbackURL).toMatch(BETTER_AUTH_RELATIVE_CALLBACK)
    })

    test('the password reset email returns to the reset-password page, base path included', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.resetPassword('a@example.com')
      })

      // Better Auth redirects to this URL as-is once the emailed link is opened.
      const { redirectTo } = mockRequestPasswordReset.mock.calls[0][0] as { redirectTo: string }
      expect(new URL(redirectTo).pathname).toBe('/base/reset-password')
    })
  })
})
