/**
 * Team members and the owner link to their user page in the team detail, and a subscription with no Stripe link says
 * why in a tooltip instead of showing nothing (#521).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let mockData: unknown
jest.mock('next/navigation', () => ({ useParams: () => ({ teamId: 't1' }), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), usePathname: () => '/area', useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => Object.assign((key: string) => key, { has: () => false }) }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockData, isLoading: false, isFetching: false, error: null, refetch: jest.fn() }),
  keepPreviousData: {},
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))
jest.mock('@nextsparkjs/core/components/superadmin/filters', () => ({ SearchInput: () => null, PaginationControls: () => null }))
jest.mock('@nextsparkjs/core/components/ui/select', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Select: Pass, SelectContent: Pass, SelectItem: Pass, SelectTrigger: Pass, SelectValue: () => null }
})

import TeamDetailPage from '../../../src/routes/superadmin/teams/[teamId]/page'
import SubscriptionsPage from '../../../src/routes/superadmin/subscriptions/page'

it('links the owner and every member to their user page', () => {
  mockData = {
    team: { id: 't1', name: 'Acme', owner: { id: 'o1', name: 'Olive Owner', email: 'o@x' }, memberCount: 2, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' },
    members: [
      { id: 'm1', userId: 'o1', name: 'Olive Owner', email: 'o@x', role: 'owner', joinedAt: '2026-10-13T00:00:00Z' },
      { id: 'm2', userId: 'u2', name: 'Max Member', email: 'm@x', role: 'member', joinedAt: '2026-10-14T00:00:00Z' },
    ],
    subscription: null, billingEvents: [], usage: [],
    metadata: { requestedBy: 'sa', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' },
  }
  render(<TeamDetailPage />)
  expect(screen.getByRole('link', { name: 'Max Member' })).toHaveAttribute('href', '/superadmin/users/u2')
  expect(screen.getAllByRole('link', { name: 'Olive Owner' }).map(a => a.getAttribute('href'))).toEqual(['/superadmin/users/o1', '/superadmin/users/o1'])
})

describe('subscriptions: the link to the provider', () => {
  const sub = (id: string, providerDashboardUrl: string | null) => ({
    id, team: { id: `t-${id}`, name: `Team ${id}`, owner: { name: 'Olive', email: 'o@x' } },
    plan: { id: 'p', slug: 'pro', name: 'Pro', type: 'paid', priceMonthly: 1000, priceYearly: 10000 },
    billingInterval: 'monthly', status: 'active', currentPeriodStart: '2026-10-01T00:00:00Z', currentPeriodEnd: '2026-11-01T00:00:00Z',
    trialEndsAt: null, canceledAt: null, cancelAtPeriodEnd: false, externalSubscriptionId: null, paymentProvider: null, providerDashboardUrl, createdAt: '2026-10-01T00:00:00Z',
  })

  it('a subscription without a provider URL has a tooltip that says there is none; one with it has the link', () => {
    mockData = {
      stats: { total: 2, active: 2, trialing: 0, canceled: 0, pastDue: 0, free: 0, paid: 2, monthly: 2, yearly: 0, mrr: 0, arr: 0 },
      planDistribution: [], subscriptions: [sub('a', null), sub('b', 'https://dashboard.stripe.com/subscriptions/sub_1')],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false }, metadata: { requestedAt: '2026-11-10T12:00:00Z' },
    }
    const { container } = render(<SubscriptionsPage />)
    expect(container.querySelectorAll('[data-cy="subscription-no-provider-link"]')).toHaveLength(1)
    expect(container.querySelector('[data-cy="subscription-no-provider-link"]')).toHaveTextContent('noProviderLink')
    expect(container.querySelectorAll('a[href*="stripe.com"]')).toHaveLength(1)
  })
})
