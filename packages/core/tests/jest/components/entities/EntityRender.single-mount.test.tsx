/**
 * @jest-environment jsdom
 *
 * Render leftovers of the entity pages (#367): the edit form mounts once (not twice around a blank frame), and the
 * detail page shows its skeleton from the first frame until the record is ready.
 */
import React from 'react'
import { render, waitFor, act } from '@testing-library/react'

const mockGetEntityData = jest.fn()
const formMounts = jest.fn()

const CONFIG = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: {} },
  features: { enabled: true, showInMenu: true },
  fields: [],
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  notFound: jest.fn(),
}))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null, isOverride: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/lib/api/entities', () => ({
  getEntityData: (...args: unknown[]) => mockGetEntityData(...args),
  fetchWithTeam: jest.fn(),
  deleteEntityData: jest.fn(),
  createEntityData: jest.fn(),
  updateEntityData: jest.fn(),
}))
jest.mock('@nextsparkjs/registries/entity-registry.client', () => ({ clientEntityRegistry: { get: () => CONFIG } }))
jest.mock('@/core/lib/entities/client-config', () => ({ toClientEntityConfig: (c: unknown) => c }))
jest.mock('@/core/lib/entities/registry.client', () => ({ clientEntityRegistry: { get: () => CONFIG } }))
jest.mock('@/core/components/entities/EntityDetail', () => ({ EntityDetail: () => <div data-testid="detail" /> }))
jest.mock('@/core/components/ui/skeleton-detail', () => ({ SkeletonEntityDetail: () => <div data-testid="detail-skeleton" /> }))
jest.mock('@/core/components/ui/skeleton-form', () => ({ SkeletonEntityForm: () => <div data-testid="form-skeleton" /> }))
jest.mock('@/core/components/entities/EntityForm', () => ({
  EntityForm: () => {
    React.useEffect(() => { formMounts() }, [])
    return <form data-testid="form" />
  },
}))
jest.mock('@/core/components/entities/EntityDetailHeader', () => ({ EntityDetailHeader: () => null }))
jest.mock('@/core/components/dashboard/block-editor/builder-editor-view', () => ({ BuilderEditorView: () => null }))
const mockT = (key: string) => key
jest.mock('next-intl', () => ({ useTranslations: () => mockT, useLocale: () => 'en' }))

import { EntityDetailWrapper } from '@/core/components/entities/wrappers/EntityDetailWrapper'
import { EntityEditView } from '../../../../src/routes/_internal/entity-edit-view'

beforeEach(() => {
  formMounts.mockReset()
  mockGetEntityData.mockReset().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5))
    return { id: 'r1', title: 'A' }
  })
})

describe('EntityEditView', () => {
  test('the form mounts once', async () => {
    const { findByTestId } = render(<EntityEditView entity="tasks" id="r1" />)
    await findByTestId('form')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(formMounts).toHaveBeenCalledTimes(1)
  })
})

describe('EntityEditView when its parent renders again', () => {
  test('the form is kept and the record is not requested again', async () => {
    const { findByTestId, rerender } = render(<EntityEditView entity="tasks" id="r1" />)
    await findByTestId('form')
    const requests = mockGetEntityData.mock.calls.length
    rerender(<EntityEditView entity="tasks" id="r1" />)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(formMounts).toHaveBeenCalledTimes(1)
    expect(mockGetEntityData.mock.calls.length).toBe(requests)
  })
})

describe('EntityDetailWrapper', () => {
  test('shows the skeleton in every commit until the record is shown', async () => {
    const seen: string[] = []
    const observed = document.createElement('div')
    document.body.appendChild(observed)
    const observer = new MutationObserver(records => {
      for (const r of records) r.addedNodes.forEach(n => seen.push((n as HTMLElement).getAttribute?.('data-testid') ?? 'TEXT:' + n.textContent))
    })
    observer.observe(observed, { childList: true, subtree: true, attributes: true, characterData: true })
    const { findByTestId } = render(<EntityDetailWrapper entityType="tasks" id="r1" />, { container: observed })
    await findByTestId('detail')
    await waitFor(() => expect(observed.querySelector('[data-testid="detail"]')).not.toBeNull())
    observer.disconnect()
    expect(seen.filter(s => s !== 'detail-skeleton' && s !== 'detail')).toEqual([])
    expect(seen[0]).toBe('detail-skeleton')
    expect(observed.textContent).not.toContain('No data found')
  })
})
