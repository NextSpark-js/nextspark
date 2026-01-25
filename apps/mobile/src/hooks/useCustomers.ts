/**
 * TanStack Query hooks for Customers CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '../types'

const CUSTOMERS_QUERY_KEY = ['customers']

interface UseCustomersOptions {
  page?: number
  limit?: number
  search?: string
  enabled?: boolean
}

/**
 * Hook to fetch paginated customers list
 */
export function useCustomers(options: UseCustomersOptions = {}) {
  const { page = 1, limit = 20, search, enabled = true } = options

  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, { page, limit, search }],
    queryFn: () => apiClient.listCustomers({ page, limit, search }),
    enabled,
  })
}

/**
 * Hook to fetch a single customer by ID
 */
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, id],
    queryFn: () => apiClient.getCustomer(id!),
    enabled: !!id,
  })
}

/**
 * Hook to create a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCustomerInput) => apiClient.createCustomer(data),
    onSuccess: () => {
      // Invalidate customers list to refetch
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}

/**
 * Hook to update an existing customer
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInput }) =>
      apiClient.updateCustomer(id, data),
    onSuccess: (response) => {
      // Update the specific customer in cache
      queryClient.setQueryData([...CUSTOMERS_QUERY_KEY, response.data.id], response)
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}

/**
 * Hook to delete a customer
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteCustomer(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: [...CUSTOMERS_QUERY_KEY, deletedId] })
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}
