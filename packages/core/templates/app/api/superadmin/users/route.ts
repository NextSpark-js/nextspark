import { NextRequest, NextResponse } from 'next/server';
import { getTypedSession } from '@nextsparkjs/core/lib/auth';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import type { User } from '@nextsparkjs/core/types/user.types';

/**
 * GET /api/superadmin/users
 *
 * Retrieves users with pagination, search, and filters.
 * Only accessible by superadmin or developer users.
 *
 * Query params:
 * - search: Filter by name or email
 * - role: Filter by role (member, superadmin, etc.)
 * - status: Filter by email verification status (verified, unverified)
 * - tab: Which tab to paginate (users, superadmins, all)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * Returns:
 * - regularUsers: Array of users excluding superadmins
 * - superadmins: Array of superadmin users
 * - counts: Object with user counts
 * - pagination: Pagination info for the active tab
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
    const roleFilter = searchParams.get('role') || '';
    const statusFilter = searchParams.get('status') || '';
    const tab = searchParams.get('tab') || 'users'; // users, superadmins, all
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const buildWhereClause = (isSuperadmin: boolean) => {
      const conditions: string[] = [];
      const params: (string | boolean)[] = [];
      let paramIndex = 1;

      // Role filter for regular users vs superadmins
      if (isSuperadmin) {
        conditions.push(`role = $${paramIndex}`);
        params.push('superadmin');
        paramIndex++;
      } else {
        conditions.push(`role != $${paramIndex}`);
        params.push('superadmin');
        paramIndex++;

        // Additional role filter for regular users
        if (roleFilter && roleFilter !== 'superadmin') {
          conditions.push(`role = $${paramIndex}`);
          params.push(roleFilter);
          paramIndex++;
        }
      }

      // Search filter
      if (search) {
        conditions.push(`(
          "firstName" ILIKE $${paramIndex} OR
          "lastName" ILIKE $${paramIndex} OR
          email ILIKE $${paramIndex} OR
          CONCAT("firstName", ' ', "lastName") ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Status filter
      if (statusFilter === 'verified') {
        conditions.push(`"emailVerified" = $${paramIndex}`);
        params.push(true);
        paramIndex++;
      } else if (statusFilter === 'unverified') {
        conditions.push(`("emailVerified" = $${paramIndex} OR "emailVerified" IS NULL)`);
        params.push(false);
        paramIndex++;
      }

      return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params
      };
    };

    // Build queries for regular users
    const regularWhere = buildWhereClause(false);
    const regularUsersQuery = `
      SELECT
        id,
        "firstName",
        "lastName",
        email,
        role,
        "emailVerified",
        "createdAt",
        "updatedAt"
      FROM "users"
      ${regularWhere.whereClause}
      ORDER BY "createdAt" DESC
      ${tab === 'users' ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const regularCountQuery = `
      SELECT COUNT(*)::int as total
      FROM "users"
      ${regularWhere.whereClause}
    `;

    // Build queries for superadmins
    const superadminWhere = buildWhereClause(true);
    const superadminsQuery = `
      SELECT
        id,
        "firstName",
        "lastName",
        email,
        role,
        "emailVerified",
        "createdAt",
        "updatedAt"
      FROM "users"
      ${superadminWhere.whereClause}
      ORDER BY "createdAt" DESC
      ${tab === 'superadmins' ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const superadminCountQuery = `
      SELECT COUNT(*)::int as total
      FROM "users"
      ${superadminWhere.whereClause}
    `;

    // Query for status distribution (all users)
    const statusDistributionQuery = `
      SELECT
        CASE WHEN "emailVerified" = true THEN 'verified' ELSE 'unverified' END as status,
        COUNT(*)::int as count
      FROM "users"
      GROUP BY "emailVerified"
    `;

    // Query for team role distribution
    const teamRoleDistributionQuery = `
      SELECT
        role,
        COUNT(*)::int as count
      FROM "team_members"
      GROUP BY role
    `;

    // Query for teams count
    const teamsCountQuery = `
      SELECT COUNT(*)::int as total
      FROM "teams"
    `;

    // Execute all queries in parallel
    const [
      regularUsers,
      regularCount,
      superadmins,
      superadminCount,
      statusDistribution,
      teamRoleDistribution,
      teamsCount
    ] = await Promise.all([
      queryWithRLS(regularUsersQuery, regularWhere.params, session.user.id) as Promise<User[]>,
      queryWithRLS(regularCountQuery, regularWhere.params, session.user.id) as Promise<{ total: number }[]>,
      queryWithRLS(superadminsQuery, superadminWhere.params, session.user.id) as Promise<User[]>,
      queryWithRLS(superadminCountQuery, superadminWhere.params, session.user.id) as Promise<{ total: number }[]>,
      queryWithRLS(statusDistributionQuery, [], session.user.id) as Promise<{ status: string; count: number }[]>,
      queryWithRLS(teamRoleDistributionQuery, [], session.user.id) as Promise<{ role: string; count: number }[]>,
      queryWithRLS(teamsCountQuery, [], session.user.id) as Promise<{ total: number }[]>
    ]);

    const regularTotal = regularCount[0]?.total || 0;
    const superadminTotal = superadminCount[0]?.total || 0;

    // Calculate counts by role
    const roleCounts = regularUsers.reduce((acc: Record<string, number>, user: User) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Build status distribution object
    const statusDist: Record<string, number> = { verified: 0, unverified: 0 };
    statusDistribution.forEach(({ status, count }) => {
      statusDist[status] = count;
    });

    // Build team role distribution object
    const teamRoleDist: Record<string, number> = { owner: 0, admin: 0, member: 0, viewer: 0 };
    teamRoleDistribution.forEach(({ role, count }) => {
      teamRoleDist[role] = count;
    });

    // Determine pagination based on active tab
    let paginationTotal = 0;
    if (tab === 'users') {
      paginationTotal = regularTotal;
    } else if (tab === 'superadmins') {
      paginationTotal = superadminTotal;
    } else {
      paginationTotal = regularTotal + superadminTotal;
    }
    const totalPages = Math.ceil(paginationTotal / limit);

    // Format user data
    const formatUser = (user: User) => ({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    });

    // Prepare response data
    const responseData = {
      regularUsers: regularUsers.map(formatUser),
      superadmins: superadmins.map(formatUser),
      counts: {
        total: regularTotal + superadminTotal,
        regularUsers: regularTotal,
        superadmins: superadminTotal,
        teams: teamsCount[0]?.total || 0,
        byRole: {
          ...roleCounts,
          superadmin: superadminTotal
        },
        statusDistribution: statusDist,
        teamRoleDistribution: teamRoleDist
      },
      pagination: {
        page,
        limit,
        total: paginationTotal,
        totalPages,
        hasMore: page < totalPages
      },
      filters: {
        search,
        role: roleFilter,
        status: statusFilter,
        tab
      },
      metadata: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching users data:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve users data'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/users
 *
 * Future endpoint for user management actions (create, update roles, etc.)
 * Currently returns not implemented.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented yet' },
    { status: 501 }
  );
}

/**
 * PUT /api/superadmin/users
 *
 * Future endpoint for bulk user operations
 * Currently returns not implemented.
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Not implemented yet' },
    { status: 501 }
  );
}
