'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTeamContext } from '../contexts/TeamContext'

interface TeamUpdatePayload {
  name?: string
  description?: string | null
}

interface TeamUpdateResponse {
  success: boolean
  data?: {
    id: string
    name: string
    description: string | null
    slug: string
    avatarUrl: string | null
    ownerId: string
    createdAt: string
    updatedAt: string
  }
  error?: string
  code?: string
}

/**
 * Hook for updating team name and description (owner only)
 * Uses TanStack Query mutation with cache invalidation
 */
export function useTeamUpdate(teamId: string) {
  const queryClient = useQueryClient()
  const { refreshTeams } = useTeamContext()

  return useMutation<TeamUpdateResponse, Error, TeamUpdatePayload>({
    mutationFn: async (payload) => {
      const response = await fetch(`/api/v1/teams/${teamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update team')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate team queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      // Refresh team context
      refreshTeams()
    },
  })
}
