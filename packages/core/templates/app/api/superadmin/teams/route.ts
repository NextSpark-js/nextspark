import { NextRequest, NextResponse } from 'next/server';
import { getTypedSession } from '@nextsparkjs/core/lib/auth';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import { SYSTEM_ADMIN_TEAM_ID } from '@nextsparkjs/core/lib/api/auth/dual-auth';

interface TeamWithStats {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/superadmin/teams
 *
 * Retrieves all teams with owner information and member counts.
 * Only accessible by superadmin or developer users.
 *
 * Query params:
 * - search: Filter by team name or owner email
 * - type: "user" (exclude system admin team) or "system" (only system admin team)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * Returns:
 * - teams: Array of teams with owner info and member counts
 * - counts: Object with team counts
 * - pagination: Pagination info
 */
export async function GET(request: NextRequest) {
  try {
    // Get the current session using Better Auth
    const session = await getTypedSession(request.headers);

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - No session found' },
        { status: 401 }
      );
    }

    // Check if user is superadmin or developer
    if (session.user.role !== 'superadmin' && session.user.role !== 'developer') {
      return NextResponse.json(
        { error: 'Forbidden - Superadmin or developer access required' },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') as 'user' | 'system' | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by type: user (exclude system admin team) or system (only system admin team)
    if (type === 'user') {
      whereConditions.push(`t.id != $${paramIndex}`);
      params.push(SYSTEM_ADMIN_TEAM_ID);
      paramIndex++;
    } else if (type === 'system') {
      whereConditions.push(`t.id = $${paramIndex}`);
      params.push(SYSTEM_ADMIN_TEAM_ID);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(t.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Query for teams with owner info and member counts
    const teamsQuery = `
      SELECT
        t.id,
        t.name,
        t."ownerId",
        COALESCE(u."firstName" || ' ' || u."lastName", u.email) as "ownerName",
        u.email as "ownerEmail",
        COUNT(tm.id)::int as "memberCount",
        t."createdAt",
        t."updatedAt"
      FROM "teams" t
      LEFT JOIN "users" u ON t."ownerId" = u.id
      LEFT JOIN "team_members" tm ON t.id = tm."teamId"
      ${whereClause}
      GROUP BY t.id, t.name, t."ownerId", u."firstName", u."lastName", u.email, t."createdAt", t."updatedAt"
      ORDER BY t."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Query for total count
    const countQuery = `
      SELECT COUNT(DISTINCT t.id)::int as total
      FROM "teams" t
      LEFT JOIN "users" u ON t."ownerId" = u.id
      ${whereClause}
    `;

    // Query for counts by type (user vs system)
    const countsQuery = `
      SELECT
        COUNT(DISTINCT t.id)::int as total,
        COUNT(DISTINCT CASE WHEN t.id != $1 THEN t.id END)::int as "userTeams",
        COUNT(DISTINCT CASE WHEN t.id = $1 THEN t.id END)::int as "systemTeams"
      FROM "teams" t
      LEFT JOIN "users" u ON t."ownerId" = u.id
    `;

    // Execute queries
    const [teams, countResult, countsResult] = await Promise.all([
      queryWithRLS(teamsQuery, [...params, limit, offset], session.user.id) as Promise<TeamWithStats[]>,
      queryWithRLS(countQuery, params, session.user.id) as Promise<{ total: number }[]>,
      queryWithRLS(countsQuery, [SYSTEM_ADMIN_TEAM_ID], session.user.id) as Promise<{ total: number; userTeams: number; systemTeams: number }[]>
    ]);

    const totalCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Build counts object
    const counts = {
      total: countsResult[0]?.total || 0,
      user: countsResult[0]?.userTeams || 0,
      system: countsResult[0]?.systemTeams || 0
    };

    // Prepare response data
    const responseData = {
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        owner: {
          id: team.ownerId,
          name: team.ownerName?.trim() || team.ownerEmail,
          email: team.ownerEmail
        },
        memberCount: team.memberCount,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      })),
      counts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore: page < totalPages
      },
      metadata: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching teams data:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve teams data'
      },
      { status: 500 }
    );
  }
}
