'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook to manage team invitations
 */
export function useTeamInvitations() {
  const queryClient = useQueryClient()

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: async () => {
      const response = await fetch('/api/v1/team-invitations')
      if (!response.ok) throw new Error('Failed to fetch invitations')
      const data = await response.json()
      return data.invitations || []
    },
    staleTime: 2 * 60 * 1000 // 2 minutes
  })

  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch(`/api/v1/team-invitations/${token}/accept`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept invitation')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    }
  })

  const declineInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch(`/api/v1/team-invitations/${token}/decline`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to decline invitation')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
    }
  })

  return {
    invitations,
    isLoading,
    acceptInvitation: acceptInvitationMutation.mutate,
    acceptInvitationAsync: acceptInvitationMutation.mutateAsync,
    isAccepting: acceptInvitationMutation.isPending,
    declineInvitation: declineInvitationMutation.mutate,
    declineInvitationAsync: declineInvitationMutation.mutateAsync,
    isDeclining: declineInvitationMutation.isPending
  }
}
