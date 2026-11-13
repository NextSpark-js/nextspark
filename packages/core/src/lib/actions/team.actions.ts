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
 * - userId comes from getAuthorizationSession() (database read, past the cookie cache)
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
import { getAuthorizationSession } from '../auth/authorization-session'
import { TeamService, type UpdateTeamPayload } from '../services/team.service'
import { TeamMemberService } from '../services/team-member.service'
import { TeamInvitationService } from '../services/team-invitation.service'
import { updateTeamSchema } from '../teams/schema'
import type { ZodError } from 'zod'
import { formatZodError } from './validation'
import { actionRateLimitError } from './rate-limit'
import { actionErrorMessage } from './errors'
import type { Team, TeamRole, TeamMember } from '../teams/types'
import type { EntityActionResult, EntityActionVoidResult } from './types'
import type { Permission } from '../permissions/types'
import { getInvitableRoles, canManageRole, hierarchyRoleFor, validateRoleTransition } from '../teams/permissions'
import { MembershipService, type TeamMembership } from '../services/membership.service'
import { APP_CONFIG_MERGED } from '../config/config-sync'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Team update data that can be passed to updateTeam
 */
export interface UpdateTeamData {
  name?: string
  slug?: string
  description?: string | null
  avatarUrl?: string | null
  settings?: Record<string, unknown>
}

/**
 * Result of invite member action: the pending invitation (the accept token goes only in the email)
 */
export interface InviteMemberResult {
  invitationId: string
  teamId: string
  email: string
  role: TeamRole
  status: 'pending'
  expiresAt: string
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
  const session = await getAuthorizationSession(headersList)

  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }

  return { success: true, userId: session.user.id }
}

/**
 * Verify the user holds a team permission, by the check the REST routes make (MembershipService.canPerformAction):
 * the team role's permissions, or every permission for an app role that teams.appRoleBypass lets skip them (#458).
 * Returns the membership for the role-hierarchy checks that follow.
 */
async function verifyTeamPermission(
  userId: string,
  teamId: string,
  permission: Permission
): Promise<{ success: true; membership: TeamMembership } | { success: false; error: string }> {
  const membership = await MembershipService.get(userId, teamId)
  const result = membership.canPerformAction(permission)

  if (result.allowed === false) {
    return { success: false, error: result.message ?? 'Permission denied' }
  }

  return { success: true, membership }
}

// ============================================================================
// UPDATE TEAM
// ============================================================================

/**
 * Update a team's information
 *
 * Requires the team.edit permission, as `PATCH /api/v1/teams/:teamId` does.
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
    if (authResult.success === false) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Verify permission (team.edit, as PATCH /api/v1/teams/:teamId)
    const permResult = await verifyTeamPermission(userId, teamId, 'team.edit' as Permission)
    if (permResult.success === false) {
      return { success: false, error: permResult.error }
    }

    const limited = await actionRateLimitError(userId, 'write')
    if (limited) return { success: false, error: limited }

    // 4. Validate the fields with the schema of PATCH /api/v1/teams/:teamId
    const parsed = updateTeamSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: formatZodError(parsed.error) }
    }

    const updatePayload: UpdateTeamPayload = {}
    const fields = parsed.data
    if (fields.name !== undefined) updatePayload.name = fields.name
    if (fields.slug !== undefined) updatePayload.slug = fields.slug
    if (fields.description !== undefined) updatePayload.description = fields.description
    if (fields.avatarUrl !== undefined) updatePayload.avatarUrl = fields.avatarUrl
    if (fields.settings !== undefined) updatePayload.settings = fields.settings

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
      error: actionErrorMessage(error, 'Failed to update team'),
    }
  }
}

// ============================================================================
// INVITE MEMBER
// ============================================================================

/**
 * Invite a person to join the team
 *
 * Creates a pending invitation and emails the invitee, as `POST /api/v1/teams/:teamId/members` does (the same
 * service, so the same permission, role-hierarchy and duplicate rules). Nobody is added to the team: the invitee
 * accepts through the link in the email. The invitee does not need an account yet.
 *
 * @param teamId - The team ID
 * @param email - Email of the person to invite
 * @param role - Role the invitee gets on accepting (below the inviter's own)
 * @returns The pending invitation (without its accept token) wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await inviteMember('team-123', 'user@example.com', 'member')
 *
 * if (result.success) {
 *   console.log('Invitation sent:', result.data.invitationId)
 * }
 * ```
 */
