/**
 * @jest-environment jsdom
 *
 * #522: the error shows under the type of a failed action, a retried action stops offering Retry and links to its
 * retry (and back), a pending action past its time is overdue, the status filter shows counts, and the expand button
 * has a name.
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
import { Filters } from '../../../../src/components/devtools/scheduled-actions/filters'
import { isOverdue, OVERDUE_GRACE_MS } from '../../../../src/components/devtools/scheduled-actions/helpers'
import type { ScheduledActionRow } from '../../../../src/components/devtools/scheduled-actions/types'

afterEach(cleanup)

const action = (over: Partial<ScheduledActionRow>): ScheduledActionRow =>
  ({
    id: 'a1',
    actionType: 'webhook:send',
    status: 'completed',
    payload: {},
    teamId: null,
    scheduledAt: new Date('2026-01-01T10:00:00Z'),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    attempts: 0,
    maxRetries: 3,
    ...over,
  }) as ScheduledActionRow

const renderTable = (actions: ScheduledActionRow[], onViewRelated = jest.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ActionsTable actions={actions} onViewRelated={onViewRelated} />
    </QueryClientProvider>
  )

describe('isOverdue', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')
  test('only a pending action more than the grace past its time', () => {
    const at = (ms: number) => new Date(now - ms)
    expect(isOverdue({ status: 'pending', scheduledAt: at(OVERDUE_GRACE_MS + 1000) }, now)).toBe(true)
    expect(isOverdue({ status: 'pending', scheduledAt: at(10_000) }, now)).toBe(false)
    expect(isOverdue({ status: 'pending', scheduledAt: new Date(now + 60_000) }, now)).toBe(false)
    expect(isOverdue({ status: 'failed', scheduledAt: at(10 * OVERDUE_GRACE_MS) }, now)).toBe(false)
    expect(isOverdue({ status: 'completed', scheduledAt: at(10 * OVERDUE_GRACE_MS) }, now)).toBe(false)
  })
})

describe('ActionsTable', () => {
  test('a failed row shows its error under the type, with the full text on hover', () => {
    renderTable([action({ status: 'failed', errorMessage: 'Request failed with status 502' })])
    expect(screen.getByText('Request failed with status 502').getAttribute('title')).toBe('Request failed with status 502')
  })

  test('a completed row shows no error preview', () => {
    renderTable([action({ status: 'completed', errorMessage: 'stale text' })])
    expect(screen.queryByText('stale text')).toBeNull()
  })

  test('a failed action with no retry offers Retry', () => {
    renderTable([action({ status: 'failed', retriedBy: null })])
    expect(screen.getByText('retry.button')).toBeTruthy()
    expect(screen.queryByText('retry.retried')).toBeNull()
  })

  test('a retried action offers a link to its retry instead of Retry', () => {
    const onViewRelated = jest.fn()
    renderTable([action({ status: 'failed', retriedBy: 'retry-id-123456' })], onViewRelated)
    expect(screen.queryByText('retry.button')).toBeNull()
    fireEvent.click(screen.getByText('retry.retried'))
    expect(onViewRelated).toHaveBeenCalledWith('retry-id-123456')
  })

  test('the retry links back to the failed action it retried', () => {
    const onViewRelated = jest.fn()
    renderTable([action({ id: 'b2', status: 'pending', retryOf: 'original-id-9999' })], onViewRelated)
    fireEvent.click(screen.getByText('original'))
    expect(onViewRelated).toHaveBeenCalledWith('original-id-9999')
  })

  test('a pending action past its time is marked overdue; one that is not due is not', () => {
    renderTable([
      action({ id: 'late', status: 'pending', scheduledAt: new Date(Date.now() - 10 * OVERDUE_GRACE_MS) }),
      action({ id: 'soon', status: 'pending', scheduledAt: new Date(Date.now() + 60 * 60_000) }),
    ])
    expect(screen.getAllByText('status.overdue')).toHaveLength(1)
  })

  test('the expand button has a name that follows its state', () => {
    const { container } = renderTable([action({})])
    const button = container.querySelector('tbody button') as HTMLElement
    expect(button.getAttribute('aria-label')).toBe('table.expandRow')
    fireEvent.click(button)
    expect(button.getAttribute('aria-label')).toBe('table.collapseRow')
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Filters', () => {
  test('the status list shows how many actions each status has', () => {
    render(<Filters filters={{ status: 'failed' }} onFiltersChange={() => {}} registeredActionTypes={[]} statusCounts={{ pending: 2, running: 0, completed: 7, failed: 3 }} />)
    // the closed select shows the chosen status with its count
    expect(screen.getByText('status.failed (3)')).toBeTruthy()
  })

  test('without counts the labels are plain', () => {
    render(<Filters filters={{ status: 'failed' }} onFiltersChange={() => {}} registeredActionTypes={[]} />)
    expect(screen.getByText('status.failed')).toBeTruthy()
  })
})
