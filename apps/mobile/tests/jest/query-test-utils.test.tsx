import {
  cleanupTestQueryClients,
  createTestQueryClient,
  getTrackedQueryClientCount,
} from './query-test-utils'

describe('query test utilities', () => {
  it('disables retries and garbage-collection timers', () => {
    const queryClient = createTestQueryClient()
    const defaults = queryClient.getDefaultOptions()

    expect(defaults.queries).toMatchObject({
      retry: false,
      gcTime: Infinity,
    })
    expect(defaults.mutations).toMatchObject({
      retry: false,
      gcTime: Infinity,
    })
  })

  it('clears tracked query and mutation caches', () => {
    const queryClient = createTestQueryClient()

    queryClient.setQueryData(['test-query'], { id: 'query' })
    queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['test-mutation'],
      mutationFn: async () => ({ id: 'mutation' }),
    })

    expect(getTrackedQueryClientCount()).toBe(1)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)

    cleanupTestQueryClients()

    expect(getTrackedQueryClientCount()).toBe(0)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })
})
