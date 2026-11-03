/**
 * @jest-environment jsdom
 *
 * Cache Components keeps a visited route in a hidden <Activity> and shows it again on navigation with its state. The
 * detail page restored after saving an edit must request the record again, not show the values from before the save (#386).
 */
import React, { Activity } from 'react'
import { render, waitFor } from '@testing-library/react'

const mockGetEntityData = jest.fn()
const CONFIG = { slug: 'tasks', enabled: true, names: { singular: 'Task', plural: 'Tasks' }, access: {}, fields: [] }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 't1', isReady: true }) }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null, isOverride: false }) }))
jest.mock('@/core/lib/api/entities', () => ({
  getEntityData: (...args: unknown[]) => mockGetEntityData(...args),
  fetchWithTeam: jest.fn(),
  deleteEntityData: jest.fn(),
}))
jest.mock('@/core/components/teams/TeamDetailSection', () => ({ TeamDetailSection: () => null }))
jest.mock('@/core/components/ui/skeleton-detail', () => ({ SkeletonEntityDetail: () => <div>loading</div> }))
jest.mock('@/core/components/entities/EntityDetail', () => ({
  EntityDetail: ({ data }: { data: { title: string } }) => <div>{data.title}</div>,
}))

import { EntityDetailWrapper } from '@/core/components/entities/wrappers/EntityDetailWrapper'

test('the detail requests the record again when its hidden route is shown again', async () => {
  mockGetEntityData.mockResolvedValueOnce({ id: 'r1', title: 'before' }).mockResolvedValueOnce({ id: 'r1', title: 'after' })
  const ui = (mode: 'visible' | 'hidden') => (
    <Activity mode={mode}><EntityDetailWrapper entityType="tasks" id="r1" /></Activity>
  )
  const { rerender, findByText, queryByText } = render(ui('visible'))
  await findByText('before')

  rerender(ui('hidden'))
  rerender(ui('visible'))

  await waitFor(() => expect(mockGetEntityData).toHaveBeenCalledTimes(2))
  await findByText('after')
  expect(queryByText('before')).toBeNull()
})
