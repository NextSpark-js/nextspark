/**
 * @jest-environment jsdom
 *
 * useSessionHint — follows the session hint as the page changes it, so the
 * public navbar and home switch without a reload.
 */
import { renderHook, act } from '@testing-library/react'
import { useSessionHint } from '@/core/hooks/useSessionHint'
import { setSessionHint } from '@/core/lib/auth/session-hint'

beforeEach(() => {
  document.cookie = 'nextspark.signed_in=; Max-Age=0; Path=/'
})

describe('useSessionHint', () => {
  test('a sign-in and a sign-out on the page show without a reload', () => {
    const { result } = renderHook(() => useSessionHint())
    expect(result.current).toEqual({ ready: true, signedIn: false })

    act(() => setSessionHint(true))
    expect(result.current.signedIn).toBe(true)

    act(() => setSessionHint(false))
    expect(result.current.signedIn).toBe(false)
  })

  test('a hint set by a response shows when the tab comes back into view', () => {
    const { result } = renderHook(() => useSessionHint())

    document.cookie = 'nextspark.signed_in=1; Path=/'
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.signedIn).toBe(true)
  })
})
