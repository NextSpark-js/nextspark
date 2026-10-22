/**
 * useAuth — the default destination after email and code sign-in follows dashboard.homeRoute of app.config,
 * per role; an explicit callbackUrl still wins; without the option it is /dashboard.
 */
import { renderHook, act } from '@testing-library/react'

const mockPush = jest.fn()
const mockSignInEmail = jest.fn()
const mockSignInEmailOtp = jest.fn()
const mockConfig: { dashboard: { homeRoute?: unknown } | undefined } = { dashboard: undefined }

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}))

jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }),
    signIn: {
      email: (...args: unknown[]) => mockSignInEmail(...args),
      emailOtp: (...args: unknown[]) => mockSignInEmailOtp(...args),
      social: jest.fn(),
    },
  },
}))

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }),
}))

jest.mock('@/core/lib/config/public-config-client', () => ({
  get DASHBOARD_HOME_CONFIG() {
    return mockConfig.dashboard
  },
}))

import { useAuth } from '@/core/hooks/useAuth'

function signInAs(role: string) {
  mockSignInEmail.mockResolvedValue({ data: { user: { id: 'u1', role } }, error: null })
  mockSignInEmailOtp.mockResolvedValue({ data: { user: { id: 'u1', role } }, error: null })
}

async function destinations(redirectTo?: string) {
  mockPush.mockReset()
  const { result } = renderHook(() => useAuth())
  await act(async () => {
    await result.current.signIn({ email: 'a@example.com', password: 'secret-1234', redirectTo })
    await result.current.signInWithOtp({ email: 'a@example.com', otp: '123456', redirectTo })
  })
  return mockPush.mock.calls.map((c) => c[0])
}

beforeEach(() => {
  mockConfig.dashboard = undefined
})

describe('sign-in landing route', () => {
  test('without the option both go to /dashboard', async () => {
    signInAs('member')
    expect(await destinations()).toEqual(['/dashboard', '/dashboard'])
  })

  test('a string applies to every role', async () => {
    mockConfig.dashboard = { homeRoute: '/dashboard/tasks' }
    signInAs('member')
    expect(await destinations()).toEqual(['/dashboard/tasks', '/dashboard/tasks'])
  })

  test('a map follows the role of the signed-in user, with a default for the others', async () => {
    mockConfig.dashboard = { homeRoute: { default: '/dashboard/tasks', superadmin: '/superadmin' } }
    signInAs('superadmin')
    expect(await destinations()).toEqual(['/superadmin', '/superadmin'])
    signInAs('member')
    expect(await destinations()).toEqual(['/dashboard/tasks', '/dashboard/tasks'])
  })

  test('a role missing from a map without default goes to /dashboard', async () => {
    mockConfig.dashboard = { homeRoute: { superadmin: '/superadmin' } }
    signInAs('member')
    expect(await destinations()).toEqual(['/dashboard', '/dashboard'])
  })

  test('callbackUrl takes precedence over the landing route', async () => {
    mockConfig.dashboard = { homeRoute: '/dashboard/tasks' }
    signInAs('member')
    expect(await destinations('/dashboard/reports?page=2')).toEqual(['/dashboard/reports?page=2', '/dashboard/reports?page=2'])
  })

  test('an external callbackUrl is refused and the landing route is used', async () => {
    mockConfig.dashboard = { homeRoute: '/dashboard/tasks' }
    signInAs('member')
    expect(await destinations('//evil.example/phish')).toEqual(['/dashboard/tasks', '/dashboard/tasks'])
  })

  test('a landing route that is not an in-app path is never used', async () => {
    mockConfig.dashboard = { homeRoute: 'https://evil.example/x' }
    signInAs('member')
    expect(await destinations()).toEqual(['/dashboard', '/dashboard'])
  })
})
