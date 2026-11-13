import { NextRequest, NextResponse } from 'next/server'
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-sync'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request)
}

// DELETE /api/v1/teams/:teamId/members/me - The signed-in user leaves the team (#459)
export const DELETE = withRateLimitTier(withApiLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
  ): Promise<NextResponse> => {
    try {
      const authResult = await authenticateRequest(req, { requiredScope: 'teams:write' })

      if (!authResult.success) {
        return createAuthFailureResponse(authResult)
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId } = await params

      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response, req)
      }

      // Only where a user has several teams: in single-user mode the only member is the owner, and in single-tenant
      // mode the one team is the whole app (leaving it strands the account; an admin removes a member instead)
      if (APP_CONFIG_MERGED.teams.mode !== 'multi-tenant') {
        const response = createApiError('Leaving a team is not allowed in this mode', 403, null, 'TEAM_LEAVE_DISABLED')
        return addCorsHeaders(response, req)
      }

      // Always the authenticated user: nothing in the request names who leaves
      const userId = authResult.user!.id

      // The team's systemAdmin flag (migration 027) comes along, read under RLS like the membership
      const membership = await queryOneWithRLS<{ role: string; systemAdmin: boolean }>(
        `SELECT tm.role, (t.metadata->>'systemAdmin')::boolean IS TRUE AS "systemAdmin"
         FROM "team_members" tm INNER JOIN "teams" t ON t.id = tm."teamId"
         WHERE tm."teamId" = $1 AND tm."userId" = $2`,
        [teamId, userId],
        userId
      )

      if (!membership) {
        const response = createApiError('You are not a member of this team', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      // The system admin team: 027's trigger enrolls a developer or superadmin when their role changes, and only then,
      // so leaving it would drop the cross-team admin bypass (canBypassTeamContext) for good
      if (membership.systemAdmin) {
        const response = createApiError(
          "Membership of the system admin team follows the user's role",
          403,
          null,
          'SYSTEM_TEAM_LEAVE_DISABLED'
        )
        return addCorsHeaders(response, req)
      }

      if (membership.role === 'owner') {
        const response = createApiError(
          'Team owners cannot leave. Transfer ownership first.',
          403,
          null,
          'OWNER_CANNOT_LEAVE'
        )
        return addCorsHeaders(response, req)
      }

      // On the RLS connection: team_members_delete_policy (migration 033) lets anyone but the owner delete their own
      // row. `role <> 'owner'` keeps an owner out even if they became one since the check above.
      const result = await mutateWithRLS<{ id: string }>(
        `DELETE FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2 AND role <> 'owner' RETURNING id`,
        [teamId, userId],
        userId
      )

      if (result.rows.length === 0) {
        const response = createApiError('You are not a member of this team, or you became its owner', 404, null, 'MEMBER_NOT_FOUND')
        return addCorsHeaders(response, req)
      }

      const response = createApiResponse({ deleted: true, id: result.rows[0].id, teamId })
      return addCorsHeaders(response, req)
    } catch (error) {
      console.error('Error leaving team:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response, req)
    }
  }
), 'write')
