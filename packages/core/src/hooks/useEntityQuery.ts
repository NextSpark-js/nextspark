'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import type { EntityConfig } from '../lib/entities/types'

export interface UseEntityQueryOptions {
  entityConfig: EntityConfig
  pageSize?: number
  includeChildren?: boolean
  search?: string
  filters?: Record<string, unknown>
  sort?: { field: string; direction: 'asc' | 'desc' }
  enabled?: boolean
  staleTime?: number
  gcTime?: number
}

export interface EntityQueryResult {
  items: Record<string, unknown>[]
  total: number
  page: number
  totalPages: number
}

export function useEntityQuery(options: UseEntityQueryOptions) {
  const {
    entityConfig,
    pageSize = 10,
    includeChildren = false,
    search = '',
    filters = {},
    sort = null,
    enabled = true,
    staleTime = 1000 * 60 * 5, // 5 minutes default
    gcTime = 1000 * 60 * 60,    // 1 hour default
  } = options

  const { user } = useAuth()

  // Build query key with all params for proper cache invalidation
  const queryKey = [
    'entity',
    entityConfig.slug,
    {
      pageSize,
      includeChildren,
      search,
      filters,
      sort,
    },
  ]

  const query = useQuery<EntityQueryResult>({
    queryKey,
    queryFn: async () => {
      const queryParams: Record<string, string> = {
        limit: String(pageSize),
      }

      if (search) queryParams.search = search
      if (includeChildren) queryParams.child = 'all'
      if (sort) {
        queryParams.sortBy = sort.field
        queryParams.sortOrder = sort.direction
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value)
        }
      })

      const params = new URLSearchParams(queryParams)
      const url = `/api/v1/${entityConfig.slug}?${params.toString()}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityConfig.names.plural}`)
      }

      const data = await response.json()

      return {
        items: data.items || data.data || data[entityConfig.slug] || [],
        total: data.total || data.info?.total || 0,
        page: data.page || 1,
        totalPages: Math.ceil((data.total || 0) / pageSize),
      }
    },
    enabled: enabled && !!user,
    staleTime,
    gcTime,
  })

  return {
    ...query,
    items: query.data?.items || [],
    total: query.data?.total || 0,
    totalPages: query.data?.totalPages || 1,
  }
}

// Hook for single entity
export function useEntityOne(
  entityConfig: EntityConfig,
  id: string,
  options: { includeChildren?: boolean; enabled?: boolean } = {}
) {
  const { user } = useAuth()
  const { includeChildren = false, enabled = true } = options

  const queryKey = ['entity', entityConfig.slug, id, { includeChildren }]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = includeChildren ? '?child=all' : ''
      const url = `/api/v1/${entityConfig.slug}/${id}${params}`

      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`${entityConfig.names.singular} not found`)
        }
        throw new Error(`Failed to fetch ${entityConfig.names.singular}`)
      }

      const data = await response.json()
      return data.data || data.item || data
    },
    enabled: enabled && !!user && !!id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  })
}
