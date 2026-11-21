import { NextRequest, NextResponse } from 'next/server';
import { createApiError, searchTermTooLongError } from '@nextsparkjs/core/lib/api/error-response';
import { containsPattern, LIKE_ESCAPE_CLAUSE } from '@nextsparkjs/core/lib/utils/like-pattern';
import { parsePaginationParams } from '@nextsparkjs/core/lib/api/pagination';
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import type { User } from '@nextsparkjs/core/types/user.types';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response';
import { SYSTEM_ADMIN_TEAM_ID } from '@nextsparkjs/core/lib/api/auth/dual-auth';
import { SUSPENDED_ROLE } from '@nextsparkjs/core/lib/auth/suspension';

interface GlobalCounts {
  total: number;
  superadmins: number;
  verified: number;
  unverified: number;
  suspended: number;
  active: number;
}

// The role an admin acts on: a suspended user is the role they come back with (restoredRole)
const EFFECTIVE_ROLE_SQL = `(CASE WHEN role = '${SUSPENDED_ROLE}' THEN COALESCE("roleBeforeSuspension", 'member') ELSE role END)`;

/**
 * GET /api/superadmin/users
 *
 * Retrieves users with pagination, search, and filters.
 * Only accessible by superadmin or developer users.
 *
 * Query params:
 * - search: Filter by name or email
 * - role: Filter by role (member, developer): a suspended user counts as the role they come back with
 * - status: Filter by status (active, suspended, unverified, verified): suspended is the account state, unverified
 *   and verified the email's
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
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get the current session using Better Auth
    const session = await getAuthorizationSession(request.headers);

    // Check if user is authenticated
    if (!session?.user) {
      return createApiError('Unauthorized - No session found', 401, undefined, 'AUTHENTICATION_REQUIRED');
    }

    // Check if user is superadmin or developer
    if (session.user.role !== 'superadmin' && session.user.role !== 'developer') {
      return createApiError('Forbidden - Superadmin or developer access required', 403, undefined, 'FORBIDDEN');
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const statusFilter = searchParams.get('status') || '';
    const tab = searchParams.get('tab') || 'users'; // users, superadmins, all
    const { page, limit, offset } = parsePaginationParams(request, 20);

    const tooLong = searchTermTooLongError(search);
    if (tooLong) return tooLong;

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

        // Additional role filter for regular users: a suspended user is the role they come back with. The legacy
        // `role=suspended` still lists the suspended ones
        if (roleFilter && roleFilter !== 'superadmin') {
          conditions.push(roleFilter === SUSPENDED_ROLE
            ? `role = $${paramIndex}`
            : `${EFFECTIVE_ROLE_SQL} = $${paramIndex}`);
          params.push(roleFilter);
          paramIndex++;
        }
      }

      // Search filter
      if (search) {
        conditions.push(`(
          "firstName" ILIKE $${paramIndex} ${LIKE_ESCAPE_CLAUSE} OR
          "lastName" ILIKE $${paramIndex} ${LIKE_ESCAPE_CLAUSE} OR
          email ILIKE $${paramIndex} ${LIKE_ESCAPE_CLAUSE} OR
          CONCAT("firstName", ' ', "lastName") ILIKE $${paramIndex} ${LIKE_ESCAPE_CLAUSE}
        )`);
        params.push(containsPattern(search));
        paramIndex++;
      }

      // Status filter
      if (statusFilter === 'suspended') {
        conditions.push(`role = '${SUSPENDED_ROLE}'`);
      } else if (statusFilter === 'active') {
        conditions.push(`role != '${SUSPENDED_ROLE}'`);
      } else if (statusFilter === 'verified') {
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
        "roleBeforeSuspension",
        "emailVerified",
        "createdAt",
        "updatedAt",
        (SELECT COUNT(*)::int FROM "team_members" tm WHERE tm."userId" = "users".id) AS "teamCount",
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT t.id, t.name FROM "team_members" tm JOIN "teams" t ON t.id = tm."teamId"
           WHERE tm."userId" = "users".id ORDER BY tm."createdAt" LIMIT 3
         ) x) AS teams
      FROM "users"
      ${regularWhere.whereClause}
      ORDER BY "createdAt" DESC
      ${tab === 'users' ? `LIMIT $${regularWhere.params.length + 1} OFFSET $${regularWhere.params.length + 2}` : ''}
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
        "roleBeforeSuspension",
        "emailVerified",
        "createdAt",
        "updatedAt",
        (SELECT COUNT(*)::int FROM "team_members" tm WHERE tm."userId" = "users".id) AS "teamCount",
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT t.id, t.name FROM "team_members" tm JOIN "teams" t ON t.id = tm."teamId"
           WHERE tm."userId" = "users".id ORDER BY tm."createdAt" LIMIT 3
         ) x) AS teams
      FROM "users"
      ${superadminWhere.whereClause}
      ORDER BY "createdAt" DESC
      ${tab === 'superadmins' ? `LIMIT $${superadminWhere.params.length + 1} OFFSET $${superadminWhere.params.length + 2}` : ''}
    `;

    const superadminCountQuery = `
      SELECT COUNT(*)::int as total
      FROM "users"
      ${superadminWhere.whereClause}
    `;

    // Totals of all users, whatever the search and filters: the summary cards do not move with them
    const globalCountsQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE role = 'superadmin')::int AS superadmins,
        COUNT(*) FILTER (WHERE "emailVerified" = true)::int AS verified,
        COUNT(*) FILTER (WHERE "emailVerified" IS NOT TRUE)::int AS unverified,
        COUNT(*) FILTER (WHERE role = '${SUSPENDED_ROLE}')::int AS suspended,
        COUNT(*) FILTER (WHERE role != '${SUSPENDED_ROLE}')::int AS active
      FROM "users"
    `;

    // Users per role (a suspended user counts as the role they come back with), whatever the filters
    const globalRolesQuery = `
      SELECT ${EFFECTIVE_ROLE_SQL} AS role, COUNT(*)::int AS count
      FROM "users"
      GROUP BY 1
    `;

    // Query for team role distribution
    const teamRoleDistributionQuery = `
      SELECT
        role,
        COUNT(*)::int as count
      FROM "team_members"
      GROUP BY role
    `;

    // Query for teams count: all of them, and the work teams (every team but the system admin one)
    const teamsCountQuery = `
      SELECT COUNT(*)::int as total,
             COUNT(*) FILTER (WHERE id != $1)::int as "workTeams"
      FROM "teams"
    `;

    // Execute all queries in parallel
    // On the service connection after the role check above: team_members has no bypass policy at all, so under RLS
    // even a superadmin would see only their own memberships.
    const [
      regularUsers,
      regularCount,
      superadmins,
      superadminCount,
      globalCounts,
      globalRoles,
      teamRoleDistribution,
      teamsCount
    ] = await Promise.all([
      queryWithRLS(regularUsersQuery, tab === 'users' ? [...regularWhere.params, limit, offset] : regularWhere.params, session.user.id, { service: true }) as Promise<User[]>,
      queryWithRLS(regularCountQuery, regularWhere.params, session.user.id, { service: true }) as Promise<{ total: number }[]>,
      queryWithRLS(superadminsQuery, tab === 'superadmins' ? [...superadminWhere.params, limit, offset] : superadminWhere.params, session.user.id, { service: true }) as Promise<User[]>,
      queryWithRLS(superadminCountQuery, superadminWhere.params, session.user.id, { service: true }) as Promise<{ total: number }[]>,
      queryWithRLS(globalCountsQuery, [], session.user.id, { service: true }) as Promise<GlobalCounts[]>,
      queryWithRLS(globalRolesQuery, [], session.user.id, { service: true }) as Promise<{ role: string; count: number }[]>,
      queryWithRLS(teamRoleDistributionQuery, [], session.user.id, { service: true }) as Promise<{ role: string; count: number }[]>,
      queryWithRLS(teamsCountQuery, [SYSTEM_ADMIN_TEAM_ID], session.user.id, { service: true }) as Promise<{ total: number; workTeams: number }[]>
    ]);

    const regularTotal = regularCount[0]?.total || 0;
    const superadminTotal = superadminCount[0]?.total || 0;

    const global: GlobalCounts = globalCounts?.[0] ?? { total: 0, superadmins: 0, verified: 0, unverified: 0, suspended: 0, active: 0 };

    // Users per role, all users
    const roleCounts: Record<string, number> = {};
    for (const { role, count } of globalRoles ?? []) roleCounts[role] = count;

    // Build status distribution object
    const statusDist = {
      verified: global.verified,
      unverified: global.unverified,
      active: global.active,
      suspended: global.suspended,
    };

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
    const formatUser = (user: User & { roleBeforeSuspension?: string | null; teamCount?: number; teams?: { id: string; name: string }[] }) => ({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: user.role,
      roleBeforeSuspension: user.role === 'suspended' ? user.roleBeforeSuspension ?? null : null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // How many teams the user is in, and the first three
      teamCount: user.teamCount ?? 0,
      teams: user.teams ?? [],
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    });

    // Prepare response data
    const responseData = {
      regularUsers: regularUsers.map(formatUser),
      superadmins: superadmins.map(formatUser),
      // Every number but `matching` is of all users, whatever the search and filters
      counts: {
        total: global.total,
        regularUsers: global.total - global.superadmins,
        superadmins: global.superadmins,
        // what the search and filters leave, per tab
        matching: {
          total: regularTotal + superadminTotal,
          regularUsers: regularTotal,
          superadmins: superadminTotal
        },
        teams: teamsCount?.[0]?.total || 0,
        workTeams: teamsCount?.[0]?.workTeams || 0,
        byRole: roleCounts,
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

    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR', { message: 'Failed to retrieve users data' });
  }
}, 'read');

/**
 * POST /api/superadmin/users
 *
 * Future endpoint for user management actions (create, update roles, etc.)
 * Currently returns not implemented.
 */
export const POST = withRateLimitTier(async () => {
  return createApiError('Not implemented yet', 501, undefined, 'HTTP_501');
}, 'write');

/**
 * PUT /api/superadmin/users
 *
 * Future endpoint for bulk user operations
 * Currently returns not implemented.
 */
export const PUT = withRateLimitTier(async () => {
  return createApiError('Not implemented yet', 501, undefined, 'HTTP_501');
}, 'write');

export const OPTIONS = corsPreflight;
