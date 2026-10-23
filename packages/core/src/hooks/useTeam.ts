'use client'

import { useTeamContext } from '../contexts/TeamContext'

/**
 * Hook to get current team information
 */
export function useTeam() {
  const { currentTeam, isLoading, isReady, canCurrentUserCreateTeam } = useTeamContext()

  return {
    team: currentTeam,
    teamId: currentTeam?.id,
    canCurrentUserCreateTeam,
    isLoading,
    isReady
  }
}
