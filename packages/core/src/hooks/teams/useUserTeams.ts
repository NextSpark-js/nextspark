'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeamsAPI } from '../../lib/teams/teams.api'
import { teamsKeys } from '../../lib/teams/teams.keys'
import type { Team, CreateTeamRequest } from '../../lib/teams/types'

/**
 * Hook for managing current user's teams
 *
 * Fetches teams the user belongs to and provides team creation.
 * For admin access to ALL teams, use useAdminTeams instead.
 *
 * @example
 * ```tsx
 * function TeamSwitcher() {
 *   const { teams, isLoading, createTeam } = useUserTeams()
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <Select>
 *       {teams.map(team => (
 *         <SelectItem key={team.id}>{team.name}</SelectItem>
 *       ))}
 *     </Select>
 *   )
 * }
 * ```
 */
export function useUserTeams() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: teamsKeys.user(),
    queryFn: TeamsAPI.getUserTeams,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const createMutation = useMutation({
    mutationFn: TeamsAPI.createTeam,
    onSuccess: () => {
      // Invalidate user teams cache
      queryClient.invalidateQueries({ queryKey: teamsKeys.user() })
      // Also invalidate admin teams if they're cached
      queryClient.invalidateQueries({ queryKey: teamsKeys.admin() })
    },
  })

  return {
    /** User's teams */
    teams: query.data ?? [],
    /** Loading state */
    isLoading: query.isLoading,
    /** Error if any */
    error: query.error,
    /** Refetch teams */
    refetch: query.refetch,
    /** Create a new team */
    createTeam: createMutation.mutate,
    /** Create a new team (async) */
    createTeamAsync: createMutation.mutateAsync,
    /** Team creation in progress */
    isCreating: createMutation.isPending,
    /** Team creation error */
    createError: createMutation.error,
  }
}

export type UseUserTeamsReturn = ReturnType<typeof useUserTeams>
