import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import type { TeamInvitation } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/team-invitations/:token - Get invitation details (public endpoint for preview)
export const GET = withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> => {
    try {
      const { token } = await params

      // Validate that token is not empty
      if (!token || token.trim() === '') {
        const response = createApiError('Invitation token is required', 400, null, 'MISSING_TOKEN')
        return addCorsHeaders(response)
      }

      // Get invitation by token with team and inviter details
      const invitation = await queryOne<
        TeamInvitation & {
          teamName: string
          inviterName: string | null
          inviterEmail: string
        }
      >(
        `SELECT
          ti.*,
          t.name as "teamName",
          u.name as "inviterName",
          u.email as "inviterEmail"
        FROM "team_invitations" ti
        INNER JOIN "teams" t ON ti."teamId" = t.id
        INNER JOIN "users" u ON ti."invitedBy" = u.id
        WHERE ti.token = $1`,
        [token]
      )

      if (!invitation) {
        const response = createApiError('Invitation not found', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Check if invitation has expired
      const expiresAt = new Date(invitation.expiresAt)
      if (expiresAt < new Date()) {
        const response = createApiError('Invitation has expired', 410, null, 'INVITATION_EXPIRED')
        return addCorsHeaders(response)
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        const response = createApiError(
          `Invitation has already been ${invitation.status}`,
          409,
          null,
          `INVITATION_${invitation.status.toUpperCase()}`
        )
        return addCorsHeaders(response)
      }

      // Return public invitation details (don't expose sensitive data)
      const publicDetails = {
        teamName: invitation.teamName,
        inviterName: invitation.inviterName || invitation.inviterEmail,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expiresAt
      }

      const response = createApiResponse(publicDetails)
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error fetching invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)