export async function inviteMember(
  teamId: string,
  email: string,
  role: TeamRole = APP_CONFIG_MERGED.teams.roles.defaultTeamRole as TeamRole
): Promise<EntityActionResult<InviteMemberResult>> {
  try {
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (typeof email !== 'string' || !email.trim()) {
      return { success: false, error: 'Email is required' }
    }

    const headersList = await headers()
    const session = await getAuthorizationSession(headersList)
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const limited = await actionRateLimitError(session.user.id, 'write')
    if (limited) return { success: false, error: limited }

    const result = await TeamInvitationService.create({
      teamId,
      actor: { id: session.user.id, email: session.user.email },
      input: { email, role },
    })
    if (result.success === false) {
      return { success: false, error: result.error }
    }

    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    const { invitation } = result
    return {
      success: true,
      data: {
        invitationId: invitation.id,
        teamId: invitation.teamId,
        email: invitation.email,
        role: invitation.role,
        status: 'pending',
        expiresAt: new Date(invitation.expiresAt).toISOString(),
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return { success: false, error: formatZodError(error as ZodError) }
    }
    // Like REST's 500: log the cause, send none (database and policy names stay on the server)
    console.error('[inviteMember] Error:', error)
    return { success: false, error: 'Failed to invite member' }
  }
}

// ============================================================================
// REMOVE MEMBER
// ============================================================================

/**
 * Remove a member from the team
 *
 * The same rules as `DELETE /api/v1/teams/:teamId/members/:memberId` (#458): the team.members.remove permission,
 * never the owner (transfer ownership first), and only a role below the caller's (hierarchyRoleFor: the team role,
 * or the owner's for an app role that teams.appRoleBypass lets skip team permissions).
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
    if (authResult.success === false) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    // 3. Verify permission (team.members.remove, as the REST route)
    const permResult = await verifyTeamPermission(userId, teamId, 'team.members.remove' as Permission)
    if (permResult.success === false) {
      return { success: false, error: permResult.error }
    }
    const { membership } = permResult

    const limited = await actionRateLimitError(userId, 'write')
    if (limited) return { success: false, error: limited }

    // 4. The memberId is the user's ID in the context of team actions
    const targetUserId = memberId
    const targetRole = await TeamMemberService.getRole(teamId, targetUserId)
    if (!targetRole) {
      return { success: false, error: 'Member not found in this team' }
    }

    // 5. Never the owner
    if (targetRole === 'owner') {
      return { success: false, error: 'Cannot remove team owner. Transfer ownership first.' }
    }

    // 6. Only a role below the caller's (the REST route's hierarchy check)
    if (!canManageRole(hierarchyRoleFor(membership.appRole, membership.role) ?? '', targetRole)) {
      return { success: false, error: 'You do not have permission to remove this user.' }
    }

    // 7. Remove member. Service connection, only after the permission and hierarchy checks above: the RLS policy knows
    // team roles only, not teams.appRoleBypass (#458)
    await TeamMemberService.remove(teamId, targetUserId, userId, { service: true, expectedRole: targetRole })

    // 8. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return { success: true }
  } catch (error) {
    console.error('[removeMember] Error:', error)
    return {
      success: false,
      error: actionErrorMessage(error, 'Failed to remove member'),
    }
  }
}

// ============================================================================
// UPDATE MEMBER ROLE
// ============================================================================

/**
 * Update a team member's role
 *
 * The same rules as `PATCH /api/v1/teams/:teamId/members/:memberId` (#458): the team.members.update_role
 * permission, and validateRoleTransition with the caller's hierarchy role (hierarchyRoleFor: the team role, or the
 * owner's for an app role that teams.appRoleBypass lets skip team permissions): the owner's role never changes,
 * nobody is promoted to owner, and the caller outranks both the current and the new role.
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

    // Validate role against the registry-derived invitable set (excludes 'owner';
    // reflects the theme's declarative teams.roles set).
    const validRoles = getInvitableRoles()
    if (!validRoles.includes(role)) {
      return { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}. Use transferOwnership for owner.` }
    }

    // 2. Get auth context
    const authResult = await getAuthUser()
    if (authResult.success === false) {
      return { success: false, error: authResult.error }
    }
    const { userId } = authResult

    const limited = await actionRateLimitError(userId, 'write')
    if (limited) return { success: false, error: limited }

    // 3. Verify permission (team.members.update_role, as the REST route)
    const permResult = await verifyTeamPermission(userId, teamId, 'team.members.update_role' as Permission)
    if (permResult.success === false) {
      return { success: false, error: permResult.error }
    }
    const { membership } = permResult

    // 4. Get target member's current role
    const targetUserId = memberId
    const currentRole = await TeamMemberService.getRole(teamId, targetUserId)

    if (!currentRole) {
      return { success: false, error: 'Member not found in this team' }
    }

    // 5. The role hierarchy (the REST route's check)
    const transition = validateRoleTransition(currentRole, role, hierarchyRoleFor(membership.appRole, membership.role) ?? '')
    if (!transition.allowed) {
      return { success: false, error: transition.reason ?? 'Invalid role transition' }
    }

    // 6. Update role
    // Service connection, only after the permission and hierarchy checks above: the RLS policy knows team roles only,
    // not teams.appRoleBypass (#458)
    const updatedMember = await TeamMemberService.updateRole(teamId, targetUserId, role, userId, { service: true, expectedRole: currentRole })

    // 7. Revalidate team-related paths
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return { success: true, data: updatedMember }
  } catch (error) {
    console.error('[updateMemberRole] Error:', error)
    return {
      success: false,
      error: actionErrorMessage(error, 'Failed to update member role'),
    }
  }
}

// ============================================================================
// TRANSFER OWNERSHIP
// ============================================================================

/**
 * Hand the team to a current member: they become owner and the caller becomes admin.
 *
 * Only the team's owner can do it (TeamMemberService.transferOwnership checks it in the same transaction).
 *
 * @param teamId - The team ID
 * @param newOwnerId - The user ID of the member who becomes owner
 *
 * @example
 * ```typescript
 * const result = await transferTeamOwnership('team-123', 'user-456')
 * ```
 */
export async function transferTeamOwnership(
  teamId: string,
  newOwnerId: string
): Promise<EntityActionVoidResult> {
  try {
    if (!teamId?.trim()) {
      return { success: false, error: 'Team ID is required' }
    }

    if (!newOwnerId?.trim()) {
      return { success: false, error: 'New owner ID is required' }
    }

    const authResult = await getAuthUser()
    if (authResult.success === false) {
      return { success: false, error: authResult.error }
    }

    const limited = await actionRateLimitError(authResult.userId, 'strict')
    if (limited) return { success: false, error: limited }

    await TeamMemberService.transferOwnership(teamId, newOwnerId, authResult.userId)

    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/settings/team/members')

    return { success: true }
  } catch (error) {
    console.error('[transferTeamOwnership] Error:', error)
    return {
      success: false,
      error: actionErrorMessage(error, 'Failed to transfer ownership'),
    }
  }
}
