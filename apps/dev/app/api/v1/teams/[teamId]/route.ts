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
import { updateTeamSchema, ownerUpdateTeamSchema } from '@nextsparkjs/core/lib/teams/schema'
import { TeamService, MembershipService } from '@nextsparkjs/core/lib/services'
import type { Team, TeamRole } from '@nextsparkjs/core/lib/teams/types'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams/:teamId - Get team details
export const GET = withApiLogging(
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
      const userRole = await queryOneWithRLS<{ role: TeamRole }>(
        'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
        [teamId, authResult.user!.id],
        authResult.user!.id
      )

      if (!userRole) {
        const response = createApiError('Team not found or access denied', 404, null, 'TEAM_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Fetch team with member count
      const team = await queryOneWithRLS<Team & { memberCount: string; userRole: TeamRole }>(
        `SELECT
          t.*,
          COUNT(DISTINCT tm.id) as "memberCount",
          $2::text as "userRole"
        FROM "teams" t
        LEFT JOIN "team_members" tm ON t.id = tm."teamId"
        WHERE t.id = $1
        GROUP BY t.id`,
        [teamId, userRole.role],
        authResult.user!.id
      )

      if (!team) {
        const response = createApiError('Team not found', 404, null, 'TEAM_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const responseData = {
        ...team,
        memberCount: parseInt(team.memberCount, 10),
      }

      const response = createApiResponse(responseData)
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error fetching team:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)

// PATCH /api/v1/teams/:teamId - Update team (owners/admins only)
export const PATCH = withApiLogging(
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

      const body = await req.json()

      // FIX #2: Check owner-only requirement FIRST for name/description fields
      // This provides clearer error messages to users
      // Issue: https://github.com/NextSpark-js/nextspark/pull/1 (Issue #2)
      // FIX #1: Use 'in' operator to check property existence (not value truthiness)
      // This prevents type coercion bypass with falsy values (empty string, null, 0, false)
      // Issue: https://github.com/NextSpark-js/nextspark/pull/1 (Issue #1)
      const isOwnerOnlyUpdate = 'name' in body || 'description' in body

      if (isOwnerOnlyUpdate) {
        // Fetch team to verify ownership BEFORE other checks
        const team = await TeamService.getById(teamId, authResult.user!.id)

        if (!team || team.ownerId !== authResult.user!.id) {
          const response = createApiError(
            'Only team creators can edit team name and description',
            403,
            null,
            'OWNER_ONLY'
          )
          return addCorsHeaders(response)
        }

        // FIX #3: Use ownerUpdateTeamSchema for stricter validation of owner-only fields
        // Issue: https://github.com/NextSpark-js/nextspark/pull/1 (Issue #3)
        const validatedData = ownerUpdateTeamSchema.parse(body)

        // Proceed with owner update (skip general permission check)
      } else {
        // Check general teams.update permission for non-owner-only fields
        const membership = await MembershipService.get(authResult.user!.id, teamId)
        const actionResult = membership.canPerformAction('teams.update')

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
      }

      // Validate with appropriate schema based on update type
      const schema = isOwnerOnlyUpdate ? ownerUpdateTeamSchema : updateTeamSchema
      const validatedData = schema.parse(body) as Record<string, unknown>

      // Check if slug is being changed and if it's available
      if ('slug' in validatedData && typeof validatedData.slug === 'string') {
        const slugAvailable = await TeamService.isSlugAvailable(validatedData.slug, teamId)
        if (!slugAvailable) {
          const response = createApiError('Team slug already exists', 409, null, 'SLUG_EXISTS')
          return addCorsHeaders(response)
        }
      }

      // Build dynamic update query
      const updates = []
      const values = []
      let paramCount = 1

      if ('name' in validatedData && validatedData.name !== undefined) {
        updates.push(`name = $${paramCount++}`)
        values.push(validatedData.name)
      }

      if ('slug' in validatedData && validatedData.slug !== undefined) {
        updates.push(`slug = $${paramCount++}`)
        values.push(validatedData.slug)
      }

      if ('description' in validatedData && validatedData.description !== undefined) {
        updates.push(`description = $${paramCount++}`)
        values.push(validatedData.description)
      }

      if ('avatarUrl' in validatedData && validatedData.avatarUrl !== undefined) {
        updates.push(`"avatarUrl" = $${paramCount++}`)
        values.push(validatedData.avatarUrl)
      }

      if ('settings' in validatedData && validatedData.settings !== undefined) {
        updates.push(`settings = $${paramCount++}`)
        values.push(JSON.stringify(validatedData.settings))
      }

      if (updates.length === 0) {
        const response = createApiError('No fields to update', 400, null, 'NO_FIELDS')
        return addCorsHeaders(response)
      }

      updates.push(`"updatedAt" = CURRENT_TIMESTAMP`)
      values.push(teamId)

      const query = `
        UPDATE "teams"
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await mutateWithRLS(query, values, authResult.user!.id)

      if (result.rows.length === 0) {
        const response = createApiError('Team not found', 404, null, 'TEAM_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Fetch team with member count
      const teamWithCount = await queryOneWithRLS<Team & { memberCount: string }>(
        `SELECT
          t.*,
          COUNT(DISTINCT tm.id) as "memberCount"
        FROM "teams" t
        LEFT JOIN "team_members" tm ON t.id = tm."teamId"
        WHERE t.id = $1
        GROUP BY t.id`,
        [teamId],
        authResult.user!.id
      )

      const responseData = {
        ...teamWithCount,
        memberCount: parseInt(teamWithCount?.memberCount || '0', 10),
      }

      const response = createApiResponse(responseData)
      return addCorsHeaders(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response)
      }

      console.error('Error updating team:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)

// DELETE /api/v1/teams/:teamId - Delete team (owners only, NOT personal teams)
export const DELETE = withApiLogging(
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

      // Use the TeamService.delete (handles owner check and personal team protection)
      try {
        await TeamService.delete(teamId, authResult.user!.id)

        const response = createApiResponse({ deleted: true, id: teamId })
        return addCorsHeaders(response)
      } catch (error) {
        if (error instanceof Error && error.message === 'Only team owner can delete the team') {
          const response = createApiError(
            'Insufficient permissions. Only team owner can delete the team.',
            403,
            null,
            'INSUFFICIENT_PERMISSIONS'
          )
          return addCorsHeaders(response)
        }

        if (error instanceof Error && error.message === 'Team not found') {
          const response = createApiError('Team not found', 404, null, 'TEAM_NOT_FOUND')
          return addCorsHeaders(response)
        }

        if (error instanceof Error && error.message === 'Personal teams cannot be deleted') {
          const response = createApiError('Personal teams cannot be deleted', 403, null, 'PERSONAL_TEAM_DELETE_FORBIDDEN')
          return addCorsHeaders(response)
        }

        throw error
      }
    } catch (error) {
      console.error('Error deleting team:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)
