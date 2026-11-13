import { NextRequest, NextResponse } from 'next/server'
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
  readJsonObject,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { updateMemberRoleSchema } from '@nextsparkjs/core/lib/teams/schema'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { validateRoleTransition, canManageRole, hierarchyRoleFor } from '@nextsparkjs/core/lib/teams/permissions'
import type { TeamMember, TeamRole } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

// PATCH /api/v1/teams/:teamId/members/:memberId - Update member role
export const PATCH = withRateLimitTier(withApiLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string; memberId: string }> }
  ): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth; the API-key scope is declared at the entry
      // point, which fails closed for keys that lack it (#93).
      const authResult = await authenticateRequest(req, { requiredScope: 'teams:write' })

      if (!authResult.success) {
        return createAuthFailureResponse(authResult)
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId, memberId } = await params

      // Validate parameters
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response, req)
      }

      if (!memberId || memberId.trim() === '') {
        const response = createApiError('Member ID is required', 400, null, 'MISSING_MEMBER_ID')
        return addCorsHeaders(response, req)
      }

      // Check if user has permission to update member roles using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('team.members.update_role')

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
        return addCorsHeaders(response, req)
      }

      // The role the hierarchy checks run with: the team role, or the owner's for an app role that
      // teams.appRoleBypass lets skip team permissions (#458)
      const userRole = hierarchyRoleFor(membership.appRole, membership.role) as TeamRole

      // Get target member
      const targetMember = await queryOneWithRLS<TeamMember>(
        'SELECT * FROM "team_members" WHERE id = $1 AND "teamId" = $2',
        [memberId, teamId],
        authResult.user!.id
      )

      if (!targetMember) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      const parsedBody = await readJsonObject(req)
      if (parsedBody.error) return addCorsHeaders(parsedBody.error, req)
      const body = parsedBody.data
      const validatedData = updateMemberRoleSchema.parse(body)

      // Validate role transition
      const transitionValidation = validateRoleTransition(targetMember.role, validatedData.role, userRole)

      if (!transitionValidation.allowed) {
        const response = createApiError(transitionValidation.reason || 'Invalid role transition', 403, null, 'INVALID_ROLE_TRANSITION')
        return addCorsHeaders(response, req)
      }

      // Check if actor can manage the target role
      if (!canManageRole(userRole, targetMember.role)) {
        const response = createApiError(
          'You do not have permission to change this user\'s role.',
          403,
          null,
          'INSUFFICIENT_PERMISSIONS'
        )
        return addCorsHeaders(response, req)
      }

      // Update member role.
      // Service connection, and only here, after the permission and the role-hierarchy checks above: the RLS policy
      // (auth_can_manage_member) knows team roles only, so it would refuse a user whose app role teams.appRoleBypass
      // lets skip team permissions and those checks allowed (#458)
      const result = await mutateWithRLS(
        `UPDATE "team_members"
         SET role = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2 AND "teamId" = $3 AND role = $4
         RETURNING *`,
        // only while the member still has the role the checks above judged (a change since then, say to owner, writes nothing)
        [validatedData.role, memberId, teamId, targetMember.role],
        authResult.user!.id,
        { service: true }
      )

      if (result.rows.length === 0) {
        // gone, or their role changed since the checks (#458): the neighbours' 404, nothing written
        const response = createApiError('Member not found, or their role changed', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
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
      return addCorsHeaders(response, req)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response, req)
      }

      console.error('Error updating member role:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
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
      // Authenticate using dual auth; the API-key scope is declared at the entry
      // point, which fails closed for keys that lack it (#93).
      const authResult = await authenticateRequest(req, { requiredScope: 'teams:write' })

      if (!authResult.success) {
        return createAuthFailureResponse(authResult)
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId, memberId } = await params

      // Validate parameters
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response, req)
      }

      if (!memberId || memberId.trim() === '') {
        const response = createApiError('Member ID is required', 400, null, 'MISSING_MEMBER_ID')
        return addCorsHeaders(response, req)
      }

      // Check if user has permission to remove members using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('team.members.remove')

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
        return addCorsHeaders(response, req)
      }

      // The role the hierarchy checks run with: the team role, or the owner's for an app role that
      // teams.appRoleBypass lets skip team permissions (#458)
      const userRole = hierarchyRoleFor(membership.appRole, membership.role) as TeamRole

      // Get target member
      const targetMember = await queryOneWithRLS<TeamMember>(
        'SELECT * FROM "team_members" WHERE id = $1 AND "teamId" = $2',
        [memberId, teamId],
        authResult.user!.id
      )

      if (!targetMember) {
        const response = createApiError('Member not found', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      // Cannot remove the owner
      if (targetMember.role === 'owner') {
        const response = createApiError('Cannot remove the team owner', 403, null, 'CANNOT_REMOVE_OWNER')
        return addCorsHeaders(response, req)
      }

      // Check if actor can manage the target role
      if (!canManageRole(userRole, targetMember.role)) {
        const response = createApiError(
          'You do not have permission to remove this user.',
          403,
          null,
          'INSUFFICIENT_PERMISSIONS'
        )
        return addCorsHeaders(response, req)
      }

      // Remove member.
      // Service connection, and only here, after the permission and the role-hierarchy checks above: the RLS policy
      // (auth_can_manage_member) knows team roles only, so it would refuse a user whose app role teams.appRoleBypass
      // lets skip team permissions and those checks allowed (#458)
      const result = await mutateWithRLS(
        'DELETE FROM "team_members" WHERE id = $1 AND "teamId" = $2 AND role = $3 RETURNING id',
        // only while the member still has the role the checks above judged
        [memberId, teamId, targetMember.role],
        authResult.user!.id,
        { service: true }
      )

      if (result.rows.length === 0) {
        // gone, or their role changed since the checks (#458): the neighbours' 404, nothing written
        const response = createApiError('Member not found, or their role changed', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      const response = createApiResponse({ deleted: true, id: memberId })
      return addCorsHeaders(response, req)
    } catch (error) {
      console.error('Error removing member:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
), 'write')
