/** The billing page is a search result only for roles with `settings.billing`. */
import { renderHook, act } from '@testing-library/react'

let canAccessBilling = true

jest.mock('@/core/lib/permissions/hooks', () => ({
  useOptionalPermission: (p: string) => (p === 'settings.billing' ? canAccessBilling : true),
}))
const mockUser = { id: 'u1', role: 'member', email: 'a@x.com' }
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/core/lib/user-data-utils', () => ({ extractUserPlanData: () => ({ plan: 'free' }) }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getEnabledEntities: () => [] }))
jest.mock('@/core/lib/entities/queries', () => ({ getEntityRegistry: () => ({}) }))

import { useSearch } from '@/core/hooks/useSearch'
import { useEntitySearch } from '@/core/hooks/useEntitySearch'

const hooks = [['useSearch', useSearch], ['useEntitySearch', useEntitySearch]] as const

async function search(result: { current: { setQuery: (q: string) => void } }) {
  act(() => { result.current.setQuery('billing') })
  await act(async () => { jest.advanceTimersByTime(1000) })
}
const hasBilling = (r: unknown) => (r as { url: string }[]).some(x => x.url === '/dashboard/settings/billing')

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe.each([[true], [false]])('with settings.billing: %s', (allowed) => {
  beforeEach(() => { canAccessBilling = allowed })

  it.each(hooks)('%s', async (_n, hook) => {
    const { result } = renderHook(() => hook())
    await search(result)
    expect(hasBilling(result.current.results)).toBe(allowed)
  })
})

it.each(hooks)('%s lists billing once the permission turns on', async (_n, hook) => {
  canAccessBilling = false
  const { result, rerender } = renderHook(() => hook())
  await search(result)
  expect(hasBilling(result.current.results)).toBe(false)

  canAccessBilling = true
  rerender()
  await search(result)
  expect(hasBilling(result.current.results)).toBe(true)
})
