/**
 * SubscriptionProvider — who fetches, what the others see, which failures are retried.
 *
 * Only a role with team.billing.view may read the team's subscription, so only
 * that role fetches. Everyone else gets a neutral, ready context, and every
 * consumer of the provider keeps working under it.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionProvider, useSubscriptionContext } from '@/core/contexts/SubscriptionContext'
import { useSubscription } from '@/core/hooks/useSubscription'
import { useFeature } from '@/core/hooks/useFeature'
import { useMembership } from '@/core/hooks/useMembership'
import { SubscriptionStatus } from '@/core/components/billing/SubscriptionStatus'
import { ManageBillingButton } from '@/core/components/billing/ManageBillingButton'
import { PricingTable } from '@/core/components/billing/PricingTable'

let mockTeam: { id: string } | null = { id: 'team-a' }
let mockTeamLoading = false
let mockRole: string | null = 'owner'

jest.mock('@/core/hooks/useTeam', () => ({
  useTeam: () => ({ team: mockTeam, isLoading: mockTeamLoading }),
}))

// The permission and role hooks are the real ones, over the team context and the registry mock,
// where team.billing.view is listed for admin only: the owner has every permission
jest.mock('@/core/contexts/TeamContext', () => ({
  useTeamContext: () => ({
    currentTeam: mockTeam,
    userTeams: mockTeam && mockRole ? [{ team: mockTeam, role: mockRole }] : [],
  }),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: { plans: [{ slug: 'free', features: ['reports'], limits: {} }], features: { reports: { name: 'Reports' } }, limits: {} },
}))

const fetchMock = jest.fn()

function respond(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body })
}

const SUBSCRIPTION = {
  status: 'active',
  externalCustomerId: 'cus_1',
  plan: { slug: 'free', features: ['reports'], limits: {} },
}

function State() {
  const { error, isReady, isLoading, plan, features, limits } = useSubscriptionContext()
  return (
    <div data-testid="state">
      {[error ? 'error' : isReady ? 'ready' : 'loading', isLoading ? 'busy' : 'idle', plan ? 'plan' : 'no-plan', features.length, Object.keys(limits).length].join(' ')}
    </div>
  )
}

function Consumers() {
  const subscription = useSubscription()
  const feature = useFeature('reports')
  const membership = useMembership()
  return (
    <>
      <div data-testid="consumers">{[subscription.planSlug ?? 'none', feature, membership.hasFeature('reports')].join(' ')}</div>
      <SubscriptionStatus />
      <ManageBillingButton />
      <PricingTable />
    </>
  )
}

function renderProvider(children: React.ReactNode = <State />) {
  // No retry override: the provider's own policy decides, over the library's
  // default of three retries in the browser.
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </QueryClientProvider>
  )
}

const state = () => screen.getByTestId('state').textContent

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  mockTeam = { id: 'team-a' }
  mockTeamLoading = false
  mockRole = 'owner'
})

describe.each(['member', 'viewer'])('SubscriptionProvider for a %s', role => {
  beforeEach(() => {
    mockRole = role
  })

  it('makes no request and exposes a neutral, ready context', async () => {
    renderProvider()

    await waitFor(() => expect(state()).toBe('ready idle no-plan 0 0'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps every consumer working', async () => {
    expect(() => renderProvider(<Consumers />)).not.toThrow()

    expect(screen.getByTestId('consumers').textContent).toBe('none false false')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('has a refetch that does nothing', () => {
    let refetch: () => void = () => {}
    function Grab() {
      refetch = useSubscriptionContext().refetch
      return null
    }
    renderProvider(<Grab />)

    refetch()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe.each(['owner', 'admin'])('SubscriptionProvider for an %s', role => {
  beforeEach(() => {
    mockRole = role
  })

  it('fetches once and receives the plan', async () => {
    fetchMock.mockImplementation(() => respond(200, { data: { subscription: SUBSCRIPTION } }))
    renderProvider(<><State /><Consumers /></>)

    await waitFor(() => expect(state()).toBe('ready idle plan 1 0'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/teams/team-a/subscription')
  })
})

describe('SubscriptionProvider while the team or the role is pending', () => {
  it('fetches nothing and is not ready while the team loads', () => {
    mockTeam = null
    mockTeamLoading = true
    renderProvider()

    expect(state()).toBe('loading idle no-plan 0 0')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches nothing and is not ready while the role is unknown', () => {
    mockRole = null
    renderProvider()

    expect(state()).toBe('loading idle no-plan 0 0')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('SubscriptionProvider failures', () => {
  it('treats a 404 from a legacy generated route as no subscription', async () => {
    // Projects created before .190 retain a copied route which returns 404
    // instead of the current `{ data: { subscription: null } }` response.
    fetchMock.mockImplementation(() => respond(404, { error: 'Not found' }))
    renderProvider()

    await waitFor(() => expect(state()).toBe('ready idle no-plan 0 0'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a 403 as no plan data, without retrying', async () => {
    fetchMock.mockImplementation(() => respond(403, { error: 'Forbidden' }))
    renderProvider()

    await waitFor(() => expect(state()).toBe('ready idle no-plan 0 0'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a server error', async () => {
    fetchMock
      .mockImplementationOnce(() => respond(500))
      .mockImplementation(() => respond(200, { data: { subscription: null } }))
    renderProvider()

    await waitFor(() => expect(state()).toBe('ready idle no-plan 0 0'), { timeout: 2000 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps a server error that stays observable', async () => {
    fetchMock.mockImplementation(() => respond(500))
    renderProvider()

    await waitFor(() => expect(state()).toMatch(/^error/), { timeout: 5000 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  }, 8000)
})
