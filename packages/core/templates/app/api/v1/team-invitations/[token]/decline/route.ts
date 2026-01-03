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
import { checkRateLimit } from '@nextsparkjs/core/lib/api/rate-limit'
import { RATE_LIMITS } from '@nextsparkjs/core/lib/api/keys'
import type { TeamInvitation } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// POST /api/v1/team-invitations/:token/decline - Decline invitation
export const POST = withApiLogging(
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

      // Update invitation status to declined
      const result = await mutateWithRLS(
        `UPDATE "team_invitations"
         SET status = 'declined', "declinedAt" = NOW(), "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [invitation.id],
        authResult.user!.id
      )

      if (result.rows.length === 0) {
        const response = createApiError('Invitation not found', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const declinedInvitation = result.rows[0]

      const response = createApiResponse(declinedInvitation)
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error declining invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)
