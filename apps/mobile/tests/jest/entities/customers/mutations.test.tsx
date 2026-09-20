/**
 * Tests for entities/customers/mutations.ts
 * TanStack Query mutation hooks for customers
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/entities/customers/types'
import { createQueryWrapper, createTestQueryClient } from '../../query-test-utils'

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
import { CUSTOMERS_QUERY_KEY } from '@/entities/customers/queries'

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

// customersApi comes from createEntityApi, which resolves create/update with
// the entity itself (it unwraps the API's { data } envelope).
describe('Customer mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useCreateCustomer', () => {
    it('should call customersApi.create with data', async () => {
      mockCustomersApi.create.mockResolvedValueOnce({ ...testCustomer, ...createInput, id: 'cust-new' })

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createQueryWrapper(),
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
      mockCustomersApi.create.mockResolvedValueOnce(createdCustomer)

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createQueryWrapper(),
      })

      let mutationResult: Customer | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync(createInput)
      })

      expect(mutationResult?.name).toBe('New Customer')
      expect(mutationResult?.account).toBe(67890)
    })

    it('should handle error correctly', async () => {
      const error = new Error('Create failed')
      mockCustomersApi.create.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useCreateCustomer(), {
        wrapper: createQueryWrapper(),
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
      mockCustomersApi.update.mockResolvedValueOnce({ ...testCustomer, ...updateInput })

      const { result } = renderHook(() => useUpdateCustomer(), {
        wrapper: createQueryWrapper(),
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
      mockCustomersApi.update.mockResolvedValueOnce(updatedCustomer)

      const { result } = renderHook(() => useUpdateCustomer(), {
        wrapper: createQueryWrapper(),
      })

      let mutationResult: Customer | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync({ id: 'cust-1', data: updateInput })
      })

      expect(mutationResult?.name).toBe('Updated Customer')
      expect(mutationResult?.phone).toBe('555-9999')
    })

    it('should cache the updated customer under its id', async () => {
      const updatedCustomer: Customer = { ...testCustomer, ...updateInput }
      mockCustomersApi.update.mockResolvedValueOnce(updatedCustomer)
      const queryClient = createTestQueryClient()

      const { result } = renderHook(() => useUpdateCustomer(), {
        wrapper: createQueryWrapper(queryClient),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'cust-1', data: updateInput })
      })

      expect(queryClient.getQueryData([...CUSTOMERS_QUERY_KEY, 'cust-1'])).toEqual(updatedCustomer)
    })
  })

  describe('useDeleteCustomer', () => {
    it('should call customersApi.delete with id', async () => {
      mockCustomersApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteCustomer(), {
        wrapper: createQueryWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('cust-1')
      })

      expect(mockCustomersApi.delete).toHaveBeenCalledWith('cust-1')
    })

    it('should handle delete success', async () => {
      mockCustomersApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteCustomer(), {
        wrapper: createQueryWrapper(),
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
        wrapper: createQueryWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync('cust-1')
        })
      ).rejects.toThrow('Delete failed')
    })
  })
})
