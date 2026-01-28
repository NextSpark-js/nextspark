/**
 * TanStack Query mutations for Customers
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from './api'
import { CUSTOMERS_QUERY_KEY } from './constants.internal'
import type { CreateCustomerInput, UpdateCustomerInput } from './types'

/**
 * Hook to create a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCustomerInput) => customersApi.create(data),
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
      customersApi.update(id, data),
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
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: [...CUSTOMERS_QUERY_KEY, deletedId] })
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}
