/**
 * Tasks Queries
 *
 * TanStack Query hooks for fetching tasks.
 */

import { useQuery } from '@tanstack/react-query'
import { tasksApi } from './api'
import type { EntityListParams } from '@nextsparkjs/mobile'

export const TASKS_QUERY_KEY = ['tasks'] as const

export function useTasks(params?: EntityListParams) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, params],
    queryFn: () => tasksApi.list(params),
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, id],
    queryFn: () => tasksApi.get(id),
    enabled: !!id,
  })
}
