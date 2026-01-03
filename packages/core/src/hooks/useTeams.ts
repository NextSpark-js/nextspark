'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Team, CreateTeamRequest } from '../lib/teams/types'

/**
 * Hook to manage teams list and creation
 */
export function useTeams() {
  const queryClient = useQueryClient()

  const { data: teams = [], isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await fetch('/api/v1/teams')
      if (!response.ok) throw new Error('Failed to fetch teams')
      const data = await response.json()
      return data.teams || []
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  const createTeamMutation = useMutation({
    mutationFn: async (teamData: CreateTeamRequest) => {
      const response = await fetch('/api/v1/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create team')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    }
  })

  return {
    teams,
    isLoading,
    error,
    createTeam: createTeamMutation.mutate,
    createTeamAsync: createTeamMutation.mutateAsync,
    isCreating: createTeamMutation.isPending
  }
}
