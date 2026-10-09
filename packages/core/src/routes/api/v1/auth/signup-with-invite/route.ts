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
import { AUTH_CONFIG, I18N_CONFIG } from '@nextsparkjs/core/lib/config'
import { isPasswordLoginEnabled } from '@nextsparkjs/core/lib/auth/auth-methods'
import { withSignupContext } from '@nextsparkjs/core/lib/auth-context'
import { isRegistrationRefusal } from '@nextsparkjs/core/lib/auth/registration-errors'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

interface SignupWithInviteBody {
  email: string
  /** Ignored when password login is off: the account then signs in with an email code. */
  password?: string
  firstName?: string
  lastName?: string
  inviteToken: string
}

// POST /api/v1/auth/signup-with-invite - Create account and auto-accept invitation
export const POST = withRateLimitTier(withApiLogging(
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      // With password login off the account is created without a password
      // (OTP-only): the invitee signs in with an email code.
      const passwordLogin = isPasswordLoginEnabled(AUTH_CONFIG)

      const body: SignupWithInviteBody = await req.json()
      const { email, password, firstName, lastName, inviteToken } = body

      // Validate required fields
      if (!email || (passwordLogin && !password) || !inviteToken) {
        const response = createApiError(
          passwordLogin ? 'Email, password, and invitation token are required' : 'Email and invitation token are required',
          400,
          null,
          'MISSING_FIELDS'
        )
        return addCorsHeaders(response, req)
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        const response = createApiError('Invalid email format', 400, null, 'INVALID_EMAIL')
        return addCorsHeaders(response, req)
      }

      // Validate password length (min 8 characters as per Better Auth config)
      if (passwordLogin && password!.length < 8) {
        const response = createApiError(
          'Password must be at least 8 characters',
          400,
          null,
          'INVALID_PASSWORD'
        )
        return addCorsHeaders(response, req)
      }

      // Step 1: Validate the invitation token via the service pool (RLS bypass).
      // The invitee has no session yet, so the unguessable token IS the
      // credential. Passing a 'system' string as the userId does NOT bypass RLS
      // — it sets a bogus RLS context on the gated pool, so under enforced RLS
      // the row is invisible and the lookup returns null (false "not found").
      const invitation = await queryOneWithRLS<TeamInvitation>(
        'SELECT * FROM "team_invitations" WHERE token = $1',
        [inviteToken],
        undefined,
        { service: true }
      )

      if (!invitation) {
        const response = createApiError('Invitation not found', 404, null, 'INVITATION_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      // Verify invitation is for the correct email
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        const response = createApiError(
          'This invitation was sent to a different email address',
          403,
          null,
          'EMAIL_MISMATCH'
        )
        return addCorsHeaders(response, req)
      }

      // Check if invitation is pending
      if (invitation.status !== 'pending') {
        const response = createApiError(
          `Invitation has already been ${invitation.status}`,
          409,
          null,
          'INVITATION_NOT_PENDING'
        )
        return addCorsHeaders(response, req)
      }

      // Check if invitation has expired
      const expiresAt = new Date(invitation.expiresAt)
      if (expiresAt < new Date()) {
        const response = createApiError('Invitation has expired', 410, null, 'INVITATION_EXPIRED')
        return addCorsHeaders(response, req)
      }

      // Step 2: Create the user. Wrapped in the signup context to skip automatic
      // team creation (the user is added to the invited team instead).
      let userId: string | undefined
      const signupContext = { skipTeamCreation: true, invitedTeamId: invitation.teamId }
      const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || ''
      if (passwordLogin) {
        // Better Auth's sign-up creates the user and its password account
        const signUpRequest = new Request(`${process.env.NEXT_PUBLIC_APP_URL}${withBasePath('/api/auth/sign-up/email')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            name,
            firstName,
            lastName,
            language: I18N_CONFIG.defaultLocale,
          }),
        })

        const signUpResponse = await withSignupContext(signupContext, () => auth.handler(signUpRequest)) as Response

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
            return addCorsHeaders(response, req)
          }

          const response = createApiError(
            errorData.message || 'Failed to create account',
            signUpResponse.status,
            null,
            isRegistrationRefusal(errorData.code) ? errorData.code : 'SIGNUP_FAILED'
          )
          return addCorsHeaders(response, req)
        }

        // Parse response to get user data
        const signUpData = await signUpResponse.json()
        userId = signUpData.user?.id
      } else {
        // The user row only, as the email-otp plugin creates it on a first code sign-in
        const { internalAdapter } = await auth.$context
        if (await internalAdapter.findUserByEmail(email.toLowerCase())) {
          const response = createApiError(
            'An account with this email already exists. Please sign in instead.',
            409,
            null,
            'USER_ALREADY_EXISTS'
          )
          return addCorsHeaders(response, req)
        }
        let user: { id: string } | null
        try {
          user = await withSignupContext(signupContext, () => internalAdapter.createUser({
            email: email.toLowerCase(),
            emailVerified: true,
            name,
            firstName,
            lastName,
            language: I18N_CONFIG.defaultLocale,
          }))
        } catch (error) {
          // The registration hook refuses with a 403 APIError carrying its code (registration.mode rules)
          const message = error instanceof Error ? error.message : ''
          const code = (error as { body?: { code?: string } }).body?.code
          if (isRegistrationRefusal(code)) {
            return addCorsHeaders(createApiError(message, 403, null, code), req)
          }
          // The same email created between the lookup above and this insert
          if ((error as { code?: string }).code === '23505' || /duplicate key/i.test(message)) {
            const response = createApiError(
              'An account with this email already exists. Please sign in instead.',
              409,
              null,
              'USER_ALREADY_EXISTS'
            )
            return addCorsHeaders(response, req)
          }
          throw error
        }
        if (!user) {
          // A registration hook declined to create the account
          return addCorsHeaders(createApiError('Account creation was refused', 403, null, 'SIGNUP_FAILED'), req)
        }
        userId = user.id
      }

      if (!userId) {
        const response = createApiError(
          'Failed to create account - no user ID returned',
          500,
          null,
          'SIGNUP_FAILED'
        )
        return addCorsHeaders(response, req)
      }

      // Steps 3-4 run via the service pool (RLS bypass). This is a trusted
      // server flow: the invite token was validated above and the account was
      // just created, so there is no invitee session to drive RLS — and a
      // `SET LOCAL app.user_id` context does not reliably propagate to the
      // membership INSERT over a pooled (PgBouncer) connection, which makes the
      // team_members self-join policy intermittently reject it. Writing as the
      // service role sidesteps that; every row carries explicit ids.

      // Step 3: Mark email as verified (skip email verification since invitation proves email ownership)
      await mutateWithRLS(
        'UPDATE "users" SET "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
        [userId],
        undefined,
        { service: true }
      )

      // Step 4: Accept the invitation (add user to team)
      const tx = await getTransactionClient(userId, { service: true })

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
        return addCorsHeaders(response, req)
      } catch (error) {
        await tx.rollback()
        throw error
      }
    } catch (error) {
      console.error('Error in signup-with-invite:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
), 'auth')
