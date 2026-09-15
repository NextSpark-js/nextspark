/**
 * @jest-environment jsdom
 *
 * useAuthActions — the auth actions without a session subscription, so a page
 * that only acts makes no session request.
 */
import { renderHook } from '@testing-library/react'

const mockUseSession = jest.fn(() => ({ data: null, isPending: true, error: null }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/core/lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession(), signIn: { email: jest.fn(), emailOtp: jest.fn(), social: jest.fn() } },
}))
jest.mock('@/core/hooks/useLastAuthMethod', () => ({ useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }) }))

import { useAuth, useAuthActions } from '@/core/hooks/useAuth'

beforeEach(() => mockUseSession.mockClear())

describe('useAuthActions', () => {
  test('offers the actions without reading the session', () => {
    const { result } = renderHook(() => useAuthActions())

    expect(typeof result.current.signIn).toBe('function')
    expect(typeof result.current.signUp).toBe('function')
    expect(typeof result.current.resetPassword).toBe('function')
    expect(mockUseSession).not.toHaveBeenCalled()
  })

  test('useAuth still reads the session and offers the same actions', () => {
    const { result } = renderHook(() => useAuth())

    expect(mockUseSession).toHaveBeenCalled()
    expect(Object.keys(useAuthActionsKeys())).toEqual(expect.arrayContaining(['signIn', 'signOut', 'changePassword']))
    expect(typeof result.current.signInWithOtp).toBe('function')
  })
})

function useAuthActionsKeys() {
  return renderHook(() => useAuthActions()).result.current
}
