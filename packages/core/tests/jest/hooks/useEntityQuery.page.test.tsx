/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const mockFetch = jest.fn<(url: string) => Promise<Response>>()
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: (url: string) => mockFetch(url) }))

import { useEntityQuery } from '@/core/hooks/useEntityQuery'

const entityConfig = { slug: 'tasks', names: { plural: 'tasks', singular: 'task' } } as never

const respond = (url: string) => {
  const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? 1)
  return Promise.resolve(new Response(JSON.stringify({ items: [{ id: `p${page}` }], total: 25 })))
}

function setup(initial: { page?: number }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    (props: { page?: number }) => useEntityQuery({ entityConfig, ...props }),
    { wrapper, initialProps: initial },
  )
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockImplementation(respond)
})

describe('useEntityQuery page option', () => {
  test('without page the request is unchanged (no page param)', async () => {
    const { result } = setup({})
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }]))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks?limit=10')
    expect(result.current.data?.page).toBe(1)
  })

  test('page N sends the page param and returns that page', async () => {
    const { result } = setup({ page: 2 })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p2' }]))
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks?limit=10&page=2')
    expect(result.current.data?.page).toBe(2)
  })

  test('keeps previous data while the next page loads and caches each page', async () => {
    const { result, rerender } = setup({ page: 1 })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }]))

    let release!: () => void
    mockFetch.mockImplementationOnce((url) => new Promise((resolve) => { release = () => resolve(respond(url)) }))
    rerender({ page: 2 })
    expect(result.current.items).toEqual([{ id: 'p1' }])
    expect(result.current.isPlaceholderData).toBe(true)
    release()
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p2' }]))

    rerender({ page: 1 })
    expect(result.current.items).toEqual([{ id: 'p1' }])
    expect(result.current.isPlaceholderData).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
