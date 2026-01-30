import { NextRequest, NextResponse } from 'next/server'
import { queryOneWithRLS, mutateWithRLS, getTransactionClient } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { checkRateLimit, withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { RATE_LIMITS } from '@nextsparkjs/core/lib/api/keys'
import type { TeamInvitation, TeamMember } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// POST /api/v1/team-invitations/:token/accept - Accept invitation and become member
export const POST = withRateLimitTier(withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> => {
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

      // Apply specific rate limit for invitation responses (50 req/min)
      const rateLimitConfig = RATE_LIMITS['teams:invite:respond']
      const rateLimitKey = `invite:respond:${authResult.user!.id}`
      const rateLimit = checkRateLimit(rateLimitKey, rateLimitConfig.requests, rateLimitConfig.windowMs)

      if (!rateLimit.allowed) {
        const response = createApiError(
          'Rate limit exceeded. Please try again later.',
          429,
          { retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
          'RATE_LIMIT_EXCEEDED'
        )
        return addCorsHeaders(response)
      }

      const { token } = await params

      // Validate that token is not empty
      if (!token || token.trim() === '') {
        const response = createApiError('Invitation token is required', 400, null, 'MISSING_TOKEN')
        return addCorsHeaders(response)
      }

      // Get invitation by token
      const invitation = await queryOneWithRLS<TeamInvitation>(
        'SELECT * FROM "team_invitations" WHERE token = $1',
        [token],
        authResult.user!.id
      )

      if (!invitation) {
        const response = createApiError('Invitation not found', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Verify invitation is for the current user's email
      if (invitation.email.toLowerCase() !== authResult.user!.email.toLowerCase()) {
        const response = createApiError(
          'This invitation is for a different email address',
          403,
          null,
          'EMAIL_MISMATCH'
        )
        return addCorsHeaders(response)
      }

      // Check if invitation is pending
      if (invitation.status !== 'pending') {
        const response = createApiError(
          `Invitation has already been ${invitation.status}`,
          409,
          null,
          'INVITATION_NOT_PENDING'
        )
        return addCorsHeaders(response)
      }

      // Check if invitation has expired
      const expiresAt = new Date(invitation.expiresAt)
      if (expiresAt < new Date()) {
        // Mark as expired
        await mutateWithRLS(
          'UPDATE "team_invitations" SET status = \'expired\', "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
          [invitation.id],
          authResult.user!.id
        )

        const response = createApiError('Invitation has expired', 410, null, 'INVITATION_EXPIRED')
        return addCorsHeaders(response)
      }

      // Check if user is already a member
      const existingMember = await queryOneWithRLS<TeamMember>(
        'SELECT * FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
        [invitation.teamId, authResult.user!.id],
        authResult.user!.id
      )

      if (existingMember) {
        const response = createApiError('You are already a member of this team', 409, null, 'ALREADY_MEMBER')
        return addCorsHeaders(response)
      }

      // Use transaction to ensure atomicity
      const tx = await getTransactionClient(authResult.user!.id)

      try {
        // Add user as team member
        const [member] = await tx.query<TeamMember>(
          `INSERT INTO "team_members" ("teamId", "userId", role, "invitedBy", "joinedAt")
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [invitation.teamId, authResult.user!.id, invitation.role, invitation.invitedBy]
        )

        if (!member) {
          throw new Error('Failed to create team member')
        }

        // Update invitation status
        await tx.query(
          `UPDATE "team_invitations"
           SET status = 'accepted', "acceptedAt" = NOW(), "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [invitation.id]
        )

        await tx.commit()

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
          [member.id],
          authResult.user!.id
        )

        const response = createApiResponse(memberWithUser, { created: true }, 201)
        return addCorsHeaders(response)
      } catch (error) {
        await tx.rollback()
        throw error
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'write');
