import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClients = new Set<QueryClient>()

export function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
      },
    },
  })

  queryClients.add(queryClient)
  return queryClient
}

export function createQueryWrapper(queryClient = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

export function cleanupTestQueryClients() {
  queryClients.forEach((queryClient) => queryClient.clear())
  queryClients.clear()
}

export function getTrackedQueryClientCount() {
  return queryClients.size
}
