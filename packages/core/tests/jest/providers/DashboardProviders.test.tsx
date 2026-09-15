/**
 * DashboardProviders — what it mounts under each kind of root layout.
 *
 * The root layout provides QueryProvider and Toaster but not TeamProvider or
 * SubscriptionProvider, so the authenticated areas get those two here. Mounting
 * a second query cache or Toaster on top of the root's would split the cache and
 * show every toast twice; mounting a second TeamProvider under an older root
 * layout that still has one would fetch teams and sync the cookie twice.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { DashboardProviders } from '@/core/providers/DashboardProviders'
import { TeamProvider, useTeamContext } from '@/core/contexts/TeamContext'
import { SubscriptionProvider, useSubscriptionContext } from '@/core/contexts/SubscriptionContext'

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, isLoading: false }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

jest.mock('@/core/components/ui/sonner', () => ({
  Toaster: () => require('react').createElement('div', { 'data-testid': 'toaster' }),
}))

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: { plans: [{ slug: 'free', features: [], limits: {} }], limits: {} },
}))

const TEAM_A = { id: 'team-a', name: 'Team A', slug: 'team-a', description: null, owner_id: 'user-1', avatar_url: null, settings: {}, created_at: '2026-01-01', updated_at: '2026-01-01', userRole: 'owner', joinedAt: '2026-01-01T00:00:00Z' }

const fetchMock = jest.fn()

function respond(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body })
}

function callsTo(pattern: RegExp, method = 'GET') {
  return fetchMock.mock.calls.filter(([url, init]) => pattern.test(String(url)) && (init?.method ?? 'GET') === method).length
}

let seenQueryClient: QueryClient | undefined

function Probe() {
  const { currentTeam } = useTeamContext()
  useSubscriptionContext()
  seenQueryClient = useQueryClient()
  return <div data-testid="current-team">{currentTeam?.id ?? 'none'}</div>
}

function rootQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  seenQueryClient = undefined
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/v1/teams') return respond({ data: [TEAM_A] })
    if (url === '/api/v1/teams/switch') return respond({ success: true })
    if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
    return respond({}, 404)
  })
  global.fetch = fetchMock as unknown as typeof fetch
  localStorage.clear()
})

describe('DashboardProviders', () => {
  it('under a root layout with QueryProvider and Toaster, adds only the team and subscription providers', async () => {
    const client = rootQueryClient()
    render(
      <QueryClientProvider client={client}>
        <DashboardProviders>
          <Probe />
        </DashboardProviders>
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))
    expect(seenQueryClient).toBe(client)
    expect(screen.queryAllByTestId('toaster')).toHaveLength(0)
    expect(callsTo(/^\/api\/v1\/teams$/)).toBe(1)
  })

  it('under a root layout with no providers, mounts the whole stack with one Toaster', async () => {
    render(
      <DashboardProviders>
        <Probe />
      </DashboardProviders>
    )

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))
    expect(seenQueryClient).toBeInstanceOf(QueryClient)
    expect(screen.queryAllByTestId('toaster')).toHaveLength(1)
  })

  it('moving to another area under the same root layout posts the team switch only once', async () => {
    const client = rootQueryClient()
    const area = (name: string) => (
      <QueryClientProvider client={client}>
        <DashboardProviders key={name}>
          <Probe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    const { rerender } = render(area('dashboard'))
    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1))

    rerender(area('superadmin'))
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(callsTo(/^\/api\/v1\/teams$/)).toBe(1)
    expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1)
  })

  it('under a root layout that still mounts TeamProvider, adds nothing', async () => {
    render(
      <QueryClientProvider client={rootQueryClient()}>
        <TeamProvider>
          <SubscriptionProvider>
            <DashboardProviders>
              <Probe />
            </DashboardProviders>
          </SubscriptionProvider>
        </TeamProvider>
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))
    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1))
    expect(callsTo(/^\/api\/v1\/teams$/)).toBe(1)
    expect(screen.queryAllByTestId('toaster')).toHaveLength(0)
  })
})
