/** The billing page is a search result only for roles with `settings.billing`. */
import { renderHook, act } from '@testing-library/react'

let canAccessBilling = true

jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: (p: string) => (p === 'settings.billing' ? canAccessBilling : true) }))
const mockUser = { id: 'u1', role: 'member', email: 'a@x.com' }
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/core/lib/user-data-utils', () => ({ extractUserPlanData: () => ({ plan: 'free' }) }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getEnabledEntities: () => [] }))
jest.mock('@/core/lib/entities/queries', () => ({ getEntityRegistry: () => ({}) }))

import { useSearch } from '@/core/hooks/useSearch'
import { useEntitySearch } from '@/core/hooks/useEntitySearch'

describe.each([[true], [false]])('with settings.billing: %s', (allowed) => {
  beforeEach(() => { canAccessBilling = allowed })

  it.each([['useSearch', useSearch], ['useEntitySearch', useEntitySearch]] as const)('%s', async (_n, hook) => {
    jest.useFakeTimers()
    const { result } = renderHook(() => hook())
    act(() => { result.current.setQuery('billing') })
    await act(async () => { jest.advanceTimersByTime(1000) })
    jest.useRealTimers()
    expect((result.current.results as { url: string }[]).some(r => r.url === '/dashboard/settings/billing')).toBe(allowed)
  })
})
