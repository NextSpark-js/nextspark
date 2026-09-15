/**
 * useAuth — cached queries belong to whoever was signed in.
 *
 * The root layout's query client outlives the dashboard, so signing in or out
 * empties it; otherwise the next user on the same page would see the previous
 * one's teams until they refetched.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockSignInEmail = jest.fn()
const mockSignOut = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }),
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args), emailOtp: jest.fn() },
    signOut: (...args: unknown[]) => mockSignOut(...args),
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

  test('without a query client, signing in still works', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signIn({ email: 'b@example.com', password: 'secret-1234' })
    })

    expect(mockSignInEmail).toHaveBeenCalledTimes(1)
  })
})
