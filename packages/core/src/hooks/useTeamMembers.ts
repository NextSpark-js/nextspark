'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTeam } from './useTeam'
import { InviteMemberRequest, UpdateMemberRoleRequest } from '../lib/teams/types'

interface UseTeamMembersOptions {
  /**
   * Optional teamId to use instead of context teamId.
   * Useful when viewing a team detail page where the teamId comes from URL.
   */
  teamId?: string
}

/**
 * Hook to manage team members
 *
 * @param options - Optional configuration including teamId override
 */
export function useTeamMembers(options?: UseTeamMembersOptions) {
  const { teamId: contextTeamId } = useTeam()
  // Use provided teamId or fall back to context teamId
  const teamId = options?.teamId || contextTeamId
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      if (!teamId) return []
      const response = await fetch(`/api/v1/teams/${teamId}/members`)
      if (!response.ok) throw new Error('Failed to fetch members')
      const json = await response.json()
      // API returns { success: true, data: [...] } with flat properties
      // Transform to include nested user object for component compatibility
      const rawMembers = json.data || []
      return rawMembers.map((member: any) => ({
        ...member,
        // Create nested user object from flat properties
        user: {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          image: member.userImage,
          avatarUrl: member.userImage,
        }
      }))
    },
    enabled: !!teamId
  })

  const inviteMemberMutation = useMutation({
    mutationFn: async (request: InviteMemberRequest) => {
      const response = await fetch(`/api/v1/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to invite member')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
    }
  })

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: UpdateMemberRoleRequest['role'] }) => {
      const response = await fetch(`/api/v1/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })

      if (!response.ok) throw new Error('Failed to update role')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] })
    }
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/v1/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove member')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] })
    }
  })

  return {
    members,
    isLoading,
    inviteMember: inviteMemberMutation.mutate,
    inviteMemberAsync: inviteMemberMutation.mutateAsync,
    isInviting: inviteMemberMutation.isPending,
    updateMemberRole: updateMemberRoleMutation.mutate,
    isUpdatingRole: updateMemberRoleMutation.isPending,
    removeMember: removeMemberMutation.mutate,
    isRemovingMember: removeMemberMutation.isPending
  }
}
