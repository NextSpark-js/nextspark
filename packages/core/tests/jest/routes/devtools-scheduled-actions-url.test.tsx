/**
 * @jest-environment jsdom
 *
 * Scheduled Actions keeps its filters in the URL (#519): an action type that is not registered (a stale link) is not a
 * filter, so the screen drops it instead of listing nothing; a registered one stays.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockReplace = jest.fn()
let mockSearch = ''
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }), usePathname: () => '/devtools/scheduled-actions', useSearchParams: () => new URLSearchParams(mockSearch) }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import ScheduledActionsPage from '../../../src/routes/devtools/scheduled-actions/page'

const body = { success: true, data: { actions: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }, meta: { registeredActionTypes: ['webhook:send'], failedCount: 0, statusCounts: {} } } }

const mount = async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ScheduledActionsPage /></QueryClientProvider>)
  await new Promise((r) => setTimeout(r, 600)) // the query answers, then the 250 ms debounce
}

beforeEach(() => mockReplace.mockClear())

it('drops a type that is not registered', async () => {
  mockSearch = 'type=bogus&status=failed'
  await mount()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/devtools/scheduled-actions?status=failed', { scroll: false }))
})

it('keeps a registered type', async () => {
  mockSearch = 'type=webhook:send'
  await mount()
  expect(mockReplace).not.toHaveBeenCalled()
})
