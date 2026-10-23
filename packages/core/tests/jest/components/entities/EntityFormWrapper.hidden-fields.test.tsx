/**
 * @jest-environment jsdom
 *
 * #325: the API leaves out the fields `access.fieldVisibility` hides from the caller's role. Editing such a record must
 * neither render those fields nor send their empty initial value in the PATCH (it would overwrite the stored value).
 */
import React from 'react'
import { render, waitFor, fireEvent } from '@testing-library/react'

const mockGetEntityData = jest.fn()
const mockUpdateEntityData = jest.fn()
const renderedFields: string[] = []

const field = (name: string, type: string) => ({ name, type, required: false, display: { label: name, showInForm: true, showInList: true, showInDetail: true, order: 1 }, api: {} })
const CONFIG = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: {} },
  fields: [field('title', 'text'), field('secret', 'text'), field('secretFlag', 'boolean'), field('secretNumber', 'number')],
}

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en', useMessages: () => ({}) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/tasks' }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
let configResult: { config: unknown; error: string | null } = { config: CONFIG, error: null }
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ ...configResult, isLoading: false, isOverride: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/lib/api/entities', () => ({
  getEntityData: (...args: unknown[]) => mockGetEntityData(...args),
  createEntityData: jest.fn(),
  updateEntityData: (...args: unknown[]) => mockUpdateEntityData(...args),
}))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({
  EntityFieldRenderer: ({ field: f }: { field: { name: string } }) => { renderedFields.push(f.name); return null },
}))
jest.mock('@/core/components/entities/EntityDetailHeader', () => ({ EntityDetailHeader: () => null }))

import { EntityFormWrapper } from '@/core/components/entities/wrappers/EntityFormWrapper'

beforeEach(() => {
  configResult = { config: CONFIG, error: null }
  renderedFields.length = 0
  mockGetEntityData.mockReset().mockResolvedValue({ id: 't1', title: 'Write docs' })
  mockUpdateEntityData.mockReset().mockResolvedValue({})
})

describe('EntityFormWrapper edit of a record with fields the API left out', () => {
  it('does not render them and does not send them', async () => {
    const { container } = render(<EntityFormWrapper entityType="tasks" mode="edit" id="t1" />)
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull())
    await waitFor(() => expect(renderedFields).toContain('title'))

    expect(renderedFields).not.toContain('secret')
    expect(renderedFields).not.toContain('secretFlag')
    expect(renderedFields).not.toContain('secretNumber')

    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(mockUpdateEntityData).toHaveBeenCalled())
    const sent = mockUpdateEntityData.mock.calls[0][2] as Record<string, unknown>
    expect(sent.title).toBe('Write docs')
    expect(Object.keys(sent).sort()).toEqual(['id', 'title'].sort())
  })

  it('keeps sending a field the API returned as null', async () => {
    mockGetEntityData.mockResolvedValue({ id: 't1', title: 'x', secret: null, secretFlag: false, secretNumber: null })
    const { container } = render(<EntityFormWrapper entityType="tasks" mode="edit" id="t1" />)
    await waitFor(() => expect(renderedFields).toContain('secret'))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(mockUpdateEntityData).toHaveBeenCalled())
    expect(Object.keys(mockUpdateEntityData.mock.calls[0][2] as object)).toEqual(expect.arrayContaining(['secret', 'secretFlag', 'secretNumber']))
  })
})

describe('EntityFormWrapper edit without a usable config', () => {
  it('shows the config error, not a skeleton waiting for a record that is never requested', async () => {
    configResult = { config: null, error: 'Entity not found' }
    const { findByText } = render(<EntityFormWrapper entityType="ghosts" mode="edit" id="g1" />)
    expect(await findByText('Entity not found')).toBeTruthy()
    expect(mockGetEntityData).not.toHaveBeenCalled()
  })
})
