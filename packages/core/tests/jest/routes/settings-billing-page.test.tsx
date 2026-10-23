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
const useInvoices = jest.fn()
const useSubscription = jest.fn()

const router = { replace, push: jest.fn() } // one stable object, like next's router
jest.mock('next/navigation', () => ({ useRouter: () => router }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
// `has` is false only for the plan that exists only in the database (slug "nolimit")
jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: (key: string) => !key.includes('nolimit') }),
}))
jest.mock('@nextsparkjs/core/lib/permissions/hooks', () => ({ usePermission: (p: string) => usePermission(p) }))
jest.mock('@nextsparkjs/core/hooks/useTeam', () => ({ useTeam: () => useTeam() }))
jest.mock('@nextsparkjs/core/hooks/useInvoices', () => ({ useInvoices: (o: unknown) => useInvoices(o) }))
jest.mock('@nextsparkjs/core/hooks/useSubscription', () => ({
  useSubscription: () => useSubscription(),
}))
jest.mock('@nextsparkjs/core/components/billing', () => ({
  InvoicesTable: () => null,
  UsageBar: ({ limitSlug }: { limitSlug: string }) => <div data-testid={`usage-bar-${limitSlug}`} />,
}))
const mockRegistry = {
  provider: 'stripe',
  plans: [{ slug: 'free', features: ['basic_analytics'] }, { slug: 'pro', features: ['*'] }],
  features: { basic_analytics: {}, api_access: {} },
  limits: { tasks: {}, team_members: {} },
}
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

import BillingPage from '../../../src/routes/dashboard/settings/billing/page'

beforeEach(() => {
  replace.mockClear()
  useSubscription.mockReturnValue({ planSlug: 'free', plan: null, isActive: true, isReady: true })
  useInvoices.mockReset()
  useInvoices.mockReturnValue({ data: { data: [], info: { total: 0 } }, isLoading: false })
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

test('without the permission the invoices are not requested (the route answers 403)', () => {
  usePermission.mockReturnValue(false)
  render(<BillingPage />)
  expect(useInvoices).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  expect(useInvoices).not.toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
})

test('with the permission the invoices are requested', () => {
  render(<BillingPage />)
  expect(useInvoices).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
})

test('a plan of the config shows its translated name', () => {
  render(<BillingPage />)
  expect(screen.getByText('plans.free.name')).toBeInTheDocument()
})

test('a plan that exists only in the database shows the name from the API, not a missing message key', () => {
  useSubscription.mockReturnValue({ planSlug: 'nolimit', plan: { name: 'No Limit' }, isActive: true, isReady: true })
  render(<BillingPage />)
  expect(screen.getByText('No Limit')).toBeInTheDocument()
  expect(screen.queryByText('plans.nolimit.name')).toBeNull()
})

test('a plan that exists only in the database and has no name falls back to its slug', () => {
  useSubscription.mockReturnValue({ planSlug: 'nolimit', plan: null, isActive: true, isReady: true })
  render(<BillingPage />)
  expect(screen.getByText('nolimit')).toBeInTheDocument()
})

test('the feature list is the one of the current plan in the config', () => {
  render(<BillingPage />)
  expect(screen.getByText('features.basic_analytics')).toBeInTheDocument()
  expect(screen.queryByText('features.api_access')).toBeNull()
  expect(screen.queryByText('billing.features.basicSupport')).toBeNull()
})

test('a plan with "*" lists every feature of the config', () => {
  useSubscription.mockReturnValue({ planSlug: 'pro', plan: null, isActive: true, isReady: true })
  render(<BillingPage />)
  expect(screen.getByText('features.basic_analytics')).toBeInTheDocument()
  expect(screen.getByText('features.api_access')).toBeInTheDocument()
})

test('with a gateway: the upsell links to the plans, with no Contact Sales button', () => {
  render(<BillingPage />)
  expect(screen.getByText('billing.upgrade.ready')).toBeInTheDocument()
  expect(screen.getByText('billing.upgrade.viewPricing')).toBeInTheDocument()
  expect(screen.queryByText('billing.upgrade.contactSales')).toBeNull()
})

test('provider none: no upsell', () => {
  mockRegistry.provider = 'none'
  render(<BillingPage />)
  expect(screen.getByText('features.basic_analytics')).toBeInTheDocument()
  expect(screen.queryByText('billing.upgrade.ready')).toBeNull()
  expect(screen.queryByText('billing.upgrade.explore')).toBeNull()
  expect(screen.queryByText('billing.upgrade.viewPricing')).toBeNull()
})

test('no limits configured: says so instead of an empty card', () => {
  const limits = mockRegistry.limits
  mockRegistry.limits = {}
  try {
    render(<BillingPage />)
    expect(screen.getByText('usage.noLimits')).toBeInTheDocument()
  } finally {
    mockRegistry.limits = limits
  }
})
