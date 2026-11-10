/**
 * /superadmin/subscriptions: the MRR and ARR cards are written in the active locale from the cents of the response, not
 * from the English `mrrFormatted`/`arrFormatted` strings of the API (#413).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const data = {
  stats: { total: 1, active: 1, trialing: 0, canceled: 0, pastDue: 0, free: 0, paid: 1, monthly: 1, yearly: 0, mrr: 123456, mrrFormatted: '$1234.56', arr: 1481472, arrFormatted: '$14814.72' },
  planDistribution: [], subscriptions: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
  metadata: { requestedAt: '2026-11-10T12:00:00Z' },
}

jest.mock('next-intl', () => ({ useLocale: () => 'de', useTranslations: () => (key: string) => key }))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data, isLoading: false, isFetching: false, error: null, refetch: jest.fn() }), keepPreviousData: {} }))
jest.mock('@nextsparkjs/core/components/superadmin/filters', () => ({ SearchInput: () => null, PaginationControls: () => null }))
jest.mock('@nextsparkjs/core/components/ui/select', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Select: Pass, SelectContent: Pass, SelectItem: Pass, SelectTrigger: Pass, SelectValue: () => null }
})

import SubscriptionsPage from '../../../src/routes/superadmin/subscriptions/page'

test('MRR and ARR use the separators of the active locale', () => {
  render(<SubscriptionsPage />)
  expect(screen.getByText(/1\.234,56/)).toBeInTheDocument()
  expect(screen.getByText(/14\.814,72/)).toBeInTheDocument()
})
