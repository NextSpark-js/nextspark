/**
 * Tests for entities/customers/mutations.ts
 * TanStack Query mutation hooks for customers
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/entities/customers/types'
import type { SingleResponse } from '@/api/client.types'

// Import the mock from our __mocks__ folder
import { mockCustomersApi } from '../../__mocks__/entities-customers-api'

// Mock the module with the imported mock
jest.mock('@/entities/customers/api', () => require('../../__mocks__/entities-customers-api'))

// Import after mocks
import {
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '@/entities/customers/mutations'

// Test data matching actual Customer type
const testCustomer: Customer = {
  id: 'cust-1',
  name: 'Test Customer',
  account: 12345,
  office: 'Main Office',
  phone: '555-1234',
  salesRep: 'John Doe',
  visitDays: ['lun', 'mie'],
  contactDays: ['mar', 'jue'],
  teamId: 'team-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const createInput: CreateCustomerInput = {
  name: 'New Customer',
  account: 67890,
  office: 'Branch Office',
  phone: '555-5678',
  visitDays: ['vie'],
}

const updateInput: UpdateCustomerInput = {
  name: 'Updated Customer',
  phone: '555-9999',
}

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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

describe('Customer mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useCreateCustomer', () => {
    it('should call customersApi.create with data', async () => {
      const response: SingleResponse<Customer> = {
        data: { ...testCustomer, ...createInput, id: 'cust-new' },
      }
      mockCustomersApi.create.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync(createInput)
      })

      expect(mockCustomersApi.create).toHaveBeenCalledWith(createInput)
    })

    it('should return created customer on success', async () => {
      const createdCustomer: Customer = {
        ...testCustomer,
        id: 'cust-new',
        name: 'New Customer',
        account: 67890,
      }
      const response: SingleResponse<Customer> = { data: createdCustomer }
      mockCustomersApi.create.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createWrapper(),
      })

      let mutationResult: SingleResponse<Customer> | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync(createInput)
      })

      expect(mutationResult?.data.name).toBe('New Customer')
      expect(mutationResult?.data.account).toBe(67890)
    })

    it('should handle error correctly', async () => {
      const error = new Error('Create failed')
      mockCustomersApi.create.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync(createInput)
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('useUpdateCustomer', () => {
    it('should call customersApi.update with id and data', async () => {
      const updatedCustomer: Customer = { ...testCustomer, ...updateInput }
      const response: SingleResponse<Customer> = { data: updatedCustomer }
      mockCustomersApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateCustomer(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'cust-1', data: updateInput })
      })

      expect(mockCustomersApi.update).toHaveBeenCalledWith('cust-1', updateInput)
    })

    it('should return updated customer on success', async () => {
      const updatedCustomer: Customer = {
        ...testCustomer,
        name: 'Updated Customer',
        phone: '555-9999',
      }
      const response: SingleResponse<Customer> = { data: updatedCustomer }
      mockCustomersApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateCustomer(), {
        wrapper: createWrapper(),
      })

      let mutationResult: SingleResponse<Customer> | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync({ id: 'cust-1', data: updateInput })
      })

      expect(mutationResult?.data.name).toBe('Updated Customer')
      expect(mutationResult?.data.phone).toBe('555-9999')
    })
  })

  describe('useDeleteCustomer', () => {
    it('should call customersApi.delete with id', async () => {
      mockCustomersApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteCustomer(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('cust-1')
      })

      expect(mockCustomersApi.delete).toHaveBeenCalledWith('cust-1')
    })

    it('should handle delete success', async () => {
      mockCustomersApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteCustomer(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('cust-1')
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('should handle delete error', async () => {
      const error = new Error('Delete failed')
      mockCustomersApi.delete.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useDeleteCustomer(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync('cust-1')
        })
      ).rejects.toThrow('Delete failed')
    })
  })
})
