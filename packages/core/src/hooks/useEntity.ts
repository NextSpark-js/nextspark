/**
 * Universal Entity Data Hook
 *
 * Provides CRUD operations for any entity based on configuration.
 * Now powered by TanStack Query for:
 * - Automatic caching (5min stale, 1hr gc)
 * - Request deduplication
 * - Optimistic updates
 * - Parallel fetching
 * - Background refetch
 */

'use client'

import { useState, useCallback } from 'react'
import { useEntityQuery } from './useEntityQuery'
import { useEntityMutations } from './useEntityMutations'
import type { EntityConfig } from '../lib/entities/types'

export interface UseEntityOptions {
  entityConfig: EntityConfig
  enableRealtime?: boolean
  enableCache?: boolean
  pageSize?: number
  includeChildren?: boolean
  autoFetch?: boolean
}

export interface EntityHookResult {
  // Data
  items: Record<string, unknown>[]
  item: Record<string, unknown> | null
  childData: Record<string, unknown>

  // Loading states
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean

  // Error states
  error: string | null
  validationErrors: Record<string, string>

  // Pagination
  currentPage: number
  totalPages: number
  totalItems: number

  // Search & filtering
  searchQuery: string
  filters: Record<string, unknown>
  sort: { field: string; direction: 'asc' | 'desc' } | null

  // Permissions
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean

  // CRUD operations
  fetchAll: (options?: { page?: number; search?: string; filters?: Record<string, unknown> }) => Promise<void>
  fetchOne: (id: string) => Promise<void>
  create: (data: Record<string, unknown>) => Promise<unknown>
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>
  delete: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>

  // Search & filtering
  setSearchQuery: (query: string) => void
  setFilters: (filters: Record<string, unknown>) => void
  setSort: (field: string, direction: 'asc' | 'desc') => void

  // Child entity operations
  createChild: () => Promise<void>
  updateChild: () => Promise<void>
  deleteChild: () => Promise<void>

  // Utility
  refresh: () => Promise<void>
  reset: () => void
}

/**
 * useEntity - TanStack Query powered entity hook
 *
 * Provides complete entity management with automatic caching and optimizations
 */
export function useEntity(options: UseEntityOptions): EntityHookResult {
  const {
    entityConfig,
    pageSize = 10,
    includeChildren = false,
    autoFetch = true,
  } = options

  // Search & filtering state (local, not in query key for better UX)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown>>({})
  const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Validation errors (for form feedback)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Query for fetching data
  const {
    items,
    total,
    totalPages,
    isLoading,
    error: queryError,
    refetch,
  } = useEntityQuery({
    entityConfig,
    pageSize,
    includeChildren,
    search: searchQuery,
    filters,
    sort: sort || undefined,
    enabled: autoFetch,
  })

  // Mutations for CRUD operations
  const {
    create,
    update,
    delete: deleteItem,
    bulkDelete,
    isCreating,
    isUpdating,
    isDeleting,
  } = useEntityMutations({
    entityConfig,
    onError: (error) => {
      // Handle validation errors
      if (error.message === 'Validation failed') {
        // Extract validation errors from error object if available
        setValidationErrors({})
      }
    },
  })

  // Permissions (simplified - all authenticated users can perform all operations)
  const canCreate = true
  const canRead = true
  const canUpdate = true
  const canDelete = true

  // Search & filtering handlers
  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page on search
  }, [])

  const handleSetFilters = useCallback((newFilters: Record<string, unknown>) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleSetSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSort({ field, direction })
  }, [])

  // CRUD operation wrappers with error handling
  const handleCreate = useCallback(
    async (data: Record<string, unknown>) => {
      setValidationErrors({})
      try {
        const result = await create(data)
        return result
      } catch (error) {
        throw error
      }
    },
    [create]
  )

  const handleUpdate = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setValidationErrors({})
      try {
        const result = await update({ id, data })
        return result
      } catch (error) {
        throw error
      }
    },
    [update]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteItem(id)
      } catch (error) {
        throw error
      }
    },
    [deleteItem]
  )

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      try {
        await bulkDelete(ids)
      } catch (error) {
        throw error
      }
    },
    [bulkDelete]
  )

  // Utility functions
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const reset = useCallback(() => {
    setSearchQuery('')
    setFilters({})
    setSort(null)
    setCurrentPage(1)
    setValidationErrors({})
  }, [])

  // Fetch single item (not implemented in this version - use useEntityOne separately)
  const fetchOne = useCallback(async (id: string) => {
    console.warn('fetchOne not implemented in useEntity, use useEntityOne hook instead')
  }, [])

  // Fetch all (refetch)
  const fetchAll = useCallback(
    async (options: { page?: number; search?: string; filters?: Record<string, unknown> } = {}) => {
      if (options.page) setCurrentPage(options.page)
      if (options.search !== undefined) setSearchQuery(options.search)
      if (options.filters) setFilters(options.filters)
      await refetch()
    },
    [refetch]
  )

  // Child entity operations (not implemented - would need separate hooks)
  const createChild = useCallback(async () => {
    console.warn('Child operations not implemented in useEntity')
  }, [])
  const updateChild = useCallback(async () => {
    console.warn('Child operations not implemented in useEntity')
  }, [])
  const deleteChild = useCallback(async () => {
    console.warn('Child operations not implemented in useEntity')
  }, [])

  return {
    // Data
    items,
    item: null, // Not implemented in list hook
    childData: {}, // Not implemented in list hook

    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,

    // Error states
    error: queryError?.message || null,
    validationErrors,

    // Pagination
    currentPage,
    totalPages,
    totalItems: total,

    // Search & filtering
    searchQuery,
    filters,
    sort,

    // Permissions
    canCreate,
    canRead,
    canUpdate,
    canDelete,

    // CRUD operations
    fetchAll,
    fetchOne,
    create: handleCreate,
    update: handleUpdate,
    delete: handleDelete,
    bulkDelete: handleBulkDelete,

    // Search & filtering
    setSearchQuery: handleSetSearchQuery,
    setFilters: handleSetFilters,
    setSort: handleSetSort,

    // Child entity operations
    createChild,
    updateChild,
    deleteChild,

    // Utility
    refresh,
    reset,
  }
}
