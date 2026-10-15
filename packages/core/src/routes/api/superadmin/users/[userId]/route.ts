import { NextRequest, NextResponse } from 'next/server';
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response';
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session';
import { suspendUser, unsuspendUser } from '@nextsparkjs/core/lib/auth/suspension';
import { ASSIGNABLE_USER_ROLES, canActOnUser, canGrantUserRole } from '@nextsparkjs/core/lib/auth/assignable-roles';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response';

interface UserResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TeamMembershipResult {
  teamId: string;
  teamName: string;
  role: string;
  joinedAt: string;
}

interface UserMetaResult {
  id: string;
  metaKey: string;
  metaValue: unknown;
  dataType: string | null;
  isPublic: boolean;
  isSearchable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/superadmin/users/[userId]
 *
 * Retrieves detailed information about a specific user.
 * Only accessible by superadmin or developer users.
 *
 * Returns:
 * - user: User details
 * - teams: Array of team memberships
 * - stats: User statistics
 */
export const GET = withRateLimitTier(async (request: NextRequest, { params }: RouteParams) => {
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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return createApiError('Invalid user ID', 400, undefined, 'VALIDATION_ERROR');
    }

    // Query user details
    const userQuery = `
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
      WHERE id = $1
    `;

    // Query user's team memberships
    const teamsQuery = `
      SELECT
        t.id as "teamId",
        t.name as "teamName",
        tm.role,
        tm."createdAt" as "joinedAt"
      FROM "team_members" tm
      JOIN "teams" t ON tm."teamId" = t.id
      WHERE tm."userId" = $1
      ORDER BY tm."createdAt" DESC
    `;

    // Query for counts
    const countsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM "team_members" WHERE "userId" = $1) as "totalTeams",
        (SELECT COUNT(*)::int FROM "team_members" WHERE "userId" = $1 AND role = 'owner') as "ownedTeams"
    `;

    // Query for user metadata
    const metasQuery = `
      SELECT
        id,
        "metaKey",
        "metaValue",
        "dataType",
        "isPublic",
        "isSearchable",
        "createdAt",
        "updatedAt"
      FROM "users_metas"
      WHERE "userId" = $1
      ORDER BY "metaKey"
    `;

    // Execute all queries in parallel.
    //
    // All four run on the service (RLS-bypass) pool. team_members has no bypass
    // policy, so with the acting admin's own id as RLS context multi-team users
    // were under-reported. Authorization is already enforced above (superadmin/developer
    // role check) and the WHERE clauses scope the rows to the subject user.
    const [userResults, teamsResults, countsResults, metasResults] = await Promise.all([
      queryWithRLS(userQuery, [userId], session.user.id, { service: true }) as Promise<UserResult[]>,
      queryWithRLS(teamsQuery, [userId], session.user.id, { service: true }) as Promise<TeamMembershipResult[]>,
      queryWithRLS(countsQuery, [userId], session.user.id, { service: true }) as Promise<{
        totalTeams: number;
        ownedTeams: number;
      }[]>,
      queryWithRLS(metasQuery, [userId], session.user.id, { service: true }) as Promise<UserMetaResult[]>
    ]);

    // Check if user exists
    if (!userResults || userResults.length === 0) {
      return createApiError('User not found', 404, undefined, 'NOT_FOUND');
    }

    const user = userResults[0];
    const counts = countsResults[0] || { totalTeams: 0, ownedTeams: 0 };

    // Format user data
    const formattedUser = {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Format team memberships
    const formattedTeams = teamsResults.map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      role: team.role,
      joinedAt: team.joinedAt
    }));

    // Format user metas
    const formattedMetas = (metasResults || []).map(meta => ({
      id: meta.id,
      metaKey: meta.metaKey,
      metaValue: meta.metaValue,
      dataType: meta.dataType,
      isPublic: meta.isPublic,
      isSearchable: meta.isSearchable,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    }));

    // Prepare response data
    const responseData = {
      user: formattedUser,
      teams: formattedTeams,
      userMetas: formattedMetas,
      stats: {
        totalTeams: counts.totalTeams,
        ownedTeams: counts.ownedTeams
      },
      metadata: {
        requestedBy: session.user.id,
        requestedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching user details:', error);

    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR', { message: 'Failed to retrieve user details' });
  }
}, 'strict');

interface UserActionBody {
  action: 'change-role' | 'suspend' | 'unsuspend' | 'verify-email';
  role?: string;
}

/**
 * PATCH /api/superadmin/users/[userId]
 *
 * Performs actions on a specific user.
 * Only accessible by superadmin or developer users.
 *
 * Actions:
 * - change-role: Change user's role (requires 'role' field: member, or developer when a developer asks)
 * - suspend: Suspend the user (role 'suspended'), sign out all their sessions and deactivate their API keys
 * - unsuspend: Give a suspended user back the 'member' role (their API keys stay deactivated)
 * - verify-email: Manually verify user's email
 *
 * Nobody can act on their own account. Only a developer acts on a developer or a superadmin.
 */
export const PATCH = withRateLimitTier(async (request: NextRequest, { params }: RouteParams) => {
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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return createApiError('Invalid user ID', 400, undefined, 'VALIDATION_ERROR');
    }

    // Prevent self-modification
    if (userId === session.user.id) {
      return createApiError('Cannot modify your own account', 400, undefined, 'VALIDATION_ERROR');
    }

    // Parse request body
    const parsedBody = await readJsonObject(request);
    if (parsedBody.error) return parsedBody.error;
    const body: UserActionBody = parsedBody.data as unknown as UserActionBody;
    const { action, role } = body;

    // Validate action
    if (!action || !['change-role', 'suspend', 'unsuspend', 'verify-email'].includes(action)) {
      return createApiError('Invalid action. Must be one of: change-role, suspend, unsuspend, verify-email', 400, undefined, 'VALIDATION_ERROR');
    }

    // Check if target user exists and get their current role
    const checkUserQuery = `
      SELECT id, role FROM "users" WHERE id = $1
    `;
    // On the service connection, as GET: the role check above authorizes, and every statement here is scoped to the
    // subject user.
    const userCheck = await queryWithRLS(checkUserQuery, [userId], session.user.id, { service: true }) as { id: string; role: string }[];

    if (!userCheck || userCheck.length === 0) {
      return createApiError('User not found', 404, undefined, 'NOT_FOUND');
    }

    const targetUser = userCheck[0];

    // The developer role ranks above superadmin: only a developer acts on a developer or a superadmin
    if (!canActOnUser(session.user.role, targetUser.role)) {
      return createApiError('Forbidden - Only a developer can modify a developer or superadmin account', 403, undefined, 'FORBIDDEN');
    }

    let updateQuery = '';
    let updateParams: (string | boolean)[] = [];

    switch (action) {
      case 'change-role':
        // The roles users.role accepts (check_users_role) besides superadmin, which is not granted here, and suspended,
        // which the suspend action sets with its sign-out
        if (!role || !(ASSIGNABLE_USER_ROLES as readonly string[]).includes(role)) {
          return createApiError('Invalid role. Must be one of: member, developer', 400, undefined, 'VALIDATION_ERROR');
        }
        // A suspended account comes back only through unsuspend
        if (targetUser.role === 'suspended') {
          return createApiError('User is suspended. Use the unsuspend action to restore access, then change the role', 400, undefined, 'VALIDATION_ERROR');
        }
        if (!canGrantUserRole(session.user.role, role)) {
          return createApiError('Forbidden - Only a developer can grant the developer role', 403, undefined, 'FORBIDDEN');
        }
        updateQuery = `
          UPDATE "users"
          SET role = $1, "updatedAt" = NOW()
          WHERE id = $2
          RETURNING id, role
        `;
        updateParams = [role, userId];
        break;

      case 'suspend': {
        const suspended = await suspendUser(userId, session.user.id);
        if (!suspended) {
          return createApiError('Failed to update user', 500, undefined, 'INTERNAL_ERROR');
        }
        return NextResponse.json({
          success: true,
          action,
          userId,
          message: `User ${action} successful`,
          revoked: suspended,
          metadata: { performedBy: session.user.id, performedAt: new Date().toISOString(), source: 'superadmin-api' }
        });
      }

      case 'unsuspend':
        if (targetUser.role !== 'suspended') {
          return createApiError('User is not suspended', 400, undefined, 'VALIDATION_ERROR');
        }
        if (!(await unsuspendUser(userId, session.user.id))) {
          return createApiError('Failed to update user', 500, undefined, 'INTERNAL_ERROR');
        }
        return NextResponse.json({
          success: true,
          action,
          userId,
          message: `User ${action} successful`,
          metadata: { performedBy: session.user.id, performedAt: new Date().toISOString(), source: 'superadmin-api' }
        });

      case 'verify-email':
        updateQuery = `
          UPDATE "users"
          SET "emailVerified" = true, "updatedAt" = NOW()
          WHERE id = $1
          RETURNING id, "emailVerified"
        `;
        updateParams = [userId];
        break;
    }

    // Execute update
    const result = await queryWithRLS(updateQuery, updateParams, session.user.id, { service: true }) as { id: string }[];

    if (!result || result.length === 0) {
      return createApiError('Failed to update user', 500, undefined, 'INTERNAL_ERROR');
    }

    return NextResponse.json({
      success: true,
      action,
      userId,
      message: `User ${action} successful`,
      metadata: {
        performedBy: session.user.id,
        performedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    });

  } catch (error) {
    console.error('Error performing user action:', error);

    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR', { message: 'Failed to perform user action' });
  }
}, 'strict');

/**
 * DELETE /api/superadmin/users/[userId]
 *
 * Deletes a specific user.
 * Only accessible by superadmin or developer users.
 *
 * This will:
 * - Remove user from all teams
 * - Delete user's personal team
 * - Delete the user account
 */
export const DELETE = withRateLimitTier(async (request: NextRequest, { params }: RouteParams) => {
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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return createApiError('Invalid user ID', 400, undefined, 'VALIDATION_ERROR');
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return createApiError('Cannot delete your own account', 400, undefined, 'VALIDATION_ERROR');
    }

    // Check if target user exists and get their role
    const checkUserQuery = `
      SELECT id, role, email FROM "users" WHERE id = $1
    `;
    // On the service connection, as GET and PATCH (team_members has no bypass policy at all)
    const userCheck = await queryWithRLS(checkUserQuery, [userId], session.user.id, { service: true }) as { id: string; role: string; email: string }[];

    if (!userCheck || userCheck.length === 0) {
      return createApiError('User not found', 404, undefined, 'NOT_FOUND');
    }

    const targetUser = userCheck[0];

    // Only a developer deletes a developer or a superadmin
    if (!canActOnUser(session.user.role, targetUser.role)) {
      return createApiError('Forbidden - Only a developer can delete a developer or superadmin account', 403, undefined, 'FORBIDDEN');
    }

    // Delete in order to respect foreign key constraints:
    // 1. Delete user's team memberships
    await queryWithRLS(
      `DELETE FROM "team_members" WHERE "userId" = $1`,
      [userId],
      session.user.id,
      { service: true }
    );

    // 2. Delete user's owned teams (and their members)
    // For simplicity, we'll delete all teams owned by this user (in production, you'd want to transfer ownership)
    await queryWithRLS(
      `DELETE FROM "team_members" WHERE "teamId" IN (SELECT id FROM "teams" WHERE "ownerId" = $1)`,
      [userId],
      session.user.id,
      { service: true }
    );
    await queryWithRLS(
      `DELETE FROM "teams" WHERE "ownerId" = $1`,
      [userId],
      session.user.id,
      { service: true }
    );

    // 4. Delete user sessions
    await queryWithRLS(
      `DELETE FROM "session" WHERE "userId" = $1`,
      [userId],
      session.user.id,
      { service: true }
    );

    // 5. Delete user accounts (OAuth)
    await queryWithRLS(
      `DELETE FROM "account" WHERE "userId" = $1`,
      [userId],
      session.user.id,
      { service: true }
    );

    // 6. Delete the user
    await queryWithRLS(
      `DELETE FROM "users" WHERE id = $1`,
      [userId],
      session.user.id,
      { service: true }
    );

    return NextResponse.json({
      success: true,
      action: 'delete',
      userId,
      userEmail: targetUser.email,
      message: 'User deleted successfully',
      metadata: {
        performedBy: session.user.id,
        performedAt: new Date().toISOString(),
        source: 'superadmin-api'
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);

    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR', { message: 'Failed to delete user' });
  }
}, 'strict');

export const OPTIONS = corsPreflight;
