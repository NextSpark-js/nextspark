import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TeamMemberService, MembershipService } from '@nextsparkjs/core/lib/services'
import type { TeamInvitation } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams/:teamId/invitations - List pending invitations for a team
export const GET = withRateLimitTier(withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ teamId: string }> }): Promise<NextResponse> => {
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

      const { teamId } = await params

      // Validate that teamId is not empty
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      // Check if user is a member of the team
      const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)

      if (!isMember) {
        const response = createApiError('Team not found or access denied', 404, null, 'TEAM_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Parse query parameters
      const { searchParams } = new URL(req.url)
      const page = parseInt(searchParams.get('page') || '1', 10)
      const limit = parseInt(searchParams.get('limit') || '50', 10)
      const status = searchParams.get('status') || 'pending'
      const offset = (page - 1) * limit

      // Fetch team invitations
      const invitations = await queryWithRLS<
        TeamInvitation & {
          inviterName: string | null
          inviterEmail: string
        }
      >(
        `SELECT
          ti.*,
          u.name as "inviterName",
          u.email as "inviterEmail"
        FROM "team_invitations" ti
        INNER JOIN "users" u ON ti."invitedBy" = u.id
        WHERE ti."teamId" = $1 AND ti.status = $2
        ORDER BY ti."createdAt" DESC
        LIMIT $3 OFFSET $4`,
        [teamId, status, limit, offset],
        authResult.user!.id
      )

      // Get total count for pagination
      const totalResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM "team_invitations" ti
         WHERE ti."teamId" = $1 AND ti.status = $2`,
        [teamId, status],
        authResult.user!.id
      )

      const total = parseInt(totalResult[0]?.count || '0', 10)
      const paginationMeta = createPaginationMeta(page, limit, total)

      const response = createApiResponse(invitations, paginationMeta)
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error fetching team invitations:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'read')

// DELETE /api/v1/teams/:teamId/invitations/:invitationId - Cancel/revoke an invitation
export const DELETE = withRateLimitTier(withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ teamId: string }> }): Promise<NextResponse> => {
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

      const { teamId } = await params

      // Get invitation ID from URL
      const url = new URL(req.url)
      const invitationId = url.searchParams.get('id')

      if (!invitationId) {
        const response = createApiError('Invitation ID is required', 400, null, 'MISSING_INVITATION_ID')
        return addCorsHeaders(response)
      }

      // Check if user has permission to manage invitations using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('members.invite')

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

      // Update invitation status to 'cancelled' (or delete it)
      const result = await mutateWithRLS(
        `DELETE FROM "team_invitations"
         WHERE id = $1 AND "teamId" = $2 AND status = 'pending'
         RETURNING *`,
        [invitationId, teamId],
        authResult.user!.id
      )

      if (result.rowCount === 0) {
        const response = createApiError('Invitation not found or already processed', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const response = createApiResponse({ deleted: true, id: invitationId })
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error cancelling invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'write')
