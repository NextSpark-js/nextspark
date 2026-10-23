/**
 * /dashboard/settings/billing: a user without `settings.billing` goes back to /dashboard/settings, but
 * usePermission is false until the team context has chosen the current team, so the redirect waits for it.
 * Without a payment gateway (provider: 'none', #322) the page offers no upgrade or payment-method action, and the
 * usage tiles are the limits of the billing config with their real usage, not fixed numbers.
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
jest.mock('@nextsparkjs/core/components/billing', () => ({
  InvoicesTable: () => null,
  UsageBar: ({ limitSlug }: { limitSlug: string }) => <div data-testid={`usage-bar-${limitSlug}`} />,
}))
const mockRegistry = { provider: 'stripe', plans: [], features: {}, limits: { tasks: {}, team_members: {} } }
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

import BillingPage from '../../../src/routes/dashboard/settings/billing/page'

beforeEach(() => {
  replace.mockClear()
  usePermission.mockReturnValue(true)
  useTeam.mockReturnValue({ isReady: true })
  mockRegistry.provider = 'stripe'
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

test('usage tiles come from the billing limits, with their real usage', () => {
  render(<BillingPage />)
  expect(screen.getByTestId('usage-bar-tasks')).toBeInTheDocument()
  expect(screen.getByTestId('usage-bar-team_members')).toBeInTheDocument()
  expect(screen.queryByText('0 / 100')).toBeNull()
})

test('with a gateway: upgrade and add-payment-method actions are there', () => {
  render(<BillingPage />)
  expect(screen.getByText('billing.upgrade.button')).toBeInTheDocument()
  expect(screen.getByText('billing.paymentMethod.addButton')).toBeInTheDocument()
})

test('provider none: no upgrade and no add-payment-method action', () => {
  mockRegistry.provider = 'none'
  render(<BillingPage />)
  expect(screen.queryByText('billing.upgrade.button')).toBeNull()
  expect(screen.queryByText('billing.paymentMethod.addButton')).toBeNull()
  expect(screen.getByTestId('usage-bar-tasks')).toBeInTheDocument()
})
