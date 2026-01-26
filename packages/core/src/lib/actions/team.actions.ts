'use server'

/**
 * Team Server Actions
 *
 * Server Actions for team management including team updates,
 * member invitations, removals, and role changes.
 *
 * SECURITY:
 * - Auth is obtained from session/cookies (NOT from client parameters)
 * - Team operations require appropriate team role permissions
 * - userId comes from getTypedSession()
 * - teamId validation ensures user has access
 *
 * @example
 * ```typescript
 * // From a Client Component
 * 'use client'
 * import {
 *   updateTeam,
 *   inviteMember,
 *   removeMember,
 *   updateMemberRole
 * } from '@nextsparkjs/core/actions'
 *
 * // Update team
 * await updateTeam('team-123', { name: 'New Name' })
 *
 * // Invite member
 * await inviteMember('team-123', 'user@example.com', 'member')
 *
 * // Remove member
 * await removeMember('team-123', 'member-id')
 *
 * // Update role
 * await updateMemberRole('team-123', 'member-id', 'admin')
 * ```
 */

import { revalidatePath } from 'next/cache'
import { headers, cookies } from 'next/headers'
import { getTypedSession } from '../auth'
import { TeamService, type UpdateTeamPayload } from '../services/team.service'
import { TeamMemberService } from '../services/team-member.service'
import type { Team, TeamRole, TeamMember } from '../teams/types'
import type { EntityActionResult, EntityActionVoidResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Team update data that can be passed to updateTeam
 */
export interface UpdateTeamData {
  name?: string
  slug?: string
  description?: string
  avatarUrl?: string
  settings?: Record<string, unknown>
}

/**
 * Result of invite member action
 */
export interface InviteMemberResult {
  memberId: string
  userId: string
  teamId: string
  role: TeamRole
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Get authenticated user context from session
 */
async function getAuthUser(): Promise<
  | { success: true; userId: string }
  | { success: false; error: string }
> {
  const headersList = await headers()
  const session = await getTypedSession(headersList)

  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }

  return { success: true, userId: session.user.id }
}

/**
 * Verify user has required role in team
 */
async function verifyTeamPermission(
  userId: string,
  teamId: string,
  requiredRoles: TeamRole[] = ['owner', 'admin']
): Promise<{ success: true } | { success: false; error: string }> {
  const hasPermission = await TeamMemberService.hasPermission(
    userId,
    teamId,
    requiredRoles
  )

  if (!hasPermission) {
    return { success: false, error: 'Permission denied. Required role: ' + requiredRoles.join(' or ') }
  }

  return { success: true }
}

// ============================================================================
// UPDATE TEAM
// ============================================================================

/**
 * Update a team's information
 *
 * Requires owner or admin role in the team.
 *
 * @param teamId - The team ID to update
 * @param data - Team fields to update
 * @returns Updated team data wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await updateTeam('team-123', {
 *   name: 'New Team Name',
 *   description: 'Updated description'
 * })
 *
 * if (result.success) {
 *   console.log('Team updated:', result.data.name)
 * }
 * ```
 */
export async function updateTeam(
  teamId: string,
  data: UpdateTeamData
): Promise<EntityActionResult<Team>> {
  try {
    // 1. Validate inputs
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (!data || Object.keys(data).length === 0) {
      return { success: false, error: 'No fields provided for update' }
    }

    // 2. Get auth context
    const authResult = await getAuthUser()
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Verify permission (owner or admin)
    const permResult = await verifyTeamPermission(userId, teamId, ['owner', 'admin'])
    if (!permResult.success) {
      return { success: false, error: permResult.error }
    }

    // 4. Build update payload
    const updatePayload: UpdateTeamPayload = {}

    if (data.name !== undefined) updatePayload.name = data.name
    if (data.slug !== undefined) updatePayload.slug = data.slug
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.avatarUrl !== undefined) updatePayload.avatarUrl = data.avatarUrl
    if (data.settings !== undefined) updatePayload.settings = data.settings

    if (Object.keys(updatePayload).length === 0) {
      return { success: false, error: 'No valid fields provided for update' }
    }

    // 5. Check slug availability if being changed
    if (updatePayload.slug) {
      const isAvailable = await TeamService.isSlugAvailable(updatePayload.slug, teamId)
      if (!isAvailable) {
        return { success: false, error: 'Team slug is already taken' }
      }
    }

    // 6. Update team via service
    const updatedTeam = await TeamService.update(teamId, updatePayload, userId)

    // 7. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard')

    return { success: true, data: updatedTeam }
  } catch (error) {
    console.error('[updateTeam] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update team',
    }
  }
}

// ============================================================================
// INVITE MEMBER
// ============================================================================

/**
 * Invite a user to join the team
 *
 * Requires owner or admin role in the team.
 * The user must already exist in the system.
 *
 * @param teamId - The team ID
 * @param email - Email of the user to invite
 * @param role - Role to assign (member, admin, viewer)
 * @returns Created membership data wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await inviteMember('team-123', 'user@example.com', 'member')
 *
 * if (result.success) {
 *   console.log('Member invited:', result.data.memberId)
 * }
 * ```
 */
