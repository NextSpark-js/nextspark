/**
 * TanStack Query hooks for Tasks
 */

import { useQuery } from '@tanstack/react-query'
import { tasksApi } from './api'
import { TASKS_QUERY_KEY } from './constants.internal'

export { TASKS_QUERY_KEY }

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
    queryFn: () => tasksApi.list({ page, limit, status, priority, search }),
    enabled,
  })
}

/**
 * Hook to fetch a single task by ID
 */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, id],
    queryFn: () => tasksApi.get(id!),
    enabled: !!id,
  })
}
