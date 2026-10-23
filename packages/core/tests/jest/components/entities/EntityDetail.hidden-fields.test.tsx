/**
 * @jest-environment jsdom
 *
 * #325: the API leaves out the fields `access.fieldVisibility` hides from the caller's role. The detail view must not
 * render them (an empty label would read as "no value"), the same rule as the edit form.
 */
import React from 'react'
import { render } from '@testing-library/react'

const renderedFields: string[] = []

const field = (name: string, type: string) => ({ name, type, required: false, display: { label: name, showInForm: true, showInList: true, showInDetail: true, order: 1 }, api: {} })
const CONFIG = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: {} },
  fields: [field('title', 'text'), field('description', 'textarea'), field('estimatedHours', 'number')],
}

jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermissions: () => ({ canUpdate: true, canDelete: true }) }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({
  EntityFieldRenderer: ({ field: f }: { field: { name: string } }) => { renderedFields.push(f.name); return null },
}))
jest.mock('@/core/components/entities/EntityDetailHeader', () => ({ EntityDetailHeader: () => null }))
jest.mock('@/core/components/entities/EntityChildManager', () => ({ EntityChildManager: () => null }))

import { EntityDetail } from '@/core/components/entities/EntityDetail'

beforeEach(() => {
  renderedFields.length = 0
})

describe('EntityDetail', () => {
  it('does not render the fields the API left out of the record', () => {
    render(<EntityDetail entityConfig={CONFIG as never} data={{ id: 't1', title: 'Write docs' }} />)
    expect(renderedFields).toEqual(['title'])
  })

  it('still renders a field whose value is null: the API sent it', () => {
    render(<EntityDetail entityConfig={CONFIG as never} data={{ id: 't1', title: 'Write docs', description: null, estimatedHours: null }} />)
    expect(renderedFields).toEqual(['title', 'description', 'estimatedHours'])
  })
})
