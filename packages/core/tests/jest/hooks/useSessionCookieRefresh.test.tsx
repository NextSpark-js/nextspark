/**
 * @jest-environment jsdom
 *
 * useSessionCookieRefresh — simulated installed-PWA lifecycle (#125):
 * app opened → sent to background → brought back after a while → connectivity
 * lost and regained. The hook must trigger the real cookie refresh (through the
 * auth Route Handler) on those transitions, throttled.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'

const mockRefreshSessionCookie = jest.fn<() => Promise<unknown>>()
jest.mock('@/core/lib/auth-client', () => ({
  refreshSessionCookie: () => mockRefreshSessionCookie(),
}))

import {
  useSessionCookieRefresh,
  DEFAULT_SESSION_REFRESH_INTERVAL_MS,
} from '@/core/hooks/useSessionCookieRefresh'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useSessionCookieRefresh (PWA scenario)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockRefreshSessionCookie.mockReset()
    mockRefreshSessionCookie.mockResolvedValue({ data: null, error: null })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('refreshes once when the app is opened (mount)', async () => {
    renderHook(() => useSessionCookieRefresh())
    await flush()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)
  })

  test('background → foreground within the throttle window does not refresh again', async () => {
    renderHook(() => useSessionCookieRefresh())
    await flush()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    act(() => setVisibility('hidden'))
    await flush()
    act(() => setVisibility('visible'))
    await flush()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)
  })

  test('coming back to the foreground after the throttle window refreshes the cookie', async () => {
    renderHook(() => useSessionCookieRefresh())
    await flush()

    act(() => setVisibility('hidden'))
    act(() => {
      jest.advanceTimersByTime(DEFAULT_SESSION_REFRESH_INTERVAL_MS + 1)
    })
    act(() => setVisibility('visible'))
    await flush()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(2)
  })

  test('going hidden never triggers a refresh by itself', async () => {
    renderHook(() => useSessionCookieRefresh({ refreshOnMount: false }))
    await flush()

    act(() => {
      jest.advanceTimersByTime(DEFAULT_SESSION_REFRESH_INTERVAL_MS + 1)
    })
    act(() => setVisibility('hidden'))
    await flush()

    expect(mockRefreshSessionCookie).not.toHaveBeenCalled()
  })

  test('a failed refresh (offline) is retried as soon as the device is back online', async () => {
    mockRefreshSessionCookie.mockRejectedValueOnce(new Error('Failed to fetch'))
    renderHook(() => useSessionCookieRefresh())
    await flush()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    // No time has passed — a successful call would still be throttled here,
    // but the failure reset the throttle so `online` retries immediately.
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await flush()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(2)
  })

  test('honours a custom minIntervalMs', async () => {
    renderHook(() => useSessionCookieRefresh({ minIntervalMs: 1000 }))
    await flush()

    act(() => {
      jest.advanceTimersByTime(500)
    })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await flush()
    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(2)
  })

  test('does nothing when disabled', async () => {
    renderHook(() => useSessionCookieRefresh({ enabled: false }))
    await flush()
    act(() => setVisibility('visible'))
    await flush()

    expect(mockRefreshSessionCookie).not.toHaveBeenCalled()
  })

  test('removes its listeners on unmount', async () => {
    const { unmount } = renderHook(() => useSessionCookieRefresh())
    await flush()
    unmount()

    act(() => {
      jest.advanceTimersByTime(DEFAULT_SESSION_REFRESH_INTERVAL_MS + 1)
    })
    act(() => setVisibility('visible'))
    await flush()

    expect(mockRefreshSessionCookie).toHaveBeenCalledTimes(1)
  })
})
