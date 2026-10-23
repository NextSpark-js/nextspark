/**
 * /dashboard/settings/billing: a user without `settings.billing` goes back to /dashboard/settings, but
 * usePermission is false until the team context has chosen the current team, so the redirect waits for it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const replace = jest.fn()
const usePermission = jest.fn()
const useTeam = jest.fn()

const router = { replace, push: jest.fn() } // one stable object, like next's router
jest.mock('next/navigation', () => ({ useRouter: () => router }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/lib/permissions/hooks', () => ({ usePermission: (p: string) => usePermission(p) }))
jest.mock('@nextsparkjs/core/hooks/useTeam', () => ({ useTeam: () => useTeam() }))
jest.mock('@nextsparkjs/core/hooks/useInvoices', () => ({ useInvoices: () => ({ data: { data: [], info: { total: 0 } }, isLoading: false }) }))
jest.mock('@nextsparkjs/core/hooks/useSubscription', () => ({
  useSubscription: () => ({ planSlug: 'free', plan: null, isActive: true, isReady: true }),
}))
jest.mock('@nextsparkjs/core/components/billing', () => ({ InvoicesTable: () => null }))

import BillingPage from '../../../src/routes/dashboard/settings/billing/page'

beforeEach(() => {
  replace.mockClear()
  usePermission.mockReturnValue(true)
  useTeam.mockReturnValue({ isReady: true })
})

test('team still loading (permission false): nothing rendered, no redirect', () => {
  usePermission.mockReturnValue(false)
  useTeam.mockReturnValue({ isReady: false })
  const { container } = render(<BillingPage />)
  expect(container).toBeEmptyDOMElement()
  expect(replace).not.toHaveBeenCalled()
})

test('team ready and the permission is there: the page, no redirect', () => {
  render(<BillingPage />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  expect(replace).not.toHaveBeenCalled()
})

test('team ready and no permission: redirects to /dashboard/settings', () => {
  usePermission.mockReturnValue(false)
  render(<BillingPage />)
  expect(replace).toHaveBeenCalledWith('/dashboard/settings')
})
