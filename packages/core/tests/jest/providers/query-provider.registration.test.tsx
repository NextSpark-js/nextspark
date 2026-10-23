/**
 * QueryProvider (#341) registers its cache with lib/auth/query-caches, which is how a sign-in empties it now that
 * useAuth does not import React Query: whatever the previous user left in the cache must not reach the next one.
 */
import { render } from '@testing-library/react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { QueryProvider } from '@/core/providers/query-provider'
import { clearQueryCaches } from '@/core/lib/auth/query-caches'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

let client: QueryClient | undefined

function Probe() {
  client = useQueryClient()
  return <p>page</p>
}

beforeEach(() => {
  client = undefined
})

describe('QueryProvider and the sign-in flows', () => {
  it('has its cache emptied by clearQueryCaches while it is mounted', () => {
    render(<QueryProvider><Probe /></QueryProvider>)
    client!.setQueryData(['user-teams', 'user-a'], [{ team: { id: 'team-a' } }])
    expect(client!.getQueryCache().getAll()).toHaveLength(1)

    clearQueryCaches()

    expect(client!.getQueryCache().getAll()).toHaveLength(0)
  })

  it('empties the cache of every provider on the page, mounted anywhere', () => {
    const clients: QueryClient[] = []
    function Collect() {
      clients.push(useQueryClient())
      return null
    }
    render(<><QueryProvider><Collect /></QueryProvider><QueryProvider><Collect /></QueryProvider></>)
    clients.forEach(each => each.setQueryData(['user-teams'], ['a']))

    clearQueryCaches()

    expect(clients).toHaveLength(2)
    clients.forEach(each => expect(each.getQueryCache().getAll()).toHaveLength(0))
  })

  it('leaves a cache alone once its provider is gone', () => {
    const { unmount } = render(<QueryProvider><Probe /></QueryProvider>)
    const gone = client!
    gone.setQueryData(['user-teams'], ['a'])
    unmount()

    clearQueryCaches()

    expect(gone.getQueryCache().getAll()).toHaveLength(1)
  })
})
