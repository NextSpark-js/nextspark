import { NextRequest, NextResponse } from 'next/server'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { TeamService } from '@nextsparkjs/core/lib/services'
import {
  ACTIVE_TEAM_COOKIE,
  ACTIVE_TEAM_COOKIE_MAX_AGE,
  activeTeamCookieValue,
} from '@nextsparkjs/core/lib/teams/active-team-cookie'
import { z } from 'zod'

const switchTeamSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

// POST /api/v1/teams/switch - Switch active team context
export const POST = withRateLimitTier(withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth. Only teams:read: this endpoint changes
    // which team the caller sees, it never writes team data (#93).
    const authResult = await authenticateRequest(req, { requiredScope: 'teams:read' })

    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // The active team is remembered per browser session, in the activeTeamId
    // cookie. An API key chooses the team on each request with x-team-id, so for
    // it there is nothing to switch.
    if (authResult.type !== 'session' || !authResult.sessionId) {
      const response = createApiError(
        'API keys choose the team on each request with the x-team-id header',
        400,
        null,
        'SESSION_REQUIRED'
      )
      return addCorsHeaders(response, req)
    }

    const body = await req.json()
    const validatedData = switchTeamSchema.parse(body)

    try {
      // Use the TeamService.switchActive (verifies membership)
      await TeamService.switchActive(authResult.user!.id, validatedData.teamId)

      const response = createApiResponse({
        success: true,
        teamId: validatedData.teamId,
        message: 'Active team switched successfully',
      })

      // Remember the team for server-side reads (the dashboard layouts through
      // the proxy, server actions, resolveTeamContext), bound to this session so
      // a later session on the same browser does not inherit it.
      // SECURITY: httpOnly prevents client-side JS manipulation
      response.cookies.set(ACTIVE_TEAM_COOKIE, activeTeamCookieValue(authResult.sessionId, validatedData.teamId), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ACTIVE_TEAM_COOKIE_MAX_AGE,
      })

      return addCorsHeaders(response, req)
    } catch (error) {
      if (error instanceof Error && error.message === 'User is not a member of this team') {
        const response = createApiError(
          'You are not a member of this team',
          403,
          null,
          'NOT_TEAM_MEMBER'
        )
        return addCorsHeaders(response, req)
      }

      throw error
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { issues?: unknown[] }
      const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response, req)
    }

    console.error('Error switching team:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, req)
  }
}), 'write')
