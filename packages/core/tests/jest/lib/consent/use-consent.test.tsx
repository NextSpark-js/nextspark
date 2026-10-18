import { act, renderHook } from '@testing-library/react'
import { CONSENT_EVENT, CONSENT_OPEN_EVENT, getConsentState, openConsentSettings, resolveConsentConfig, useConsent } from '@nextsparkjs/core/lib/consent'

const config = resolveConsentConfig({ enabled: true })
const clearCookies = () => document.cookie.split(';').forEach((c) => (document.cookie = `${c.split('=')[0].trim()}=; Max-Age=0; Path=/`))

beforeEach(clearCookies)

describe('useConsent', () => {
  it('starts with nothing optional granted and no choice', () => {
    const { result } = renderHook(() => useConsent(config))
    expect(result.current).toMatchObject({ enabled: true, hasChosen: false, categories: { necessary: true, analytics: false, marketing: false } })
  })

  it('accept grants every offered category, stores the cookie and fires the event with the categories', () => {
    const events: unknown[] = []
    const listener = (e: Event) => events.push((e as CustomEvent).detail)
    window.addEventListener(CONSENT_EVENT, listener)
    const { result } = renderHook(() => useConsent(config))
    act(() => result.current.accept())
    window.removeEventListener(CONSENT_EVENT, listener)

    expect(result.current).toMatchObject({ hasChosen: true, categories: { necessary: true, analytics: true, marketing: true } })
    expect(document.cookie).toContain('nextspark_consent=')
    expect(events).toEqual([{ hasChosen: true, categories: { necessary: true, analytics: true, marketing: true } }])
  })

  it('reject refuses every optional category but counts as a choice', () => {
    const { result } = renderHook(() => useConsent(config))
    act(() => result.current.accept())
    act(() => result.current.reject())
    expect(result.current).toMatchObject({ hasChosen: true, categories: { necessary: true, analytics: false, marketing: false } })
  })

  it('update changes some categories and keeps the others', () => {
    const { result } = renderHook(() => useConsent(config))
    act(() => result.current.update({ analytics: true }))
    expect(result.current.categories).toEqual({ necessary: true, analytics: true, marketing: false })
    act(() => result.current.update({ marketing: true, analytics: false }))
    expect(result.current.categories).toEqual({ necessary: true, analytics: false, marketing: true })
  })

  it('persists across a reload: a new hook reads the cookie', () => {
    const first = renderHook(() => useConsent(config))
    act(() => first.result.current.update({ analytics: true }))
    first.unmount()
    const second = renderHook(() => useConsent(config))
    expect(second.result.current).toMatchObject({ hasChosen: true, categories: { analytics: true, marketing: false } })
    expect(getConsentState(config).categories.analytics).toBe(true)
  })

  it('shares the choice with every consumer', () => {
    const a = renderHook(() => useConsent(config))
    const b = renderHook(() => useConsent(config))
    act(() => a.result.current.accept())
    expect(b.result.current.categories.analytics).toBe(true)
  })

  it('asks again after a version bump', () => {
    const first = renderHook(() => useConsent(config))
    act(() => first.result.current.accept())
    first.unmount()
    const bumped = resolveConsentConfig({ enabled: true, version: 2 })
    expect(renderHook(() => useConsent(bumped)).result.current.hasChosen).toBe(false)
  })

  it('with consent disabled reports everything granted and writes nothing', () => {
    const off = resolveConsentConfig({ enabled: false })
    const { result } = renderHook(() => useConsent(off))
    expect(result.current).toMatchObject({ enabled: false, hasChosen: true, categories: { analytics: true, marketing: true } })
    act(() => result.current.reject())
    expect(document.cookie).toBe('')
    expect(result.current.categories.analytics).toBe(true)
  })
})

describe('openConsentSettings', () => {
  it('fires the event the banner listens to', () => {
    const listener = jest.fn()
    window.addEventListener(CONSENT_OPEN_EVENT, listener)
    openConsentSettings()
    window.removeEventListener(CONSENT_OPEN_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
