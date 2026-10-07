/**
 * @jest-environment jsdom
 *
 * The entity wrappers load in an effect. During a sign-out the session store empties before the page is left, and a
 * wrapper that (re)loads then is answered with a 401: nothing is requested while there is no user.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'

const mockUseAuth = jest.fn()
const mockGetEntityData = jest.fn()
const mockListEntityData = jest.fn()
const mockFetchWithTeam = jest.fn()

const CONFIG = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false } },
  fields: [],
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/tasks' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null, isOverride: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1' }) }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({
  getEntityData: (...args: unknown[]) => mockGetEntityData(...args),
  listEntityData: (...args: unknown[]) => mockListEntityData(...args),
  fetchWithTeam: (...args: unknown[]) => mockFetchWithTeam(...args),
  deleteEntityData: jest.fn(),
  duplicateEntityData: jest.fn(),
  createEntityData: jest.fn(),
  updateEntityData: jest.fn(),
}))
jest.mock('@/core/components/entities/EntityDetail', () => ({ EntityDetail: () => null }))
jest.mock('@/core/components/entities/EntityTable', () => ({ EntityTable: () => null }))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/entities/EntityForm', () => ({ EntityForm: () => null }))
jest.mock('@/core/components/entities/EntityDetailHeader', () => ({ EntityDetailHeader: () => null }))
jest.mock('@/core/components/teams/TeamDetailSection', () => ({ TeamDetailSection: () => null }))
jest.mock('@/core/components/shared/SearchInput', () => ({ SearchInput: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({ MultiSelectFilter: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { EntityDetailWrapper } from '@/core/components/entities/wrappers/EntityDetailWrapper'
import { EntityFormWrapper } from '@/core/components/entities/wrappers/EntityFormWrapper'
import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'

const wrappers: Array<[string, () => React.ReactElement, jest.Mock]> = [
  ['EntityDetailWrapper', () => <EntityDetailWrapper entityType="tasks" id="t1" />, mockFetchWithTeam],
  ['EntityFormWrapper (edit)', () => <EntityFormWrapper entityType="tasks" mode="edit" id="t1" />, mockGetEntityData],
  ['EntityListWrapper', () => <EntityListWrapper entityType="tasks" />, mockListEntityData],
]

beforeEach(() => {
  mockGetEntityData.mockReset().mockResolvedValue({})
  mockListEntityData.mockReset().mockResolvedValue({ data: [] })
  mockFetchWithTeam.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })
  // the detail wrapper loads through entityApi/getEntityData when the entity has no children
  mockGetEntityData.mockResolvedValue({})
})

describe.each(wrappers)('%s', (_name, ui, load) => {
  test('requests nothing while there is no user', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    render(ui())
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(load).not.toHaveBeenCalled()
    expect(mockGetEntityData).not.toHaveBeenCalled()
    expect(mockListEntityData).not.toHaveBeenCalled()
  })

  test('loads once the user is known', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    const { rerender } = render(ui())
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false })
    rerender(ui())

    await waitFor(() => expect(mockGetEntityData.mock.calls.length + mockListEntityData.mock.calls.length + mockFetchWithTeam.mock.calls.length).toBeGreaterThan(0))
  })
})
