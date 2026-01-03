import { NextRequest, NextResponse } from 'next/server'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { TeamService } from '@nextsparkjs/core/lib/services'
import { z } from 'zod'

const switchTeamSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// POST /api/v1/teams/switch - Switch active team context
export const POST = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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

      // Set cookie for server-side access (layouts, server components)
      // This enables permission validation in [entity]/layout.tsx
      // SECURITY: httpOnly prevents client-side JS manipulation
      response.cookies.set('activeTeamId', validatedData.teamId, {
        path: '/',
        httpOnly: true,  // Security: prevent client-side manipulation
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365  // 1 year
      })

      return addCorsHeaders(response)
    } catch (error) {
      if (error instanceof Error && error.message === 'User is not a member of this team') {
        const response = createApiError(
          'You are not a member of this team',
          403,
          null,
          'NOT_TEAM_MEMBER'
        )
        return addCorsHeaders(response)
      }

      throw error
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { issues?: unknown[] }
      const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }

    console.error('Error switching team:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
})
