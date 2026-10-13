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
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { isSuperAdmin } from '@nextsparkjs/core/lib/api/auth/permissions'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { memberListQuerySchema } from '@nextsparkjs/core/lib/teams/schema'
import { TeamMemberService, MembershipService, TeamInvitationService } from '@nextsparkjs/core/lib/services'
import type { TeamMember } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

// GET /api/v1/teams/:teamId/members - List team members
export const GET = withRateLimitTier(withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ teamId: string }> }): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth; the API-key scope is declared at the entry
      // point, which fails closed for keys that lack it (#93).
      const authResult = await authenticateRequest(req, { requiredScope: 'teams:read' })

      if (!authResult.success) {
        return createAuthFailureResponse(authResult)
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId } = await params

      // Validate that teamId is not empty
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response, req)
      }

      // Superadmins can view members of any team
      const userIsSuperAdmin = isSuperAdmin(authResult)

      // Listing the roster is gated by the 'team.members.view' permission, not
      // bare membership — membership only proves you belong to the team, not
      // that your role is allowed to see who else does (a theme may grant
      // 'team.members.view' to a subset of roles; see GHSA-rw2j-9mxg-rx98).
      if (!userIsSuperAdmin) {
        const membership = await MembershipService.get(authResult.user!.id, teamId)
        const actionResult = membership.canPerformAction('team.members.view')

        if (!actionResult.allowed) {
          const response = createApiError('Team not found or access denied', 404, null, 'TEAM_NOT_FOUND')
          return addCorsHeaders(response, req)
        }
      }

      // Parse query parameters (filter out null values so Zod defaults work)
      const { searchParams } = new URL(req.url)
      const queryParams = Object.fromEntries(
        Object.entries({
          page: searchParams.get('page'),
          limit: searchParams.get('limit'),
          role: searchParams.get('role'),
          search: searchParams.get('search'),
        }).filter(([, value]) => value !== null && value !== '')
      )

      const validatedQuery = memberListQuerySchema.parse(queryParams)
      const { page, limit, role, search } = validatedQuery
      const offset = (page - 1) * limit

      // Build WHERE clause based on filters
      let whereClause = 'WHERE tm."teamId" = $1'
      const queryValues: unknown[] = [teamId]
      let paramCount = 2

      if (role) {
        whereClause += ` AND tm.role = $${paramCount}`
        queryValues.push(role)
        paramCount++
      }

      if (search) {
        whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`
        queryValues.push(`%${search}%`)
        paramCount++
      }

      // Add pagination params
      queryValues.push(limit, offset)

      const members = await queryWithRLS<
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
        ${whereClause}
        ORDER BY
          CASE tm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'member' THEN 3
            WHEN 'viewer' THEN 4
          END,
          tm."joinedAt" ASC
        LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        queryValues,
        authResult.user!.id
      )

      // Get total count for pagination
      const totalResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM "team_members" tm
         INNER JOIN "users" u ON tm."userId" = u.id
         ${whereClause}`,
        queryValues.slice(0, -2), // Remove limit and offset
        authResult.user!.id
      )

      const total = parseInt(totalResult[0]?.count || '0', 10)
      const paginationMeta = createPaginationMeta(page, limit, total)

      const response = createApiResponse(members, paginationMeta)
      return addCorsHeaders(response, req)
    } catch (error) {
      console.error('Error fetching team members:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
), 'read')

// POST /api/v1/teams/:teamId/members - Invite new member (creates invitation)
export const POST = withRateLimitTier(withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ teamId: string }> }): Promise<NextResponse> => {
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

      const result = await TeamInvitationService.create({
        teamId: (await params).teamId,
        actor: { id: authResult.user!.id, email: authResult.user!.email },
        input: await req.json().catch(() => undefined), // unparsable body: the schema answers 400
      })

      if (result.success === false) {
        // A permission refusal carries its reason next to `error`; the rest use the standard error body
        const response = result.code === 'FORBIDDEN'
          ? NextResponse.json({ success: false, error: result.error, ...result.details }, { status: result.status })
          : createApiError(result.error, result.status, result.details ?? null, result.code)
        return addCorsHeaders(response, req)
      }

      const invitation = result.invitation

      const response = createApiResponse(invitation, { created: true }, 201)
      return addCorsHeaders(response, req)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response, req)
      }

      console.error('Error creating invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
), 'write')
