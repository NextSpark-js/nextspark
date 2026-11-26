/**
 * @jest-environment jsdom
 *
 * Next keeps the list the user left in a hidden <Activity>: its state survives and its effects run again when it is
 * shown. After an entity was created, edited or deleted meanwhile, the list requests its rows again (#576); after
 * nothing changed it does not.
 */
import React, { Activity } from 'react'
import { render, waitFor } from '@testing-library/react'

const mockListEntityData = jest.fn()
let mockMutations = 0

const CONFIG = {
  slug: 'pages',
  enabled: true,
  names: { singular: 'Page', plural: 'Pages' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false } },
  fields: [],
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/pages' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null, isOverride: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({
  get entityMutations() { return mockMutations },
  listEntityData: (...args: unknown[]) => mockListEntityData(...args),
  deleteEntityData: jest.fn(),
  duplicateEntityData: jest.fn(),
}))
jest.mock('@/core/components/entities/EntityTable', () => ({ EntityTable: () => null }))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/patterns/PatternDeleteDialog', () => ({ PatternDeleteDialog: () => null }))
jest.mock('@/core/components/patterns', () => ({ PatternDeleteDialog: () => null }))
jest.mock('@/core/components/shared/SearchInput', () => ({ SearchInput: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({ MultiSelectFilter: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'
import PatternsListPage from '@/core/components/patterns/pages/PatternsListPage'
import PatternsRoutePage from '../../../../src/routes/dashboard/(main)/patterns/page'

const lists: Array<[string, () => React.ReactElement]> = [
  ['EntityListWrapper', () => <EntityListWrapper entityType="pages" />],
  ['PatternsListPage', () => <PatternsListPage />],
  ['routes/dashboard/(main)/patterns/page', () => <PatternsRoutePage />],
]

beforeEach(() => {
  mockListEntityData.mockReset().mockResolvedValue({ data: [] })
})

describe.each(lists)('%s kept hidden by Next', (_name, list) => {
  const ui = (mode: 'visible' | 'hidden') => <Activity mode={mode}>{list()}</Activity>

  test('requests the rows again on return when an entity was created meanwhile', async () => {
    const { rerender } = render(ui('visible'))
    await waitFor(() => expect(mockListEntityData).toHaveBeenCalledTimes(1))

    rerender(ui('hidden'))
    mockMutations++
    rerender(ui('visible'))

    await waitFor(() => expect(mockListEntityData).toHaveBeenCalledTimes(2))
  })

  test('requests nothing on return when nothing changed', async () => {
    const { rerender } = render(ui('visible'))
    await waitFor(() => expect(mockListEntityData).toHaveBeenCalledTimes(1))

    rerender(ui('hidden'))
    rerender(ui('visible'))
    await new Promise(resolve => setTimeout(resolve, 30))

    expect(mockListEntityData).toHaveBeenCalledTimes(1)
  })
})
