'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import type { EntityConfig } from '../lib/entities/types'

export interface UseEntityMutationsOptions {
  entityConfig: EntityConfig
  onSuccess?: (data: unknown, variables: unknown) => void
  onError?: (error: Error, variables: unknown) => void
}

export function useEntityMutations(options: UseEntityMutationsOptions) {
  const { entityConfig, onSuccess, onError } = options
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const baseQueryKey = ['entity', entityConfig.slug]

  // CREATE mutation with optimistic update
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create')
      }

      const result = await response.json()
      return result.data || result.item || result
    },
    onMutate: async (newItem) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: baseQueryKey })

      // Optimistically update all matching queries
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: [{ ...newItem, id: 'temp-' + Date.now() }, ...old.items],
          total: old.total + 1,
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  // UPDATE mutation with optimistic update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update')
      }

      const result = await response.json()
      return result.data || result.item || result
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      const previousData = queryClient.getQueriesData({ queryKey: baseQueryKey })

      // Optimistically update lists
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.id === id ? { ...item, ...data } : item
          ),
        }
      })

      // Optimistically update single entity queries
      queryClient.setQueriesData({ queryKey: [...baseQueryKey, id] }, (old: any) => {
        if (!old) return old
        return { ...old, ...data }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  // DELETE mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      return { id }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      const previousData = queryClient.getQueriesData({ queryKey: baseQueryKey })

      // Optimistically remove from lists
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((item: any) => item.id !== id),
          total: old.total - 1,
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  // BULK DELETE mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })

      if (!response.ok) {
        throw new Error('Failed to bulk delete')
      }

      return { ids }
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      const previousData = queryClient.getQueriesData({ queryKey: baseQueryKey })

      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((item: any) => !ids.includes(item.id)),
          total: old.total - ids.length,
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending || bulkDeleteMutation.isPending,
  }
}
