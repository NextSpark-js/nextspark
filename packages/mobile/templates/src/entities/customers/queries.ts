/**
 * TanStack Query hooks for Customers
 */

import { useQuery } from '@tanstack/react-query'
import { customersApi } from './api'
import { CUSTOMERS_QUERY_KEY } from './constants.internal'

export { CUSTOMERS_QUERY_KEY }

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
    queryFn: () => customersApi.list({ page, limit, search }),
    enabled,
  })
}

/**
 * Hook to fetch a single customer by ID
 */
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, id],
    queryFn: () => customersApi.get(id!),
    enabled: !!id,
  })
}
