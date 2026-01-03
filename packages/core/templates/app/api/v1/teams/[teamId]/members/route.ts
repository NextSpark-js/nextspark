import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS, queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { isSuperAdmin } from '@nextsparkjs/core/lib/api/auth/permissions'
import { checkRateLimit } from '@nextsparkjs/core/lib/api/rate-limit'
import { RATE_LIMITS } from '@nextsparkjs/core/lib/api/keys'
import { inviteMemberSchema, memberListQuerySchema } from '@nextsparkjs/core/lib/teams/schema'
import { TeamMemberService, MembershipService } from '@nextsparkjs/core/lib/services'
import type { TeamMember, TeamInvitation, TeamRole, Team } from '@nextsparkjs/core/lib/teams/types'
import { EmailFactory } from '@nextsparkjs/core/lib/email/factory'
import { createTeamInvitationEmail } from '@nextsparkjs/core/lib/email/templates'

// Role hierarchy for invite validation (higher number = more power)
const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

// Check if a user can invite to a specific role (same level or below)
function canInviteToRole(actorRole: TeamRole, targetRole: TeamRole): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[targetRole]
}

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams/:teamId/members - List team members
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

      // Superadmins can view members of any team
      const userIsSuperAdmin = isSuperAdmin(authResult)

      // Check if user is a member of the team (unless superadmin)
      if (!userIsSuperAdmin) {
        const isMember = await TeamMemberService.isMember(teamId, authResult.user!.id)

        if (!isMember) {
          const response = createApiError('Team not found or access denied', 404, null, 'TEAM_NOT_FOUND')
          return addCorsHeaders(response)
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
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error fetching team members:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)

// POST /api/v1/teams/:teamId/members - Invite new member (creates invitation)
export const POST = withApiLogging(
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

      // Apply specific rate limit for creating invitations (20 req/min)
      const rateLimitConfig = RATE_LIMITS['teams:invite']
      const rateLimitKey = `invite:create:${authResult.user!.id}`
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

      const { teamId } = await params

      // Validate that teamId is not empty
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      // Check if user has permission to invite members using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('members.invite')

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

      // Get user's role for role hierarchy validation
      const userRole = membership.role as TeamRole

      const body = await req.json()
      const validatedData = inviteMemberSchema.parse(body)

      // Check role hierarchy - users can only invite to same role or below
      if (!canInviteToRole(userRole, validatedData.role)) {
        const response = createApiError(
          `You cannot invite members to a role higher than your own. Your role: ${userRole}, requested role: ${validatedData.role}`,
          403,
          null,
          'ROLE_HIERARCHY_VIOLATION'
        )
        return addCorsHeaders(response)
      }

      // Check if user already exists and is already a member
      const existingUser = await queryOneWithRLS<{ id: string }>(
        'SELECT id FROM "users" WHERE email = $1',
        [validatedData.email],
        authResult.user!.id
      )

      if (existingUser) {
        // Check if already a member
        const existingMember = await queryOneWithRLS<{ id: string }>(
          'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
          [teamId, existingUser.id],
          authResult.user!.id
        )

        if (existingMember) {
          const response = createApiError('User is already a member of this team', 409, null, 'ALREADY_MEMBER')
          return addCorsHeaders(response)
        }
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await queryOneWithRLS<TeamInvitation>(
        `SELECT * FROM "team_invitations"
         WHERE "teamId" = $1 AND email = $2 AND status = 'pending'`,
        [teamId, validatedData.email],
        authResult.user!.id
      )

      if (existingInvitation) {
        const response = createApiError(
          'A pending invitation already exists for this email',
          409,
          null,
          'INVITATION_EXISTS'
        )
        return addCorsHeaders(response)
      }

      // Get team info for email
      const team = await queryOneWithRLS<Team>(
        'SELECT * FROM "teams" WHERE id = $1',
        [teamId],
        authResult.user!.id
      )

      if (!team) {
        const response = createApiError('Team not found', 404, null, 'TEAM_NOT_FOUND')
        return addCorsHeaders(response)
      }

      // Create invitation
      const token = globalThis.crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

      const result = await mutateWithRLS(
        `INSERT INTO "team_invitations" ("teamId", email, role, status, token, "invitedBy", "expiresAt")
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)
         RETURNING *`,
        [teamId, validatedData.email, validatedData.role, token, authResult.user!.id, expiresAt.toISOString()],
        authResult.user!.id
      )

      const invitation = result.rows[0]

      // Build accept URL
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '')
      const acceptUrl = `${baseUrl}/accept-invite/${token}`

      // Send invitation email
      try {
        const emailProvider = EmailFactory.getInstance()
        const inviterName = authResult.user!.email // Use email as inviter name
        const emailContent = createTeamInvitationEmail(
          validatedData.email,
          inviterName,
          team.name,
          validatedData.role,
          acceptUrl,
          '7 days'
        )

        await emailProvider.send({
          to: validatedData.email,
          subject: emailContent.subject,
          html: emailContent.html
        })

        // Log for testing purposes (like email verification)
        console.log('\n' + '🎫'.repeat(30))
        console.log('📨 TEAM INVITATION CREATED')
        console.log('🎫'.repeat(30))
        console.log(`📧 To: ${validatedData.email}`)
        console.log(`👤 Invited by: ${inviterName}`)
        console.log(`🏢 Team: ${team.name}`)
        console.log(`👑 Role: ${validatedData.role}`)
        console.log(`🔗 Accept URL: ${acceptUrl}`)
        console.log('🎫'.repeat(30) + '\n')
      } catch (emailError) {
        // Log error but don't fail the invitation creation
        console.error('Failed to send invitation email:', emailError)
        console.log(`⚠️ Email failed but invitation created. Accept URL: ${acceptUrl}`)
      }

      const response = createApiResponse(invitation, { created: true }, 201)
      return addCorsHeaders(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response)
      }

      console.error('Error creating invitation:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)
