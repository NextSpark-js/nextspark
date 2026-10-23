/**
 * @jest-environment jsdom
 *
 * Right after a sign-in the list mounts before the team context has chosen the current team. A request sent then
 * carries no team (400) or the one a previous session left (403), so the list loads once, and only once, the team is
 * ready: not ready -> no request; ready -> one request.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'

const mockUseTeam = jest.fn()
const mockListEntityData = jest.fn()

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
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => mockUseTeam() }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({
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

describe.each(lists)('%s', (_name, ui) => {
  test('requests nothing until the team is ready, then requests once', async () => {
    mockUseTeam.mockReturnValue({ teamId: undefined, isReady: false })
    const { rerender } = render(ui())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mockListEntityData).not.toHaveBeenCalled()

    mockUseTeam.mockReturnValue({ teamId: 'team-1', isReady: true })
    rerender(ui())

    await waitFor(() => expect(mockListEntityData).toHaveBeenCalledTimes(1))
  })
})
