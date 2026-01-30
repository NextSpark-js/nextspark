import { NextRequest, NextResponse } from 'next/server'
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { updateMemberRoleSchema } from '@nextsparkjs/core/lib/teams/schema'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { validateRoleTransition, canManageRole } from '@nextsparkjs/core/lib/teams/permissions'
import type { TeamMember, TeamRole } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// PATCH /api/v1/teams/:teamId/members/:memberId - Update member role
export const PATCH = withRateLimitTier(withApiLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string; memberId: string }> }
  ): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth
      const authResult = await authenticateRequest(req)

      if (!authResult.success) {
        return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
        )
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId, memberId } = await params

      // Validate parameters
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      if (!memberId || memberId.trim() === '') {
        const response = createApiError('Member ID is required', 400, null, 'MISSING_MEMBER_ID')
        return addCorsHeaders(response)
      }

      // Check if user has permission to update member roles using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('members.update_role')

      if (!actionResult.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: actionResult.message,
            reason: actionResult.reason,
            meta: actionResult.meta,
          },
          { status: 403 }
        )
        return addCorsHeaders(response)
      }

      // Get user's role for role hierarchy validation
      const userRole = membership.role as TeamRole

      // Get target member
      const targetMember = await queryOneWithRLS<TeamMember>(
        'SELECT * FROM "team_members" WHERE id = $1 AND "teamId" = $2',
        [memberId, teamId],
        authResult.user!.id
      )

      if (!targetMember) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const body = await req.json()
      const validatedData = updateMemberRoleSchema.parse(body)

      // Validate role transition
      const transitionValidation = validateRoleTransition(targetMember.role, validatedData.role, userRole)

      if (!transitionValidation.allowed) {
        const response = createApiError(transitionValidation.reason || 'Invalid role transition', 403, null, 'INVALID_ROLE_TRANSITION')
        return addCorsHeaders(response)
      }

      // Check if actor can manage the target role
      if (!canManageRole(userRole, targetMember.role)) {
        const response = createApiError(
          'You do not have permission to change this user\'s role.',
          403,
          null,
          'INSUFFICIENT_PERMISSIONS'
        )
        return addCorsHeaders(response)
      }

      // Update member role
      const result = await mutateWithRLS(
        `UPDATE "team_members"
         SET role = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2 AND "teamId" = $3
         RETURNING *`,
        [validatedData.role, memberId, teamId],
        authResult.user!.id
      )

      if (result.rows.length === 0) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Fetch member with user details
      const memberWithUser = await queryOneWithRLS<
        TeamMember & {
          userName: string | null
          userEmail: string
          userImage: string | null
        }
      >(
        `SELECT
          tm.*,
          u.name as "userName",
          u.email as "userEmail",
          u.image as "userImage"
        FROM "team_members" tm
        INNER JOIN "users" u ON tm."userId" = u.id
        WHERE tm.id = $1`,
        [memberId],
        authResult.user!.id
      )

      const response = createApiResponse(memberWithUser)
      return addCorsHeaders(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response)
      }

      console.error('Error updating member role:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'write')

// DELETE /api/v1/teams/:teamId/members/:memberId - Remove member from team
export const DELETE = withRateLimitTier(withApiLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string; memberId: string }> }
  ): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth
      const authResult = await authenticateRequest(req)

      if (!authResult.success) {
        return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
        )
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId, memberId } = await params

      // Validate parameters
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      if (!memberId || memberId.trim() === '') {
        const response = createApiError('Member ID is required', 400, null, 'MISSING_MEMBER_ID')
        return addCorsHeaders(response)
      }

      // Check if user has permission to remove members using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('members.remove')

      if (!actionResult.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: actionResult.message,
            reason: actionResult.reason,
            meta: actionResult.meta,
          },
          { status: 403 }
        )
        return addCorsHeaders(response)
      }

      // Get user's role for role hierarchy validation
      const userRole = membership.role as TeamRole

      // Get target member
      const targetMember = await queryOneWithRLS<TeamMember>(
        'SELECT * FROM "team_members" WHERE id = $1 AND "teamId" = $2',
        [memberId, teamId],
        authResult.user!.id
      )

      if (!targetMember) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Cannot remove the owner
      if (targetMember.role === 'owner') {
        const response = createApiError('Cannot remove the team owner', 403, null, 'CANNOT_REMOVE_OWNER')
        return addCorsHeaders(response)
      }

      // Check if actor can manage the target role
      if (!canManageRole(userRole, targetMember.role)) {
        const response = createApiError(
          'You do not have permission to remove this user.',
          403,
          null,
          'INSUFFICIENT_PERMISSIONS'
        )
        return addCorsHeaders(response)
      }

      // Remove member
      const result = await mutateWithRLS(
        'DELETE FROM "team_members" WHERE id = $1 AND "teamId" = $2 RETURNING id',
        [memberId, teamId],
        authResult.user!.id
      )

      if (result.rows.length === 0) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const response = createApiResponse({ deleted: true, id: memberId })
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error removing member:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'write')
