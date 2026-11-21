/**
 * /superadmin/teams/[teamId] (#534): usage with a translated label, "25 / 50 GB" and a bar against the plan's limit, a
 * readable period, no empty Actions column in the billing history, and a skeleton while loading.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const base = {
  team: { id: 't1', name: 'Acme', owner: { id: 'u1', name: 'Ann', email: 'ann@example.com' }, memberCount: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  members: [],
  subscription: null,
  billingHistory: [] as Array<Record<string, unknown>>,
  usage: {} as Record<string, unknown>,
  metadata: { requestedBy: 'sa-1', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' },
}

jest.mock('next/navigation', () => ({ useParams: () => ({ teamId: 't1' }) }))
const KNOWN = new Set(['teamDetail.limitNames.storage_gb', 'teamDetail.limitNames.tasks'])
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign(
    (key: string, values?: Record<string, unknown>) => {
      if (key === 'teamDetail.limitNames.storage_gb') return 'Storage'
      if (key === 'teamDetail.limitNames.tasks') return 'Tasks'
      if (key === 'planMatrix.gigabytes') return `${values?.value} GB`
      if (key === 'planMatrix.unlimited') return 'Unlimited'
      if (key === 'teamDetail.usageAllTime') return 'All time'
      if (key === 'teamDetail.usagePeriod') return `Period: ${values?.period}`
      return values ? `${key}${JSON.stringify(values)}` : key
    },
    { has: (key: string) => KNOWN.has(key) },
  ),
}))
const query: { data?: typeof base; isLoading: boolean; error: null; refetch: jest.Mock } = { data: base, isLoading: false, error: null, refetch: jest.fn() }
jest.mock('@tanstack/react-query', () => ({ useQuery: () => query }))

import TeamDetailPage from '../../../src/routes/superadmin/teams/[teamId]/page'

const show = (patch: Partial<typeof base>) => {
  query.data = { ...base, ...patch }
  query.isLoading = false
  render(<TeamDetailPage />)
}

it('shows each counter with its translated name, the plan limit, a bar and a readable period', () => {
  show({
    usage: {
      storage_gb: { current: 25, periodKey: 'all_time', limit: 50, unit: 'bytes' },
      tasks: { current: 7, periodKey: '2026-11', limit: -1, unit: 'count' },
      file_uploads: { current: 3, periodKey: '2026', limit: null, unit: null },
      bandwidth: { current: 150, periodKey: 'all_time', limit: -1, unit: 'bytes' },
    },
  })
  const storage = document.querySelector('[data-cy="usage-storage_gb"]')!
  expect(storage).toHaveTextContent('Storage')
  expect(storage).toHaveTextContent('25 / 50 GB')
  expect(storage).toHaveTextContent('Period: All time')
  expect(storage.querySelector('[role="progressbar"] > div')).toHaveStyle({ transform: 'translateX(-50%)' }) // half full

  const tasks = document.querySelector('[data-cy="usage-tasks"]')!
  expect(tasks).toHaveTextContent('7 / Unlimited')
  expect(tasks).toHaveTextContent('Period: November 2026')
  expect(tasks.querySelector('[role="progressbar"]')).toBeNull()

  expect(document.querySelector('[data-cy="usage-bandwidth"]')).toHaveTextContent('150 GB / Unlimited') // the unit stays when the limit is open

  const other = document.querySelector('[data-cy="usage-file_uploads"]')!
  expect(other).toHaveTextContent('File uploads') // a counter with no translation is humanized, never the raw key
  expect(other).toHaveTextContent('3')
  expect(other).toHaveTextContent('Period: 2026')
})

it('has no Actions column when no billing event has an invoice or a receipt', () => {
  const event = { id: 'e1', type: 'payment', status: 'succeeded', amount: 1000, amountFormatted: '$10.00', currency: 'usd', createdAt: '2026-11-01T00:00:00Z' }
  show({ billingHistory: [{ ...event, invoiceUrl: null, receiptUrl: null }] })
  expect(screen.queryByText('teamDetail.billingColumns.actions')).not.toBeInTheDocument()
})

it('keeps the Actions column when an event has an invoice', () => {
  const event = { id: 'e1', type: 'payment', status: 'succeeded', amount: 1000, amountFormatted: '$10.00', currency: 'usd', createdAt: '2026-11-01T00:00:00Z' }
  show({ billingHistory: [{ ...event, invoiceUrl: 'https://example.com/i/1', receiptUrl: null }] })
  expect(screen.getByText('teamDetail.billingColumns.actions')).toBeInTheDocument()
  expect(screen.getByText('teamDetail.invoice')).toBeInTheDocument()
})

it('shows a skeleton, not a spinner and plain text, while loading', () => {
  query.data = undefined
  query.isLoading = true
  render(<TeamDetailPage />)
  expect(document.querySelector('[data-cy="team-detail-skeleton"]')).toBeInTheDocument()
  expect(document.querySelector('.animate-spin')).toBeNull()
})
