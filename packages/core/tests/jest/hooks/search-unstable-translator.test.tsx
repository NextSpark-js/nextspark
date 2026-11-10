/**
 * @jest-environment jsdom
 *
 * The search hooks settle with a translator that is new on every call (#421). Their results memoize on it and the
 * search effect clears the results when the query is empty; clearing an already empty list must not render again,
 * or the hook loops.
 */
import { renderHook } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
  useLocale: () => 'en',
}))
const mockUser = { id: 'u1', role: 'member', email: 'a@x.com' }
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ useOptionalPermission: () => true }))
jest.mock('@/core/lib/user-data-utils', () => ({ extractUserPlanData: () => ({ plan: 'free' }) }))
jest.mock('@/core/lib/entities/registry.client', () => ({ getEnabledEntities: () => [] }))
jest.mock('@/core/lib/entities/queries', () => ({ getEntityRegistry: () => ({}) }))

import { useSearch } from '@/core/hooks/useSearch'
import { useEntitySearch } from '@/core/hooks/useEntitySearch'

test.each([
  ['useSearch', useSearch],
  ['useEntitySearch', useEntitySearch],
] as const)('%s renders a bounded number of times with a new translator per call', (_name, hook) => {
  let renders = 0
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  renderHook(() => {
    renders++
    return hook()
  })
  expect(renders).toBeLessThan(10)
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})
