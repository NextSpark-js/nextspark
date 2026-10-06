/**
 * useAuth — cached queries belong to whoever was signed in.
 *
 * The root layout's query client outlives the dashboard, so signing in or out
 * empties it; otherwise the next user on the same page would see the previous
 * one's teams until they refetched.
 *
 * Signing out must also bring the client's session store up to date BEFORE it empties the cache: the store keeps the
 * user until its own request answers, so a signed-in query still on the page (teams, profile) would refetch the
 * moment the cache is emptied and the API would answer it with 401.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockSignInEmail = jest.fn()
const mockSignOut = jest.fn()
const mockSessionRefetch = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }),
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args), emailOtp: jest.fn() },
    signOut: (...args: unknown[]) => mockSignOut(...args),
    $store: { atoms: { session: { get: () => ({ refetch: () => mockSessionRefetch() }) } } },
  },
}))

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ saveAuthMethod: jest.fn() }),
}))

import { useAuth } from '@/core/hooks/useAuth'

function withCachedTeams() {
  const client = new QueryClient()
  client.setQueryData(['user-teams', 'user-a'], [{ team: { id: 'team-a', name: 'Secret A' } }])
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

beforeEach(() => {
  mockSignInEmail.mockReset().mockResolvedValue({ data: { user: { id: 'user-b' } }, error: null })
  mockSignOut.mockReset().mockResolvedValue({ data: { success: true }, error: null })
  mockSessionRefetch.mockReset().mockResolvedValue(undefined)
})

describe('useAuth and the query cache', () => {
  test('signing in drops what the previous user left in the cache', async () => {
    const { client, wrapper } = withCachedTeams()
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signIn({ email: 'b@example.com', password: 'secret-1234' })
    })

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  test('signing out drops it too', async () => {
    const { client, wrapper } = withCachedTeams()
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signOut()
    })

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  test('signing out refreshes the session store first, while the cache still holds what the signed-in queries read', async () => {
    const { client, wrapper } = withCachedTeams()
    const order: string[] = []
    mockSignOut.mockImplementation(async () => { order.push('sign-out'); return { data: { success: true }, error: null } })
    // answers on a later tick, as the real request does, and records what the cache held when it did
    mockSessionRefetch.mockImplementation(() => new Promise<void>(resolve => setTimeout(() => { order.push(`session answered (cache: ${client.getQueryCache().getAll().length})`); resolve() }, 20)))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signOut()
    })

    expect(order).toEqual(['sign-out', 'session answered (cache: 1)'])
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  test('a session request that never answers does not hold the redirect back for more than a couple of seconds', async () => {
    const { client, wrapper } = withCachedTeams()
    mockSessionRefetch.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAuth(), { wrapper })
    const started = Date.now()

    await act(async () => {
      await result.current.signOut()
    })

    expect(Date.now() - started).toBeLessThan(4000)
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  test('a session store that cannot be refreshed does not stop the sign-out', async () => {
    const { client, wrapper } = withCachedTeams()
    mockSessionRefetch.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.signOut()
    })

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  test('without a query client, signing in still works', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signIn({ email: 'b@example.com', password: 'secret-1234' })
    })

    expect(mockSignInEmail).toHaveBeenCalledTimes(1)
  })
})
