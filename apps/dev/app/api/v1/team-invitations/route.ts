import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { invitationListQuerySchema } from '@nextsparkjs/core/lib/teams/schema'
import type { TeamInvitation } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/team-invitations - List pending invitations for current user
export const GET = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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

    // Get user email to find invitations
    const userEmail = authResult.user!.email

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const queryParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
    }

    const validatedQuery = invitationListQuerySchema.parse(queryParams)
    const { page, limit, status } = validatedQuery
    const offset = (page - 1) * limit

    // Build WHERE clause based on filters
    let whereClause = 'WHERE ti.email = $1'
    const queryValues: unknown[] = [userEmail]
    let paramCount = 2

    if (status) {
      whereClause += ` AND ti.status = $${paramCount}`
      queryValues.push(status)
      paramCount++
    } else {
      // Default to pending invitations only
      whereClause += ` AND ti.status = $${paramCount}`
      queryValues.push('pending')
      paramCount++
    }

    // Add pagination params
    queryValues.push(limit, offset)

    const invitations = await queryWithRLS<
      TeamInvitation & {
        teamName: string
        teamSlug: string
        inviterName: string | null
        inviterEmail: string
      }
    >(
      `SELECT
        ti.*,
        t.name as "teamName",
        t.slug as "teamSlug",
        u.name as "inviterName",
        u.email as "inviterEmail"
      FROM "team_invitations" ti
      INNER JOIN "teams" t ON ti."teamId" = t.id
      INNER JOIN "users" u ON ti."invitedBy" = u.id
      ${whereClause}
      ORDER BY ti."createdAt" DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      queryValues,
      authResult.user!.id
    )

    // Get total count for pagination
    const totalResult = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM "team_invitations" ti
       ${whereClause}`,
      queryValues.slice(0, -2), // Remove limit and offset
      authResult.user!.id
    )

    const total = parseInt(totalResult[0]?.count || '0', 10)
    const paginationMeta = createPaginationMeta(page, limit, total)

    const response = createApiResponse(invitations, paginationMeta)
    return addCorsHeaders(response)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
})
