/**
 * The devtools and superadmin screens keep search, filters, tab, page and sort in the URL (#519): the hook reads the
 * initial state from the query, writes changes with router.replace after a debounce (one navigation per burst, no
 * defaults in the URL, foreign params kept), falls back to the default for an invalid value, follows a query that
 * changes from outside, and remembers the list's query for a detail's "Back".
 */
import React from 'react'
import { act, renderHook } from '@testing-library/react'

const mockReplace = jest.fn()
let mockSearch = ''
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/superadmin/users',
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

import { useAreaUrlState, useListBackHref, readUrlState, buildUrlQuery } from '@/core/hooks/useAreaUrlState'

const SPEC = {
  tab: { default: 'users', allowed: ['users', 'superadmins'] },
  search: { default: '' },
  page: { default: '1', allowed: (v: string) => /^[1-9]\d{0,5}$/.test(v) },
} as const

beforeEach(() => {
  jest.useFakeTimers()
  mockReplace.mockClear()
  mockSearch = ''
  sessionStorage.clear()
})
afterEach(() => jest.useRealTimers())

describe('readUrlState / buildUrlQuery', () => {
  it('reads valid values and falls back to the default for missing or invalid ones', () => {
    expect(readUrlState(SPEC, new URLSearchParams('tab=superadmins&search=ana&page=3'))).toEqual({ tab: 'superadmins', search: 'ana', page: '3' })
    expect(readUrlState(SPEC, new URLSearchParams('tab=nope&page=-4'))).toEqual({ tab: 'users', search: '', page: '1' })
    expect(readUrlState(SPEC, new URLSearchParams('page=abc'))).toEqual({ tab: 'users', search: '', page: '1' })
  })

  it('leaves defaults out and keeps params it does not own', () => {
    expect(buildUrlQuery(SPEC, { tab: 'users', search: '', page: '1' })).toBe('')
    expect(buildUrlQuery(SPEC, { tab: 'superadmins', search: 'a b', page: '1' }, new URLSearchParams('keep=1&page=9'))).toBe('keep=1&tab=superadmins&search=a+b')
  })
})

describe('useAreaUrlState', () => {
  it('starts from the URL', () => {
    mockSearch = 'tab=superadmins&search=ana&page=2'
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    expect(result.current[0]).toEqual({ tab: 'superadmins', search: 'ana', page: '2' })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('starts from the defaults on an invalid URL, without rewriting it', () => {
    mockSearch = 'tab=zzz&page=0'
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    expect(result.current[0]).toEqual({ tab: 'users', search: '', page: '1' })
    act(() => jest.advanceTimersByTime(1000))
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('updates the state at once and writes one router.replace per burst', () => {
    mockSearch = 'keep=1'
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ search: 'a' }))
    act(() => result.current[1]({ search: 'an', page: '1' }))
    act(() => result.current[1]({ tab: 'superadmins', search: 'ana' }))
    expect(result.current[0]).toEqual({ tab: 'superadmins', search: 'ana', page: '1' })
    expect(mockReplace).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(300))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/superadmin/users?keep=1&tab=superadmins&search=ana', { scroll: false })
  })

  it('goes back to the bare path when everything is the default again', () => {
    mockSearch = 'search=ana'
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ search: '' }))
    act(() => jest.advanceTimersByTime(300))
    expect(mockReplace).toHaveBeenCalledWith('/superadmin/users', { scroll: false })
  })

  it('takes an invalid value as the default', () => {
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ page: '0', tab: 'x' }))
    expect(result.current[0]).toEqual({ tab: 'users', search: '', page: '1' })
  })

  it('follows a query that changes from outside, and ignores its own write coming back', () => {
    const { result, rerender } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ search: 'ana' }))
    act(() => jest.advanceTimersByTime(300))
    mockSearch = 'search=ana' // our own replace arriving
    rerender()
    expect(result.current[0].search).toBe('ana')
    mockSearch = '' // a sidebar link to the bare screen
    rerender()
    expect(result.current[0].search).toBe('')
  })
})

describe('useListBackHref', () => {
  it('is the bare list until the list query is remembered, then the list with its query', () => {
    const { result: bare } = renderHook(() => useListBackHref('/superadmin/users'))
    expect(bare.current).toBe('/superadmin/users')
    mockSearch = 'tab=superadmins&page=2'
    renderHook(() => useAreaUrlState(SPEC))
    const { result } = renderHook(() => useListBackHref('/superadmin/users'))
    expect(result.current).toBe('/superadmin/users?tab=superadmins&page=2')
  })
})

describe('timing and pending writes', () => {
  it('waits the debounce: nothing is written before it, one write after', () => {
    const { result } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ search: 'a' }))
    act(() => jest.advanceTimersByTime(100))
    expect(mockReplace).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(200))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it('does not take a stale URL while a write is pending, and the pending write wins', () => {
    mockSearch = 'search=old'
    const { result, rerender } = renderHook(() => useAreaUrlState(SPEC))
    act(() => result.current[1]({ search: 'typing' }))
    mockSearch = 'search=other'
    rerender()
    expect(result.current[0].search).toBe('typing')
    act(() => jest.advanceTimersByTime(300))
    expect(mockReplace).toHaveBeenLastCalledWith('/superadmin/users?search=typing', { scroll: false })
  })

  it('remembers the query it follows from outside, so Back points at it', () => {
    mockSearch = 'search=ana'
    const { rerender } = renderHook(() => useAreaUrlState(SPEC))
    mockSearch = ''
    rerender()
    const { result } = renderHook(() => useListBackHref('/superadmin/users'))
    expect(result.current).toBe('/superadmin/users')
  })
})
