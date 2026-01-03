import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nextsparkjs/core/lib/auth';
import { queryWithRLS } from '@nextsparkjs/core/lib/db';

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
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get the current session using Better Auth
    const session = await auth.api.getSession({
      headers: request.headers
    });

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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
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

    // Execute all queries in parallel
    const [userResults, teamsResults, countsResults, metasResults] = await Promise.all([
      queryWithRLS(userQuery, [userId], session.user.id) as Promise<UserResult[]>,
      queryWithRLS(teamsQuery, [userId], session.user.id) as Promise<TeamMembershipResult[]>,
      queryWithRLS(countsQuery, [userId], session.user.id) as Promise<{
        totalTeams: number;
        ownedTeams: number;
      }[]>,
      queryWithRLS(metasQuery, [userId], session.user.id) as Promise<UserMetaResult[]>
    ]);

    // Check if user exists
    if (!userResults || userResults.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve user details'
      },
      { status: 500 }
    );
  }
}

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
 * - change-role: Change user's role (requires 'role' field)
 * - suspend: Suspend the user (sets role to 'suspended')
 * - unsuspend: Restore user's role to 'member'
 * - verify-email: Manually verify user's email
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Get the current session using Better Auth
    const session = await auth.api.getSession({
      headers: request.headers
    });

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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Prevent self-modification
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot modify your own account' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: UserActionBody = await request.json();
    const { action, role } = body;

    // Validate action
    if (!action || !['change-role', 'suspend', 'unsuspend', 'verify-email'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: change-role, suspend, unsuspend, verify-email' },
        { status: 400 }
      );
    }

    // Check if target user exists and get their current role
    const checkUserQuery = `
      SELECT id, role FROM "users" WHERE id = $1
    `;
    const userCheck = await queryWithRLS(checkUserQuery, [userId], session.user.id) as { id: string; role: string }[];

    if (!userCheck || userCheck.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const targetUser = userCheck[0];

    // Prevent modifying other superadmins
    if (targetUser.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot modify other superadmin accounts' },
        { status: 403 }
      );
    }

    let updateQuery = '';
    let updateParams: (string | boolean)[] = [];

    switch (action) {
      case 'change-role':
        // Validate role
        if (!role || !['member', 'colaborator', 'admin'].includes(role)) {
          return NextResponse.json(
            { error: 'Invalid role. Must be one of: member, colaborator, admin' },
            { status: 400 }
          );
        }
        updateQuery = `
          UPDATE "users"
          SET role = $1, "updatedAt" = NOW()
          WHERE id = $2
          RETURNING id, role
        `;
        updateParams = [role, userId];
        break;

      case 'suspend':
        updateQuery = `
          UPDATE "users"
          SET role = 'suspended', "updatedAt" = NOW()
          WHERE id = $1
          RETURNING id, role
        `;
        updateParams = [userId];
        break;

      case 'unsuspend':
        updateQuery = `
          UPDATE "users"
          SET role = 'member', "updatedAt" = NOW()
          WHERE id = $1
          RETURNING id, role
        `;
        updateParams = [userId];
        break;

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
    const result = await queryWithRLS(updateQuery, updateParams, session.user.id) as { id: string }[];

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
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

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to perform user action'
      },
      { status: 500 }
    );
  }
}

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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Get the current session using Better Auth
    const session = await auth.api.getSession({
      headers: request.headers
    });

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

    const { userId } = await params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if target user exists and get their role
    const checkUserQuery = `
      SELECT id, role, email FROM "users" WHERE id = $1
    `;
    const userCheck = await queryWithRLS(checkUserQuery, [userId], session.user.id) as { id: string; role: string; email: string }[];

    if (!userCheck || userCheck.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const targetUser = userCheck[0];

    // Prevent deleting other superadmins
    if (targetUser.role === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot delete other superadmin accounts' },
        { status: 403 }
      );
    }

    // Delete in order to respect foreign key constraints:
    // 1. Delete user's team memberships
    await queryWithRLS(
      `DELETE FROM "team_members" WHERE "userId" = $1`,
      [userId],
      session.user.id
    );

    // 2. Delete user's owned teams (and their members)
    // For simplicity, we'll delete all teams owned by this user (in production, you'd want to transfer ownership)
    await queryWithRLS(
      `DELETE FROM "team_members" WHERE "teamId" IN (SELECT id FROM "teams" WHERE "ownerId" = $1)`,
      [userId],
      session.user.id
    );
    await queryWithRLS(
      `DELETE FROM "teams" WHERE "ownerId" = $1`,
      [userId],
      session.user.id
    );

    // 4. Delete user sessions
    await queryWithRLS(
      `DELETE FROM "session" WHERE "userId" = $1`,
      [userId],
      session.user.id
    );

    // 5. Delete user accounts (OAuth)
    await queryWithRLS(
      `DELETE FROM "account" WHERE "userId" = $1`,
      [userId],
      session.user.id
    );

    // 6. Delete the user
    await queryWithRLS(
      `DELETE FROM "users" WHERE id = $1`,
      [userId],
      session.user.id
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

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete user'
      },
      { status: 500 }
    );
  }
}
