import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS, getTransactionClient, queryRows } from '@nextsparkjs/core/lib/db'
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
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { createTeamSchema, teamListQuerySchema } from '@nextsparkjs/core/lib/teams/schema'
import { TeamService } from '@nextsparkjs/core/lib/services'
import type { Team } from '@nextsparkjs/core/lib/teams/types'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-sync'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams - List user's teams
export const GET = withRateLimitTier('read', withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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

    // Parse query parameters (filter out null values so Zod defaults work)
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(
      Object.entries({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sort: searchParams.get('sort'),
        order: searchParams.get('order'),
        scope: searchParams.get('scope'),
      }).filter(([, value]) => value !== null && value !== '')
    )

    const validatedQuery = teamListQuerySchema.parse(queryParams)
    const { page, limit, search, sort, order, scope } = validatedQuery
    const offset = (page - 1) * limit

    // Check if scope=all is requested (requires superadmin)
    const requestAllTeams = scope === 'all'
    if (requestAllTeams && !isSuperAdmin(authResult)) {
      const response = createApiError(
        'Insufficient permissions. Superadmin access required for scope=all.',
        403
      )
      return addCorsHeaders(response)
    }

    // Build WHERE clause based on filters
    // If scope=all (superadmin), don't filter by user
    let whereClause = requestAllTeams ? 'WHERE 1=1' : 'WHERE tm."userId" = $1'
    const queryValues: unknown[] = requestAllTeams ? [] : [authResult.user!.id]
    let paramCount = requestAllTeams ? 1 : 2

    if (search) {
      whereClause += ` AND (t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`
      queryValues.push(`%${search}%`)
      paramCount++
    }

    // Build ORDER BY clause
    const orderByMap: Record<string, string> = {
      createdAt: 't."createdAt"',
      updatedAt: 't."updatedAt"',
      name: 't.name',
    }
    const orderByClause = `${orderByMap[sort]} ${order.toUpperCase()}`

    // Add pagination params
    queryValues.push(limit, offset)

    let teams: (Team & { userRole: string | null; memberCount: string })[]
    let totalResult: { count: string }[]

    if (requestAllTeams) {
      // Superadmin query: get all teams without user membership filter
      teams = await queryRows<Team & { userRole: string | null; memberCount: string }>(
        `SELECT
          t.*,
          NULL as "userRole",
          COUNT(DISTINCT tm.id) as "memberCount"
        FROM "teams" t
        LEFT JOIN "team_members" tm ON t.id = tm."teamId"
        ${whereClause}
        GROUP BY t.id, t.name, t.slug, t.description, t."ownerId", t."avatarUrl",
                 t.settings, t."createdAt", t."updatedAt"
        ORDER BY ${orderByClause}
        LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        queryValues
      )

      // Get total count for pagination (superadmin)
      totalResult = await queryRows<{ count: string }>(
        `SELECT COUNT(DISTINCT t.id) as count
         FROM "teams" t
         ${whereClause}`,
        queryValues.slice(0, -2) // Remove limit and offset
      )
    } else {
      // Regular user query: filter by membership
      teams = await queryWithRLS<Team & { userRole: string; memberCount: string }>(
        `SELECT
          t.*,
          tm.role as "userRole",
          COUNT(DISTINCT tm2.id) as "memberCount"
        FROM "teams" t
        INNER JOIN "team_members" tm ON t.id = tm."teamId"
        LEFT JOIN "team_members" tm2 ON t.id = tm2."teamId"
        ${whereClause}
        GROUP BY t.id, t.name, t.slug, t.description, t."ownerId", t."avatarUrl",
                 t.settings, t."createdAt", t."updatedAt", tm.role
        ORDER BY ${orderByClause}
        LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        queryValues,
        authResult.user!.id
      )

      // Get total count for pagination (regular user)
      totalResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(DISTINCT t.id) as count
         FROM "teams" t
         INNER JOIN "team_members" tm ON t.id = tm."teamId"
         ${whereClause}`,
        queryValues.slice(0, -2), // Remove limit and offset
        authResult.user!.id
      )
    }

    const total = parseInt(totalResult[0]?.count || '0', 10)
    const paginationMeta = createPaginationMeta(page, limit, total)

    // Transform data
    const teamsWithMembers = teams.map((team) => ({
      ...team,
      memberCount: parseInt(team.memberCount, 10),
    }))

    const response = createApiResponse(teamsWithMembers, paginationMeta)
    return addCorsHeaders(response)
  } catch (error) {
    console.error('Error fetching teams:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}))

// POST /api/v1/teams - Create new team
export const POST = withRateLimitTier('write', withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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
    const validatedData = createTeamSchema.parse(body)

    const { mode, options } = APP_CONFIG_MERGED.teams
    const userId = authResult.user!.id

    // Validate if the mode allows creating teams
    if (mode !== 'multi-tenant') {
      const response = createApiError(
        'Team creation is not allowed in this mode',
        403,
        null,
        'TEAM_CREATION_DISABLED'
      )
      return addCorsHeaders(response)
    }

    // Validate allowCreateTeams option
    const allowCreateTeams = options?.allowCreateTeams ?? true
    if (!allowCreateTeams) {
      // Check if user is already owner of any team
      const ownedTeams = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*) as count FROM "team_members"
         WHERE "userId" = $1 AND role = 'owner'`,
        [userId],
        userId
      )

      if (parseInt(ownedTeams[0]?.count || '0', 10) > 0) {
        const response = createApiError(
          'You are already owner of a team. Creating additional teams is not allowed.',
          403,
          null,
          'MAX_TEAMS_REACHED'
        )
        return addCorsHeaders(response)
      }
    }

    // Check if slug is available
    const slugAvailable = await TeamService.isSlugAvailable(validatedData.slug)
    if (!slugAvailable) {
      const response = createApiError('Team slug already exists', 409, null, 'SLUG_EXISTS')
      return addCorsHeaders(response)
    }

    // Use transaction to ensure atomicity
    const tx = await getTransactionClient(userId)

    try {
      // Create team WITHOUT type column
      const [team] = await tx.query<Team>(
        `INSERT INTO "teams" (name, slug, description, "ownerId")
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          validatedData.name,
          validatedData.slug,
          validatedData.description || null,
          userId,
        ]
      )

      if (!team) {
        throw new Error('Failed to create team')
      }

      // Add creator as owner
      await tx.query(
        `INSERT INTO "team_members" ("teamId", "userId", role, "joinedAt")
         VALUES ($1, $2, 'owner', NOW())`,
        [team.id, authResult.user!.id]
      )

      await tx.commit()

      // Fetch team with member count
      const teamWithCount = await queryWithRLS<Team & { memberCount: string }>(
        `SELECT
          t.*,
          COUNT(DISTINCT tm.id) as "memberCount"
        FROM "teams" t
        LEFT JOIN "team_members" tm ON t.id = tm."teamId"
        WHERE t.id = $1
        GROUP BY t.id`,
        [team.id],
        authResult.user!.id
      )

      const responseData = {
        ...teamWithCount[0],
        memberCount: parseInt(teamWithCount[0]?.memberCount || '1', 10),
      }

      const response = createApiResponse(responseData, { created: true }, 201)
      return addCorsHeaders(response)
    } catch (error) {
      await tx.rollback()
      throw error
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { issues?: unknown[] }
      const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }

    console.error('Error creating team:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}))
