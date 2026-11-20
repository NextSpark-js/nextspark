/**
 * @jest-environment jsdom
 *
 * #501: the Scheduled Actions table shows the team's name (the id on hover and in the expanded row), and a row
 * whose team name did not come with it falls back to the shortened id.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { ActionsTable } from '../../../../src/components/devtools/scheduled-actions/actions-table'
import type { ScheduledActionRow } from '../../../../src/components/devtools/scheduled-actions/types'

afterEach(cleanup)

const action = (over: Partial<ScheduledActionRow>): ScheduledActionRow =>
  ({
    id: 'a1',
    actionType: 'webhook:send',
    status: 'completed',
    payload: {},
    teamId: 'team-nextspark-001',
    scheduledAt: new Date('2026-01-01T10:00:00Z'),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    attempts: 0,
    maxRetries: 3,
    ...over,
  }) as ScheduledActionRow

const renderTable = (actions: ScheduledActionRow[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ActionsTable actions={actions} />
    </QueryClientProvider>
  )

describe('ActionsTable team column', () => {
  test('shows the team name with the id on hover, not a cut id', () => {
    renderTable([action({ teamName: 'NextSpark Team' })])
    const cell = screen.getByText('NextSpark Team')
    expect(cell.getAttribute('title')).toBe('team-nextspark-001')
    expect(screen.queryByText('team-nex')).toBeNull()
  })

  test('shows the name and the full id in the expanded row', () => {
    const { container } = renderTable([action({ teamName: 'NextSpark Team' })])
    fireEvent.click(container.querySelector('tbody button') as HTMLElement)
    expect(screen.getByText('NextSpark Team (team-nextspark-001)')).toBeTruthy()
  })

  test('falls back to the short id when the name is missing', () => {
    renderTable([action({ teamName: null })])
    expect(screen.getByText('team-nex')).toBeTruthy()
  })

  test('a global action shows the no-team label', () => {
    renderTable([action({ teamId: null })])
    expect(screen.getByText('table.noTeam')).toBeTruthy()
  })
})
