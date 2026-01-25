/**
 * TanStack Query hooks for Tasks CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Task, CreateTaskInput, UpdateTaskInput, PaginatedResponse } from '../types'

const TASKS_QUERY_KEY = ['tasks']

interface UseTasksOptions {
  page?: number
  limit?: number
  status?: string
  priority?: string
  search?: string
  enabled?: boolean
}

/**
 * Hook to fetch paginated tasks list
 */
export function useTasks(options: UseTasksOptions = {}) {
  const { page = 1, limit = 20, status, priority, search, enabled = true } = options

  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, { page, limit, status, priority, search }],
    queryFn: () => apiClient.listTasks({ page, limit, status, priority, search }),
    enabled,
  })
}

/**
 * Hook to fetch a single task by ID
 */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, id],
    queryFn: () => apiClient.getTask(id!),
    enabled: !!id,
  })
}

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaskInput) => apiClient.createTask(data),
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
      apiClient.updateTask(id, data),
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
    mutationFn: (id: string) => apiClient.deleteTask(id),
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
      apiClient.updateTask(id, { status }),
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
    onError: (err, variables, context) => {
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
