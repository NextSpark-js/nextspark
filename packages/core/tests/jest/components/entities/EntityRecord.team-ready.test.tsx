/**
 * @jest-environment jsdom
 *
 * A record (detail, edit form, pattern edit and reports pages) mounted right after a sign-in is requested only once
 * the team context has chosen the current team: before that the request carries no team (400) or a stale one (403).
 * Not ready -> no request; ready -> exactly one.
 */
import React from 'react'
import { render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockUseTeam = jest.fn()
const mockGetEntityData = jest.fn()
const mockFetchWithTeam = jest.fn()
const mockTeamContext = jest.fn()

const CONFIG = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: {} },
  features: { enabled: true },
  fields: [],
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useParams: () => ({ id: 'r1' }),
  useSearchParams: () => new URLSearchParams(),
  notFound: jest.fn(),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null, isOverride: false }) }))
jest.mock('@/core/contexts/TeamContext', () => ({ useOptionalTeamContext: () => mockTeamContext() }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => mockUseTeam() }))
jest.mock('@/core/lib/api/entities', () => ({
  getEntityData: (...args: unknown[]) => mockGetEntityData(...args),
  fetchWithTeam: (...args: unknown[]) => mockFetchWithTeam(...args),
  deleteEntityData: jest.fn(),
  createEntityData: jest.fn(),
  updateEntityData: jest.fn(),
}))
jest.mock('@nextsparkjs/registries/entity-registry.client', () => ({
  getEntityBySlug: () => CONFIG,
  ensureClientInitialized: async () => undefined,
  clientEntityRegistry: { getBySlug: () => CONFIG, get: () => CONFIG },
}))
jest.mock('@/core/lib/entities/client-config', () => ({ toClientEntityConfig: (c: unknown) => c }))
jest.mock('@/core/lib/entities/registry.client', () => ({ clientEntityRegistry: { get: () => CONFIG, getBySlug: () => CONFIG } }))
jest.mock('@/core/components/entities/EntityDetail', () => ({ EntityDetail: () => null }))
jest.mock('@/core/components/entities/EntityForm', () => ({ EntityForm: () => null }))
jest.mock('@/core/components/entities/EntityDetailHeader', () => ({ EntityDetailHeader: () => null }))
jest.mock('@/core/components/dashboard/block-editor/builder-editor-view', () => ({ BuilderEditorView: () => null }))
jest.mock('@/core/components/patterns/PatternUsageReport', () => ({ PatternUsageReport: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en', useMessages: () => ({}) }))

import { EntityDetailWrapper } from '@/core/components/entities/wrappers/EntityDetailWrapper'
import { EntityFormWrapper } from '@/core/components/entities/wrappers/EntityFormWrapper'
import PatternEditPage from '@/core/components/patterns/pages/PatternEditPage'
import PatternReportsPage from '@/core/components/patterns/pages/PatternReportsPage'
import PatternEditRoute from '../../../../src/routes/dashboard/(main)/patterns/[id]/edit/page'
import PatternReportsRoute from '../../../../src/routes/dashboard/(main)/patterns/[id]/reports/page'
import { EntityEditView } from '../../../../src/routes/_internal/entity-edit-view'
import { useEntityQuery, useEntityOne } from '@/core/hooks/useEntityQuery'

const requests = () => mockGetEntityData.mock.calls.length + mockFetchWithTeam.mock.calls.length

// [name, page, requests once ready]: the three edit pages load the record and then render EntityFormWrapper, which loads it again
const pages: Array<[string, () => React.ReactElement, number]> = [
  ['EntityDetailWrapper', () => <EntityDetailWrapper entityType="tasks" id="r1" />, 1],
  ['EntityFormWrapper (edit)', () => <EntityFormWrapper entityType="tasks" mode="edit" id="r1" />, 1],
  ['PatternEditPage', () => <PatternEditPage />, 2],
  ['PatternReportsPage', () => <PatternReportsPage />, 1],
  ['patterns/[id]/edit route page', () => <PatternEditRoute />, 2],
  ['patterns/[id]/reports route page', () => <PatternReportsRoute />, 1],
  ['EntityEditView', () => <EntityEditView entity="tasks" id="r1" />, 2],
]

beforeEach(() => {
  mockGetEntityData.mockReset().mockResolvedValue({ id: 'r1' })
  mockFetchWithTeam.mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'r1' } }) })
})

describe.each(pages)('%s', (_name, ui, expected) => {
  test('requests nothing until the team is ready, then requests once', async () => {
    mockUseTeam.mockReturnValue({ teamId: undefined, isReady: false })
    const { rerender } = render(ui())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(requests()).toBe(0)

    mockUseTeam.mockReturnValue({ teamId: 'team-1', isReady: true })
    rerender(ui())

    await waitFor(() => expect(requests()).toBe(expected))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(requests()).toBe(expected)
  })
})

describe.each([
  ['useEntityQuery', () => useEntityQuery({ entityConfig: CONFIG as never })],
  ['useEntityOne', () => useEntityOne(CONFIG as never, 'r1')],
])('%s', (_name, hook) => {
  test('requests nothing until the team is ready, then requests once', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    mockTeamContext.mockReturnValue({ isReady: false })
    const { rerender } = renderHook(hook, { wrapper })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mockFetchWithTeam).not.toHaveBeenCalled()

    mockTeamContext.mockReturnValue({ isReady: true })
    rerender()

    await waitFor(() => expect(mockFetchWithTeam).toHaveBeenCalledTimes(1))
  })
})
