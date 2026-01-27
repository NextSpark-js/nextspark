/**
 * Tests for entities/customers/queries.ts
 * TanStack Query hooks for fetching customers
 */

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer } from '@/entities/customers/types'
import type { PaginatedResponse, SingleResponse } from '@/api/client.types'

// Import the mock from our __mocks__ folder
import { mockCustomersApi } from '../../__mocks__/entities-customers-api'

// Mock the module with the imported mock
jest.mock('@/entities/customers/api', () => require('../../__mocks__/entities-customers-api'))

// Import after mocks
import { useCustomers, useCustomer, CUSTOMERS_QUERY_KEY } from '@/entities/customers/queries'

// Test data
const testCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Customer One',
    account: 11111,
    office: 'Office A',
    phone: '555-1111',
    salesRep: 'Rep 1',
    visitDays: ['lun', 'mie'],
    contactDays: ['mar'],
    teamId: 'team-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cust-2',
    name: 'Customer Two',
    account: 22222,
    office: 'Office B',
    phone: '555-2222',
    salesRep: 'Rep 2',
    visitDays: ['vie'],
    contactDays: ['jue'],
    teamId: 'team-1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
]

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('Customer queries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CUSTOMERS_QUERY_KEY', () => {
    it('should be correct value', () => {
      expect(CUSTOMERS_QUERY_KEY).toEqual(['customers'])
    })
  })

  describe('useCustomers', () => {
    it('should fetch customers list', async () => {
      const response: PaginatedResponse<Customer> = {
        data: testCustomers,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      }
      mockCustomersApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCustomers(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCustomersApi.list).toHaveBeenCalled()
      expect(result.current.data?.data).toHaveLength(2)
    })

    it('should pass filter parameters', async () => {
      const response: PaginatedResponse<Customer> = {
        data: [testCustomers[0]],
        meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
      }
      mockCustomersApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(
        () => useCustomers({ page: 2, limit: 10 }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCustomersApi.list).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: undefined,
      })
    })

    it('should pass search parameter', async () => {
      const response: PaginatedResponse<Customer> = {
        data: testCustomers,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      }
      mockCustomersApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(
        () => useCustomers({ search: 'test search' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCustomersApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test search' })
      )
    })

    it('should not fetch when disabled', async () => {
      renderHook(
        () => useCustomers({ enabled: false }),
        { wrapper: createWrapper() }
      )

      // Give it time to potentially fetch (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockCustomersApi.list).not.toHaveBeenCalled()
    })

    it('should handle error state', async () => {
      const error = new Error('Failed to fetch customers')
      mockCustomersApi.list.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useCustomers(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })

  describe('useCustomer', () => {
    it('should fetch single customer by id', async () => {
      const response: SingleResponse<Customer> = { data: testCustomers[0] }
      mockCustomersApi.get.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCustomer('cust-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCustomersApi.get).toHaveBeenCalledWith('cust-1')
      expect(result.current.data?.data.id).toBe('cust-1')
      expect(result.current.data?.data.name).toBe('Customer One')
    })

    it('should not fetch if id is undefined', async () => {
      renderHook(() => useCustomer(undefined), {
        wrapper: createWrapper(),
      })

      // Give it time to potentially fetch (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockCustomersApi.get).not.toHaveBeenCalled()
    })

    it('should handle error for single customer', async () => {
      const error = new Error('Customer not found')
      mockCustomersApi.get.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useCustomer('non-existent'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })
})
