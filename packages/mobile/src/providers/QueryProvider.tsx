/**
 * TanStack Query Provider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DefaultOptions } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'

const baseDefaultOptions: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
}

const queryClient = new QueryClient({ defaultOptions: baseDefaultOptions })

interface QueryProviderProps {
  children: ReactNode
  /** Use this client instead of the shared one. `defaultOptions` is then ignored. */
  client?: QueryClient
  /** Merged (queries and mutations separately) over the defaults when no `client` is passed. */
  defaultOptions?: DefaultOptions
}

export function QueryProvider({ children, client, defaultOptions }: QueryProviderProps) {
  // Created once per mounted provider; without props the shared client is used.
  const [own] = useState(() =>
    !client && defaultOptions
      ? new QueryClient({
          defaultOptions: {
            ...baseDefaultOptions,
            ...defaultOptions,
            queries: { ...baseDefaultOptions.queries, ...defaultOptions.queries },
            mutations: { ...baseDefaultOptions.mutations, ...defaultOptions.mutations },
          },
        })
      : undefined,
  )

  return (
    <QueryClientProvider client={client ?? own ?? queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export { queryClient }
