'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/hooks/useTeamContext'
import { calculateTaskStats, type TaskStats } from '../utils'

interface Task {
  id: string
  status: string
  dueDate: string | null
}

interface UseTaskStatsReturn {
  stats: TaskStats | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch and calculate task statistics for the current team
 */
export function useTaskStats(): UseTaskStatsReturn {
  const { currentTeam } = useTeamContext()

  const {
    data: tasks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tasks', currentTeam?.id, 'stats'],
    queryFn: async (): Promise<Task[]> => {
      const response = await fetch(`/api/v1/tasks?teamId=${currentTeam?.id}&limit=1000`)
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = await response.json()
      return data.items ?? data
    },
    enabled: !!currentTeam?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const stats = useMemo(() => {
    if (!tasks) return null
    return calculateTaskStats(tasks)
  }, [tasks])

  return {
    stats,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
