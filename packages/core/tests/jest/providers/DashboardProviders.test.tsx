/**
 * DashboardProviders — what it mounts under each kind of root layout.
 *
 * The root layout provides QueryProvider and Toaster but not TeamProvider or
 * SubscriptionProvider, so the authenticated areas get those two here. Mounting
 * a second query cache or Toaster on top of the root's would split the cache and
 * show every toast twice; mounting a second TeamProvider under an older root
 * layout that still has one would fetch teams and sync the cookie twice.
 */
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { DashboardProviders } from '@/core/providers/DashboardProviders'
import { TeamProvider, useTeamContext } from '@/core/contexts/TeamContext'
import { SubscriptionProvider, useSubscriptionContext } from '@/core/contexts/SubscriptionContext'

let mockSessionId = 'session-1'
let mockUserId = 'user-1'

// One object per signed-in state, as better-auth's session store hands out:
// a new user object on every render would re-run TeamProvider's effects on any
// render and hide whether they run when they should.
const mockAuthStates = new Map<string, unknown>()

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => {
    const key = `${mockUserId}:${mockSessionId}`
    if (!mockAuthStates.has(key)) {
      mockAuthStates.set(key, { user: { id: mockUserId }, session: { session: { id: mockSessionId } }, isLoading: false })
    }
    return mockAuthStates.get(key)
  },
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
  mockSessionId = 'session-1'
  mockUserId = 'user-1'
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

  it('a new session on the same page posts the team switch again, even for the same team', async () => {
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

    // Signing in again, as anyone, expires the cookie on the server while the
    // page keeps its query client.
    mockSessionId = 'session-2'
    rerender(area('dashboard-after-signing-in-again'))

    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(2))
  })

  it('a new session on a mounted provider writes the cookie again for the team already active', async () => {
    const client = rootQueryClient()
    const tree = () => (
      <QueryClientProvider client={client}>
        <DashboardProviders>
          <Probe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    const { rerender } = render(tree())
    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1))

    // A password change that revoked the other sessions leaves the same user,
    // on the same page, with a new session.
    mockSessionId = 'session-2'
    rerender(tree())

    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(2))
  })

  it('switching teams by hand posts the switch once', async () => {
    const TEAM_B = { ...TEAM_A, id: 'team-b', name: 'Team B', slug: 'team-b', joinedAt: '2026-02-01T00:00:00Z' }
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/teams') return respond({ data: [TEAM_A, TEAM_B] })
      if (url === '/api/v1/teams/switch') return respond({ success: true })
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
    let switchTeam: ((teamId: string) => Promise<void>) | undefined
    function SwitchProbe() {
      const context = useTeamContext()
      switchTeam = context.switchTeam
      return <div data-testid="current-team">{context.currentTeam?.id ?? 'none'}</div>
    }
    render(
      <QueryClientProvider client={rootQueryClient()}>
        <DashboardProviders>
          <SwitchProbe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1))

    await act(async () => {
      await switchTeam!('team-b')
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    const switchedTo = fetchMock.mock.calls
      .filter(([url]) => url === '/api/v1/teams/switch')
      .map(([, init]) => JSON.parse(init.body).teamId)
    expect(switchedTo).toEqual(['team-a', 'team-b'])
  })

  it('a different user on the same page gets their own teams, not the cached ones', async () => {
    const TEAM_C = { ...TEAM_A, id: 'team-c', name: 'Team C', slug: 'team-c' }
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/teams') return respond({ data: [mockUserId === 'user-2' ? TEAM_C : TEAM_A] })
      if (url === '/api/v1/teams/switch') return respond({ success: true })
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
    const client = rootQueryClient()
    const dashboard = (name: string) => (
      <QueryClientProvider client={client}>
        <DashboardProviders key={name}>
          <Probe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    const { rerender } = render(dashboard('as-user-1'))
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))

    // user-1 signs out and user-2 signs in on /login, where no TeamProvider is
    // mounted to notice, while the root layout keeps its query client.
    rerender(<QueryClientProvider client={client}><div /></QueryClientProvider>)
    mockUserId = 'user-2'
    mockSessionId = 'session-2'
    rerender(dashboard('as-user-2'))

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-c'))
    expect(callsTo(/^\/api\/v1\/teams$/)).toBe(2)
  })

  it('a failed cookie write is tried again', async () => {
    let switchCalls = 0
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/teams') return respond({ data: [TEAM_A] })
      // The first write fails only after TeamProvider has re-rendered with the
      // team it picked, so nothing but a retry posts it again.
      if (url === '/api/v1/teams/switch') {
        return ++switchCalls === 1
          ? new Promise(resolve => setTimeout(() => resolve({ ok: false, status: 500, json: async () => ({}) }), 200))
          : respond({ success: true })
      }
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
    render(
      <QueryClientProvider client={rootQueryClient()}>
        <DashboardProviders>
          <Probe />
        </DashboardProviders>
      </QueryClientProvider>
    )

    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(2), { timeout: 3000 })
  })

  it('a manual switch the server rejects is tried again', async () => {
    const TEAM_B = { ...TEAM_A, id: 'team-b', name: 'Team B', slug: 'team-b', joinedAt: '2026-02-01T00:00:00Z' }
    let teamBWrites = 0
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/teams') return respond({ data: [TEAM_A, TEAM_B] })
      if (url === '/api/v1/teams/switch') {
        const { teamId } = JSON.parse(String(init?.body))
        return respond({}, teamId === 'team-b' && ++teamBWrites === 1 ? 500 : 200)
      }
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
    let switchTeam: ((teamId: string) => Promise<void>) | undefined
    function SwitchProbe() {
      switchTeam = useTeamContext().switchTeam
      return null
    }
    render(
      <QueryClientProvider client={rootQueryClient()}>
        <DashboardProviders>
          <SwitchProbe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(1))

    await act(async () => {
      await switchTeam!('team-b')
    })

    const switchedTo = fetchMock.mock.calls
      .filter(([url]) => url === '/api/v1/teams/switch')
      .map(([, init]) => JSON.parse(init.body).teamId)
    expect(switchedTo).toEqual(['team-a', 'team-b', 'team-b'])
  })

  it('a write that fails after its provider unmounted is still tried again', async () => {
    let writes = 0
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/v1/teams') return respond({ data: [TEAM_A] })
      if (url === '/api/v1/teams/switch') {
        return ++writes === 1
          ? new Promise(resolve => setTimeout(() => resolve({ ok: false, status: 500, json: async () => ({}) }), 200))
          : respond({ success: true })
      }
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
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

    // Moving to superadmin while the write is still pending
    rerender(<QueryClientProvider client={client}><div /></QueryClientProvider>)
    rerender(area('superadmin'))

    await waitFor(() => expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(2), { timeout: 3000 })
  })

  it('a new session gets its own retries after the previous one ran out of them', async () => {
    jest.useFakeTimers()
    try {
      fetchMock.mockImplementation((url: string) => {
        if (url === '/api/v1/teams') return respond({ data: [TEAM_A] })
        if (url === '/api/v1/teams/switch') return respond({}, 500)
        if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
        return respond({}, 404)
      })
      const client = rootQueryClient()
      const tree = () => (
        <QueryClientProvider client={client}>
          <DashboardProviders>
            <Probe />
          </DashboardProviders>
        </QueryClientProvider>
      )
      const advance = async (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += 250) {
          await act(async () => {
            await jest.advanceTimersByTimeAsync(250)
          })
        }
      }
      const { rerender } = render(tree())

      // The first write and its three retries, one, two and three seconds apart
      await advance(8000)
      expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(4)

      mockSessionId = 'session-2'
      rerender(tree())
      await advance(8000)

      expect(callsTo(/^\/api\/v1\/teams\/switch$/, 'POST')).toBe(8)
    } finally {
      jest.useRealTimers()
    }
  })

  it('a switch waits for the write still on the wire, so the cookie ends on the team chosen last', async () => {
    const TEAM_B = { ...TEAM_A, id: 'team-b', name: 'Team B', slug: 'team-b', joinedAt: '2026-02-01T00:00:00Z' }
    // Each switch response sets the cookie when it arrives, as Set-Cookie does
    const onTheWire: Array<() => void> = []
    let cookieTeam: string | undefined
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/teams') return respond({ data: [TEAM_A, TEAM_B] })
      if (url === '/api/v1/teams/switch') {
        const { teamId } = JSON.parse(String(init?.body))
        return new Promise(resolve => {
          onTheWire.push(() => {
            cookieTeam = teamId
            resolve({ ok: true, status: 200, json: async () => ({ success: true }) })
          })
        })
      }
      if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
      return respond({}, 404)
    })
    let switchTeam: ((teamId: string) => Promise<void>) | undefined
    function SwitchProbe() {
      switchTeam = useTeamContext().switchTeam
      return null
    }
    render(
      <QueryClientProvider client={rootQueryClient()}>
        <DashboardProviders>
          <SwitchProbe />
        </DashboardProviders>
      </QueryClientProvider>
    )
    // The write for the default team has not answered yet
    await waitFor(() => expect(onTheWire).toHaveLength(1))

    await act(async () => {
      void switchTeam!('team-b')
    })
    // A slow network answers the newest request first
    for (let round = 0; round < 10 && onTheWire.length > 0; round++) {
      await act(async () => {
        onTheWire.pop()!()
        await new Promise(resolve => setTimeout(resolve, 20))
      })
    }

    expect(onTheWire).toHaveLength(0)
    expect(cookieTeam).toBe('team-b')
  })

  it('a switch request that never answers is aborted, so the next switch still goes out', async () => {
    jest.useFakeTimers()
    try {
      const TEAM_B = { ...TEAM_A, id: 'team-b', name: 'Team B', slug: 'team-b', joinedAt: '2026-02-01T00:00:00Z' }
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/v1/teams') return respond({ data: [TEAM_A, TEAM_B] })
        if (url === '/api/v1/teams/switch') {
          if (JSON.parse(String(init?.body)).teamId === 'team-b') return respond({ success: true })
          // Never answers: only an abort ends it
          return new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
        }
        if (url.endsWith('/subscription')) return respond({ data: { subscription: null } })
        return respond({}, 404)
      })
      const switchedTo = () => fetchMock.mock.calls
        .filter(([url]) => url === '/api/v1/teams/switch')
        .map(([, init]) => JSON.parse(init.body).teamId)
      const advance = async (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += 250) {
          await act(async () => {
            await jest.advanceTimersByTimeAsync(250)
          })
        }
      }
      let switchTeam: ((teamId: string) => Promise<void>) | undefined
      function SwitchProbe() {
        switchTeam = useTeamContext().switchTeam
        return null
      }
      render(
        <QueryClientProvider client={rootQueryClient()}>
          <DashboardProviders>
            <SwitchProbe />
          </DashboardProviders>
        </QueryClientProvider>
      )
      await advance(500)
      expect(switchedTo()).toEqual(['team-a'])

      await act(async () => {
        void switchTeam!('team-b')
      })
      await advance(11000)

      expect(switchedTo()).toEqual(['team-a', 'team-b'])
    } finally {
      jest.useRealTimers()
    }
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
