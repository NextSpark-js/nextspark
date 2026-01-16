import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nextsparkjs/core/lib/auth'
import { queryOneWithRLS, mutateWithRLS, getTransactionClient } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import type { TeamInvitation, TeamMember } from '@nextsparkjs/core/lib/teams/types'
import { I18N_CONFIG } from '@nextsparkjs/core/lib/config'
import { withSignupContext } from '@nextsparkjs/core/lib/auth-context'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

interface SignupWithInviteBody {
  email: string
  password: string
  firstName?: string
  lastName?: string
  inviteToken: string
}

// POST /api/v1/auth/signup-with-invite - Create account and auto-accept invitation
export const POST = withRateLimitTier(withApiLogging(
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const body: SignupWithInviteBody = await req.json()
      const { email, password, firstName, lastName, inviteToken } = body

      // Validate required fields
      if (!email || !password || !inviteToken) {
        const response = createApiError(
          'Email, password, and invitation token are required',
          400,
          null,
          'MISSING_FIELDS'
        )
        return addCorsHeaders(response)
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        const response = createApiError('Invalid email format', 400, null, 'INVALID_EMAIL')
        return addCorsHeaders(response)
      }

      // Validate password length (min 8 characters as per Better Auth config)
      if (password.length < 8) {
        const response = createApiError(
          'Password must be at least 8 characters',
          400,
          null,
          'INVALID_PASSWORD'
        )
        return addCorsHeaders(response)
      }

      // Step 1: Validate invitation token (without RLS since user doesn't exist yet)
      const invitation = await queryOneWithRLS<TeamInvitation>(
        'SELECT * FROM "team_invitations" WHERE token = $1',
        [inviteToken],
        'system' // Use system context for initial validation
      )

      if (!invitation) {
        const response = createApiError('Invitation not found', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Verify invitation is for the correct email
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        const response = createApiError(
          'This invitation was sent to a different email address',
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
        const response = createApiError('Invitation has expired', 410, null, 'INVITATION_EXPIRED')
        return addCorsHeaders(response)
      }

      // Step 2: Create user using Better Auth's internal API
      // Wrap in signup context to skip automatic team creation
      // (user will be added to the invited team instead)
      const signUpRequest = new Request(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name: firstName && lastName ? `${firstName} ${lastName}` : firstName || '',
          firstName,
          lastName,
          language: I18N_CONFIG.defaultLocale,
        }),
      })

      // Use signup context to signal that we should skip team creation
      // The user will be added to the invited team instead
      const signUpResponse = await withSignupContext(
        { skipTeamCreation: true, invitedTeamId: invitation.teamId },
        () => auth.handler(signUpRequest)
      ) as Response

      if (!signUpResponse.ok) {
        const errorData = await signUpResponse.json() as { message?: string; code?: string }

        // Check if user already exists
        if (errorData.message?.includes('already exists') || errorData.code === 'USER_ALREADY_EXISTS') {
          const response = createApiError(
            'An account with this email already exists. Please sign in instead.',
            409,
            null,
            'USER_ALREADY_EXISTS'
          )
          return addCorsHeaders(response)
        }

        const response = createApiError(
          errorData.message || 'Failed to create account',
          signUpResponse.status,
          null,
          'SIGNUP_FAILED'
        )
        return addCorsHeaders(response)
      }

      // Parse response to get user data
      const signUpData = await signUpResponse.json()
      const userId = signUpData.user?.id

      if (!userId) {
        const response = createApiError(
          'Failed to create account - no user ID returned',
          500,
          null,
          'SIGNUP_FAILED'
        )
        return addCorsHeaders(response)
      }

      // Step 3: Mark email as verified (skip email verification since invitation proves email ownership)
      await mutateWithRLS(
        'UPDATE "users" SET "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
        [userId],
        userId
      )

      // Step 4: Accept the invitation (add user to team)
      const tx = await getTransactionClient(userId)

      try {
        // Add user as team member
        const [member] = await tx.query<TeamMember>(
          `INSERT INTO "team_members" ("teamId", "userId", role, "invitedBy", "joinedAt")
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [invitation.teamId, userId, invitation.role, invitation.invitedBy]
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

        // Step 5: Return success with user info and redirect URL
        const response = createApiResponse(
          {
            user: {
              id: userId,
              email,
              firstName,
              lastName,
              emailVerified: true,
            },
            teamId: invitation.teamId,
            redirectTo: '/dashboard/settings/teams',
          },
          { created: true },
          201
        )
        return addCorsHeaders(response)
      } catch (error) {
        await tx.rollback()
        throw error
      }
    } catch (error) {
      console.error('Error in signup-with-invite:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'auth')
