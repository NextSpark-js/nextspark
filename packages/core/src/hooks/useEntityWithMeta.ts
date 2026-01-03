'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getEntityMetaConfig, EntityType } from '../types/meta.types'

interface UseEntityWithMetaOptions {
  includeMeta?: string[] | boolean
  autoFetch?: boolean
  staleTime?: number
  gcTime?: number
}

/**
 * useEntityWithMeta - TanStack Query powered entity + metadata hook
 *
 * Provides entity management with metadata support:
 * - Automatic caching
 * - Optimistic updates for metadata
 * - No unnecessary refetches
 */
export function useEntityWithMeta<T = Record<string, unknown>>(
  entityType: EntityType,
  entityId: string,
  options: UseEntityWithMetaOptions = {}
) {
  const {
    includeMeta = true,
    autoFetch = true,
    staleTime = 1000 * 60 * 5,
    gcTime = 1000 * 60 * 60,
  } = options

  const { user } = useAuth()
  const queryClient = useQueryClient()
  const config = getEntityMetaConfig(entityType)

  // Build query key
  const queryKey = [
    'entity-with-meta',
    entityType,
    entityId,
    { includeMeta: includeMeta === true ? 'all' : includeMeta },
  ]

  // Fetch entity with metadata
  const query = useQuery<T & { meta?: Record<string, unknown> }>({
    queryKey,
    queryFn: async () => {
      if (!config) {
        throw new Error(`Entity type '${entityType}' not configured`)
      }

      const params = new URLSearchParams()
      if (includeMeta === true) {
        params.set('includeMeta', 'all')
      } else if (Array.isArray(includeMeta)) {
        params.set('includeMeta', includeMeta.join(','))
      }

      const url = `/api/v1/${config.apiPath}/${entityId}${
        params.toString() ? `?${params.toString()}` : ''
      }`

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityType}`)
      }

      const result = await response.json()
      return result.data
    },
    enabled: autoFetch && !!user && !!entityId && !!config,
    staleTime,
    gcTime,
  })

  // Update entity mutation (with optimistic meta updates)
  const updateEntityMutation = useMutation({
    mutationFn: async ({
      updates,
      metaUpdates,
    }: {
      updates?: Partial<T>
      metaUpdates?: Record<string, unknown>
    }) => {
      if (!config) {
        throw new Error(`Entity type '${entityType}' not configured`)
      }

      const payload: Record<string, unknown> = { ...updates }

      if (metaUpdates) {
        payload.meta = metaUpdates
      }

      const response = await fetch(`/api/v1/${config.apiPath}/${entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update ${entityType}`)
      }

      const result = await response.json()
      return result.data
    },
    onMutate: async ({ updates, metaUpdates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old

        const newData = { ...old, ...updates }

        if (metaUpdates) {
          newData.meta = { ...old.meta, ...metaUpdates }
        }

        return newData
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(queryKey, data)
    },
  })

  // Helper to update only metadata
  const updateMeta = async (metaUpdates: Record<string, unknown>) => {
    return updateEntityMutation.mutateAsync({ metaUpdates })
  }

  // Helper to update entity
  const updateEntity = async (
    updates: Partial<T>,
    metaUpdates?: Record<string, unknown>
  ) => {
    return updateEntityMutation.mutateAsync({ updates, metaUpdates })
  }

  // Helper to get specific meta value
  const getMeta = <MetaT = unknown>(metaKey: string, defaultValue?: MetaT): MetaT => {
    return (query.data?.meta?.[metaKey] ?? defaultValue) as MetaT
  }

  // Helper to check if meta key exists
  const hasMeta = (metaKey: string): boolean => {
    return query.data?.meta ? metaKey in query.data.meta : false
  }

  return {
    data: query.data,
    entity: query.data ? { ...query.data, meta: undefined } : null,
    meta: query.data?.meta || {},
    loading: query.isLoading,
    error: query.error?.message || null,
    updateEntity,
    updateMeta,
    getMeta,
    hasMeta,
    refetch: query.refetch,
    isUpdating: updateEntityMutation.isPending,
  }
}

// Specific hooks for common entities
export function useUserWithMeta(userId: string, options?: UseEntityWithMetaOptions) {
  return useEntityWithMeta<Record<string, unknown>>('user', userId, options)
}

export function useTaskWithMeta(taskId: string, options?: UseEntityWithMetaOptions) {
  return useEntityWithMeta<Record<string, unknown>>('task', taskId, options)
}
