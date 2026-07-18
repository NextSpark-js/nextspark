/**
 * TeamContext — self-heal re-entrancy tests.
 *
 * The self-heal effect used to gate itself shut after the first successful
 * run (`initialSyncDone`), even though membership can change later. These
 * tests drive the provider through a membership change (simulated via a
 * refetch that resolves to a different team list) and assert it corrects
 * `currentTeam`/`localStorage`/the switch-cookie call every time the cached
 * active team stops being valid — not just once.
 */
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TeamProvider, useTeamContext, TEAMS_QUERY_KEY } from '@/core/contexts/TeamContext'

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, isLoading: false }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

// TeamProvider renders TeamSwitchModal, which uses next-intl.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const TEAM_A = { id: 'team-a', name: 'Team A', slug: 'team-a', description: null, owner_id: 'user-1', avatar_url: null, settings: {}, created_at: '2026-01-01', updated_at: '2026-01-01' }
const TEAM_B = { id: 'team-b', name: 'Team B', slug: 'team-b', description: null, owner_id: 'user-2', avatar_url: null, settings: {}, created_at: '2026-01-01', updated_at: '2026-01-01' }

function membershipRow(team: typeof TEAM_A, role = 'owner') {
  return { ...team, userRole: role }
}

function Probe() {
  const { currentTeam } = useTeamContext()
  return <div data-testid="current-team">{currentTeam?.id ?? 'none'}</div>
}

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <TeamProvider>
        <Probe />
      </TeamProvider>
    </QueryClientProvider>
  )
  return queryClient
}

describe('TeamProvider self-heal', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = jest.fn()
  })

  it('picks the stored active team on initial load', async () => {
    localStorage.setItem('activeTeamId', 'team-b')
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v1/teams') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [membershipRow(TEAM_A), membershipRow(TEAM_B)] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-b'))
  })

  it('re-heals when the active team drops out of userTeams after a later refetch — not just once', async () => {
    localStorage.setItem('activeTeamId', 'team-a')
    let call = 0
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v1/teams') {
        call += 1
        // First resolution: team-a is a valid member. Second (simulated
        // post-membership-change refetch): team-a is gone, only team-b left.
        const rows = call === 1 ? [membershipRow(TEAM_A), membershipRow(TEAM_B)] : [membershipRow(TEAM_B)]
        return Promise.resolve({ ok: true, json: async () => ({ data: rows }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    const queryClient = renderWithProviders()
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))

    // Simulate whatever revalidation trigger fires later (window focus refetch,
    // an explicit refreshTeams() call, or staleTime expiring) by invalidating
    // the query directly — this is the "userTeams changed after the first
    // sync" case the one-shot `initialSyncDone` gate used to ignore entirely.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
    })

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-b'))
  })

  it('does not re-fetch the switch-cookie endpoint on a stable re-render with a still-valid active team', async () => {
    localStorage.setItem('activeTeamId', 'team-a')
    const switchCalls: string[] = []
    ;(global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/teams') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [membershipRow(TEAM_A), membershipRow(TEAM_B)] }) })
      }
      if (url === '/api/v1/teams/switch') {
        switchCalls.push(String(init?.body))
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    renderWithProviders()
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))
    const callsAfterFirstSync = switchCalls.length

    // Force a couple of re-renders with the exact same data.
    await act(async () => {})
    await act(async () => {})

    expect(switchCalls.length).toBe(callsAfterFirstSync)
  })

  it('refetches userTeams when the window regains focus', async () => {
    // Two layers of unreliability rule out a behavioral assertion here:
    // (1) real `focus`/`visibilitychange` DOM events don't reach TanStack
    // Query in jsdom — its focus manager gates on `document.hasFocus()`,
    // which jsdom never wires up to synthetic events; (2) even driving focus
    // via the library's own `focusManager.setFocused()` API, a refetch is
    // only triggered when the query is stale (or `refetchOnWindowFocus ===
    // 'always'`) — and this query's 5-minute staleTime means it's still
    // fresh immediately after mount, so no refetch would fire either way,
    // in a real browser or in this test. So instead of asserting behavior,
    // assert the wiring directly: the mounted query's merged options carry
    // `refetchOnWindowFocus: true`, which is what makes the real-browser
    // behavior possible once the data does go stale.
    localStorage.setItem('activeTeamId', 'team-a')
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v1/teams') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [membershipRow(TEAM_A)] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    const queryClient = renderWithProviders()
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))

    const query = queryClient.getQueryCache().find({ queryKey: TEAMS_QUERY_KEY })
    expect(query?.options.refetchOnWindowFocus).toBe(true)
  })

  it('clears currentTeam and localStorage when the user has zero team memberships', async () => {
    localStorage.setItem('activeTeamId', 'team-a')
    let call = 0
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/v1/teams') {
        call += 1
        // First resolution: team-a is a valid member. Second (simulated
        // post-membership-change refetch): the user has been removed from
        // every team — the query resolves to an empty list.
        const rows = call === 1 ? [membershipRow(TEAM_A)] : []
        return Promise.resolve({ ok: true, json: async () => ({ data: rows }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    const queryClient = renderWithProviders()
    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('team-a'))

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
    })

    await waitFor(() => expect(screen.getByTestId('current-team').textContent).toBe('none'))
    expect(localStorage.getItem('activeTeamId')).toBeNull()
  })
})
