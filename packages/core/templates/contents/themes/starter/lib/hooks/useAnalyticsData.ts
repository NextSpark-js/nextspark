'use client'

import { useQuery } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

interface WeeklyProgress {
  day: string
  completed: number
  created: number
}

interface ActivityItem {
  id: string
  action: 'created' | 'completed' | 'updated'
  task: string
  time: string
}

interface AnalyticsData {
  totalTasks: number
  completedToday: number
  overdue: number
  avgCompletionTime: number
  weeklyProgress: WeeklyProgress[]
  recentActivity: ActivityItem[]
}

export function useAnalyticsData() {
  const { currentTeam } = useTeamContext()

  return useQuery({
    queryKey: ['analytics', currentTeam?.id],
    queryFn: async (): Promise<AnalyticsData> => {
      const res = await fetch(`/api/v1/analytics?teamId=${currentTeam?.id}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
    enabled: !!currentTeam?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
