/** useSearch and useEntitySearch are public hooks: outside a TeamProvider they do not throw and hide billing. */
import { renderHook, act } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/core/lib/permissions/init', () => ({ permissionRegistry: { hasPermission: () => true } }))
const mockUser = { id: 'u1', role: 'member', email: 'a@x.com' }
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/core/lib/user-data-utils', () => ({ extractUserPlanData: () => ({ plan: 'free' }) }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getEnabledEntities: () => [] }))
jest.mock('@/core/lib/entities/queries', () => ({ getEntityRegistry: () => ({}) }))

import { useSearch } from '@/core/hooks/useSearch'
import { useEntitySearch } from '@/core/hooks/useEntitySearch'

it.each([['useSearch', useSearch], ['useEntitySearch', useEntitySearch]] as const)('%s', async (_n, hook) => {
  jest.useFakeTimers()
  const { result } = renderHook(() => hook())
  act(() => { result.current.setQuery('billing') })
  await act(async () => { jest.advanceTimersByTime(1000) })
  jest.useRealTimers()
  expect((result.current.results as { url: string }[]).some(r => r.url.endsWith('/billing'))).toBe(false)
})
