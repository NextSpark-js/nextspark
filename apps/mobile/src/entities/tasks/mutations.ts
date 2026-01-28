/**
 * TanStack Query mutations for Tasks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from './api'
import { TASKS_QUERY_KEY } from './constants.internal'
import type { Task, CreateTaskInput, UpdateTaskInput } from './types'
import type { PaginatedResponse } from '../../api/client.types'

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.create(data),
    onSuccess: () => {
      // Invalidate tasks list to refetch
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

/**
 * Hook to update an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: (response) => {
      // Update the specific task in cache
      queryClient.setQueryData([...TASKS_QUERY_KEY, response.data.id], response)
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: [...TASKS_QUERY_KEY, deletedId] })
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

/**
 * Hook for optimistic task status update
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) =>
      tasksApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })

      // Snapshot the previous value
      const previousTasks = queryClient.getQueriesData<PaginatedResponse<Task>>({
        queryKey: TASKS_QUERY_KEY,
      })

      // Optimistically update all task lists
      queryClient.setQueriesData<PaginatedResponse<Task>>(
        { queryKey: TASKS_QUERY_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.map((task) =>
              task.id === id ? { ...task, status } : task
            ),
          }
        }
      )

      return { previousTasks }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}
