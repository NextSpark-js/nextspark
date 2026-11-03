/**
 * @jest-environment jsdom
 *
 * useQuotaCheck gates a create form on a quota. check-action refuses an action no mapping names with
 * `unknown_action` (#367); there is no quota to exceed for it, so the gate lets it through.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockFetchWithTeam = jest.fn()
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: (...args: unknown[]) => mockFetchWithTeam(...args) }))

import { useQuotaCheck } from '@/core/hooks/useQuotaCheck'

const run = async (data: unknown) => {
  mockFetchWithTeam.mockResolvedValue({ json: async () => ({ success: true, data }) })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useQuotaCheck('tasks.create'), { wrapper })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  return result.current
}

test('unknown_action leaves the gate open', async () => {
  const result = await run({ allowed: false, reason: 'unknown_action', message: 'x' })
  expect(result.canCreate).toBe(true)
})

test('a quota that is exceeded closes it', async () => {
  const result = await run({ allowed: false, reason: 'quota_exceeded' })
  expect(result.canCreate).toBe(false)
  expect(result.isQuotaExceeded).toBe(true)
})
