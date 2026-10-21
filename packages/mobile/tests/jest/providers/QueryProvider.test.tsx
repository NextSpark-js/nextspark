import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { QueryProvider, queryClient } from '../../../src/providers/QueryProvider'

function capture() {
  let seen: QueryClient | undefined
  const Probe = () => {
    seen = useQueryClient()
    return null
  }
  return { Probe, get: () => seen as QueryClient }
}

describe('QueryProvider', () => {
  it('provides an injected client', () => {
    const injected = new QueryClient()
    const { Probe, get } = capture()
    render(<QueryProvider client={injected}><Probe /></QueryProvider>)
    expect(get()).toBe(injected)
  })

  it('merges defaultOptions over the defaults when no client is injected', () => {
    const { Probe, get } = capture()
    render(
      <QueryProvider defaultOptions={{ queries: { retry: 3 }, mutations: { retry: 2 } }}>
        <Probe />
      </QueryProvider>,
    )
    const defaults = get().getDefaultOptions()
    expect(get()).not.toBe(queryClient)
    expect(defaults.queries).toEqual({ staleTime: 300000, retry: 3, refetchOnWindowFocus: false })
    expect(defaults.mutations).toEqual({ retry: 2 })
  })

  it('without props provides the shared client with the current defaults', () => {
    const { Probe, get } = capture()
    render(<QueryProvider><Probe /></QueryProvider>)
    expect(get()).toBe(queryClient)
    expect(get().getDefaultOptions()).toEqual({
      queries: { staleTime: 300000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    })
  })
})