export async function inviteMember(
  teamId: string,
  email: string,
  role: TeamRole = 'member'
): Promise<EntityActionResult<InviteMemberResult>> {
  try {
    // 1. Validate inputs
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (!email?.trim()) {
      return { success: false, error: 'Email is required' }
    }

    // Validate role (cannot invite as owner)
    const validRoles: TeamRole[] = ['admin', 'member', 'viewer']
    if (!validRoles.includes(role)) {
      return { success: false, error: 'Invalid role. Must be admin, member, or viewer' }
    }

    // 2. Get auth context
    const authResult = await getAuthUser()
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Verify permission (owner or admin)
    const permResult = await verifyTeamPermission(userId, teamId, ['owner', 'admin'])
    if (!permResult.success) {
      return { success: false, error: permResult.error }
    }

    // 4. Find user by email
    const { UserService } = await import('../services/user.service')
    const targetUser = await UserService.getUserByEmail(email, userId)

    if (!targetUser) {
      return { success: false, error: 'User not found. They must create an account first.' }
    }

    // 5. Check if already a member
    const existingMember = await TeamMemberService.getByTeamAndUser(teamId, targetUser.id)
    if (existingMember) {
      return { success: false, error: 'User is already a member of this team' }
    }

    // 6. Add member to team
    const member = await TeamMemberService.add(teamId, targetUser.id, role, {
      invitedBy: userId,
    })

    // 7. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return {
      success: true,
      data: {
        memberId: member.id,
        userId: member.userId,
        teamId: member.teamId,
        role: member.role,
      },
    }
  } catch (error) {
    console.error('[inviteMember] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invite member',
    }
  }
}

// ============================================================================
// REMOVE MEMBER
// ============================================================================

/**
 * Remove a member from the team
 *
 * Requires owner or admin role in the team.
 * Cannot remove the team owner (must transfer ownership first).
 *
 * @param teamId - The team ID
 * @param memberId - The member ID to remove (from team_members table)
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await removeMember('team-123', 'member-id-456')
 *
 * if (result.success) {
 *   console.log('Member removed')
 * }
 * ```
 */
export async function removeMember(
  teamId: string,
  memberId: string
): Promise<EntityActionVoidResult> {
  try {
    // 1. Validate inputs
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (!memberId?.trim()) {
      return { success: false, error: 'Member ID is required' }
    }

    // 2. Get auth context
    const authResult = await getAuthUser()
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Verify permission (owner or admin)
    const permResult = await verifyTeamPermission(userId, teamId, ['owner', 'admin'])
    if (!permResult.success) {
      return { success: false, error: permResult.error }
    }

    // 4. Get the member to find their userId
    // The memberId is the user's ID in the context of team actions
    const targetUserId = memberId

    // 5. Check if trying to remove self
    if (targetUserId === userId) {
      // Allow self-removal if not owner
      const selfRole = await TeamMemberService.getRole(teamId, userId)
      if (selfRole === 'owner') {
        return { success: false, error: 'Cannot remove yourself as owner. Transfer ownership first.' }
      }
    }

    // 6. Verify target is not owner (unless admin trying to remove themselves)
    const targetRole = await TeamMemberService.getRole(teamId, targetUserId)
    if (targetRole === 'owner') {
      return { success: false, error: 'Cannot remove team owner. Transfer ownership first.' }
    }

    // 7. Admins can only remove members/viewers, not other admins (unless owner)
    const requestorRole = await TeamMemberService.getRole(teamId, userId)
    if (requestorRole === 'admin' && targetRole === 'admin' && targetUserId !== userId) {
      return { success: false, error: 'Admins cannot remove other admins. Only the owner can do that.' }
    }

    // 8. Remove member
    await TeamMemberService.remove(teamId, targetUserId)

    // 9. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return { success: true }
  } catch (error) {
    console.error('[removeMember] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove member',
    }
  }
}

// ============================================================================
// UPDATE MEMBER ROLE
// ============================================================================

/**
 * Update a team member's role
 *
 * Requires owner role to change to/from admin.
 * Admins can change member/viewer roles.
 * Cannot change owner role (must transfer ownership).
 *
 * @param teamId - The team ID
 * @param memberId - The member's user ID
 * @param role - New role to assign
 * @returns Updated membership data wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await updateMemberRole('team-123', 'user-456', 'admin')
 *
 * if (result.success) {
 *   console.log('Role updated:', result.data.role)
 * }
 * ```
 */
export async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: TeamRole
): Promise<EntityActionResult<TeamMember>> {
  try {
    // 1. Validate inputs
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (!memberId?.trim()) {
      return { success: false, error: 'Member ID is required' }
    }

    // Validate role (cannot set to owner via this action)
    const validRoles: TeamRole[] = ['admin', 'member', 'viewer']
    if (!validRoles.includes(role)) {
      return { success: false, error: 'Invalid role. Must be admin, member, or viewer. Use transferOwnership for owner.' }
    }

    // 2. Get auth context
    const authResult = await getAuthUser()
    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Get requestor's role
    const requestorRole = await TeamMemberService.getRole(teamId, userId)
    if (!requestorRole) {
      return { success: false, error: 'You are not a member of this team' }
    }

    // 4. Get target member's current role
    const targetUserId = memberId
    const currentRole = await TeamMemberService.getRole(teamId, targetUserId)

    if (!currentRole) {
      return { success: false, error: 'Member not found in this team' }
    }

    // 5. Permission checks based on role changes
    if (currentRole === 'owner') {
      return { success: false, error: 'Cannot change owner role. Use transferOwnership instead.' }
    }

    // Only owner can promote to admin or demote from admin
    if ((role === 'admin' || currentRole === 'admin') && requestorRole !== 'owner') {
      return { success: false, error: 'Only the team owner can promote to or demote from admin' }
    }

    // Admins can change member/viewer roles
    if (requestorRole === 'admin' && (role === 'member' || role === 'viewer')) {
      // OK
    } else if (requestorRole !== 'owner' && requestorRole !== 'admin') {
      return { success: false, error: 'Permission denied. You must be an owner or admin.' }
    }

    // 6. Update role
    const updatedMember = await TeamMemberService.updateRole(teamId, targetUserId, role)

    // 7. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return { success: true, data: updatedMember }
  } catch (error) {
    console.error('[updateMemberRole] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member role',
    }
  }
}
