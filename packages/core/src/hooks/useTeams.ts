'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeamsAPI } from '../lib/teams/teams.api'
import { teamsKeys } from '../lib/teams/teams.keys'
import type { CreateTeamRequest } from '../lib/teams/types'

/**
 * Hook to manage current user's teams (for team switchers, settings, etc.)
 *
 * This is a backward-compatible wrapper around the new team hooks architecture.
 * For new code, prefer using the specialized hooks from '@nextsparkjs/core/hooks/teams':
 *
 * - useUserTeams: For current user's teams (same as this hook)
 * - useAdminTeams: For admin team management with pagination
 * - useTeamSearch: For searchable team dropdowns
 *
 * @example
 * ```tsx
 * // In team switcher
 * const { teams, isLoading, createTeam } = useTeams()
 *
 * // Preferred import for new code:
 * import { useUserTeams } from '@nextsparkjs/core/hooks/teams'
 * ```
 */
export function useTeams() {
  const queryClient = useQueryClient()

  const { data: teams = [], isLoading, error } = useQuery({
    queryKey: teamsKeys.user(),
    queryFn: TeamsAPI.getUserTeams,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const createTeamMutation = useMutation({
    mutationFn: async (teamData: CreateTeamRequest) => {
      return TeamsAPI.createTeam(teamData)
    },
    onSuccess: () => {
      // Invalidate both user and admin team lists
      queryClient.invalidateQueries({ queryKey: teamsKeys.user() })
      queryClient.invalidateQueries({ queryKey: teamsKeys.admin() })
    },
  })

  return {
    teams,
    isLoading,
    error,
    createTeam: createTeamMutation.mutate,
    createTeamAsync: createTeamMutation.mutateAsync,
    isCreating: createTeamMutation.isPending,
  }
}
