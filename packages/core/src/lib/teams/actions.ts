/**
 * @deprecated DEPRECATED - Use service layer instead
 *
 * This file is DEPRECATED. All functions have been migrated to the service layer:
 * - createTeam → TeamService.create()
 * - getGlobalTeam → TeamService.getGlobal()
 * - hasGlobalTeam → TeamService.hasGlobal()
 * - getUserTeamRole → TeamMemberService.getRole(teamId, userId) [NOTE: param order changed!]
 * - checkTeamPermission → TeamMemberService.hasPermission()
 * - isTeamMember → TeamMemberService.isMember(teamId, userId) [NOTE: param order changed!]
 * - isSlugAvailable → TeamService.isSlugAvailable()
 * - switchActiveTeam → TeamService.switchActive()
 * - deleteTeam → TeamService.delete()
 *
 * Import from '../services' instead:
 * import { TeamService, TeamMemberService } from '../services'
 *
 * This file will be removed in a future version.
 */

import { queryWithRLS, queryOneWithRLS, getTransactionClient } from '../db'
import type { Team, TeamMember, TeamRole } from './types'

/**
 * Create Team (UNIFIED function - no type distinction)
 * Used for signup and manual team creation
 *
 * @param userId - The ID of the user creating the team
 * @param name - Optional team name (defaults to user's name + Team)
 * @returns The created Team
 */
export async function createTeam(userId: string, name?: string): Promise<Team> {
  // Fetch user details
  const user = await queryOneWithRLS<{ id: string; email: string; name: string | null }>(
    'SELECT id, email, name FROM "users" WHERE id = $1',
    [userId]
  )

  if (!user) {
    throw new Error('User not found')
  }

  // Generate team slug and name
  const timestamp = Date.now().toString(36)
  const teamSlug = `team-${timestamp}-${userId.substring(0, 4).toLowerCase()}`
  const teamName = name || (user.name ? `${user.name}'s Team` : 'My Team')

  // Use transaction to ensure atomicity
  const tx = await getTransactionClient(userId)

  try {
    // 1. Create team
    const [team] = await tx.query<Team>(
      `INSERT INTO "teams" (name, slug, "ownerId")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teamName, teamSlug, userId]
    )

    if (!team) {
      throw new Error('Failed to create team')
    }

    // 2. Add user as owner
    await tx.query(
      `INSERT INTO "team_members" ("teamId", "userId", role, "joinedAt")
       VALUES ($1, $2, 'owner', NOW())`,
      [team.id, userId]
    )

    // 3. Create default subscription (free plan)
    const [freePlan] = await tx.query<{ id: string }>(
      `SELECT id FROM "plans" WHERE slug = 'free' LIMIT 1`
    )

    if (freePlan) {
      await tx.query(
        `INSERT INTO "subscriptions" ("teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "billingInterval")
         VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '100 years', 'monthly')`,
        [team.id, freePlan.id]
      )
    }

    await tx.commit()

    console.log(`Team created for user ${userId}: ${team.id}`)
    return team
  } catch (error) {
    await tx.rollback()
    console.error(`Failed to create team for user ${userId}:`, error)
    throw error
  }
}

/**
 * Get the global team (for single-tenant mode)
 * Returns the first team found (should be the only one)
 *
 * @returns The global team or null if none exists
 */
export async function getGlobalTeam(): Promise<Team | null> {
  // In single-tenant mode, there should only be one team
  // We get the first one ordered by creation date
  const team = await queryOneWithRLS<Team>(
    `SELECT * FROM "teams"
     ORDER BY "createdAt" ASC
     LIMIT 1`,
    []
  )

  return team
}

/**
 * Check if global team exists (for single-tenant mode)
 * Used to determine if public signup should be blocked
 *
 * @returns True if a team exists, false otherwise
 */
export async function hasGlobalTeam(): Promise<boolean> {
  const team = await getGlobalTeam()
  return team !== null
}

/**
 * Add user to the global team (for single-tenant invite flow)
 *
 * @param userId - The user ID to add
 * @param role - The role to assign (default: 'member')
 * @param invitedBy - The user ID who invited them
 */
export async function addUserToGlobalTeam(
  userId: string,
  role: TeamRole = 'member',
  invitedBy?: string
): Promise<void> {
  const team = await getGlobalTeam()

  if (!team) {
    throw new Error('No global team exists')
  }

  // Check if already a member
  const existing = await queryOneWithRLS<{ id: string }>(
    'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [team.id, userId]
  )

  if (existing) {
    console.log(`User ${userId} is already a member of team ${team.id}`)
    return
  }

  // Add as member
  await queryWithRLS(
    `INSERT INTO "team_members" ("teamId", "userId", role, "invitedBy", "joinedAt")
     VALUES ($1, $2, $3, $4, NOW())`,
    [team.id, userId, role, invitedBy || null],
    userId
  )

  console.log(`User ${userId} added to global team ${team.id} as ${role}`)
}

/**
 * Check if user has required permission in team
 *
 * @param userId - The user ID
 * @param teamId - The team ID
 * @param requiredRoles - Array of roles that are allowed
 * @returns True if user has permission, false otherwise
 */
export async function checkTeamPermission(
  userId: string,
  teamId: string,
  requiredRoles: TeamRole[] = ['owner', 'admin']
): Promise<boolean> {
  const member = await queryOneWithRLS<{ role: TeamRole }>(
    'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [teamId, userId],
    userId
  )

  if (!member) {
    return false
  }

  return requiredRoles.includes(member.role)
}

/**
 * Get user's role in a team
 *
 * @param userId - The user ID
 * @param teamId - The team ID
 * @returns The user's role or null if not a member
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const member = await queryOneWithRLS<{ role: TeamRole }>(
    'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [teamId, userId],
    userId
  )

  return member?.role || null
}

/**
 * Check if user is a member of a team
 *
 * @param userId - The user ID
 * @param teamId - The team ID
 * @returns True if user is a member, false otherwise
 */
export async function isTeamMember(
  userId: string,
  teamId: string
): Promise<boolean> {
  const member = await queryOneWithRLS<{ id: string }>(
    'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [teamId, userId],
    userId
  )

  return !!member
}

/**
 * Get all teams for a user with detailed information
 *
 * @param userId - The user ID
 * @returns Array of teams with membership details
 */
export async function getUserTeamsWithDetails(userId: string) {
  const teams = await queryWithRLS<{
    id: string
    name: string
    slug: string
    description: string | null
    ownerId: string
    avatarUrl: string | null
    settings: Record<string, any>
    createdAt: string
    updatedAt: string
    userRole: TeamRole
    joinedAt: string
    memberCount: string
  }>(
    `SELECT
      t.*,
      tm.role as "userRole",
      tm."joinedAt",
      COUNT(DISTINCT tm2.id) as "memberCount"
    FROM "teams" t
    INNER JOIN "team_members" tm ON t.id = tm."teamId"
    LEFT JOIN "team_members" tm2 ON t.id = tm2."teamId"
    WHERE tm."userId" = $1
    GROUP BY t.id, t.name, t.slug, t.description, t."ownerId", t."avatarUrl",
             t.settings, t."createdAt", t."updatedAt", tm.role, tm."joinedAt"
    ORDER BY
      tm.role = 'owner' DESC,  -- Teams owned by user first
      t."createdAt" DESC`,
    [userId],
    userId
  )

  return teams.map(team => ({
    ...team,
    memberCount: parseInt(team.memberCount, 10)
  }))
}

/**
 * Get team by ID with member count
 *
 * @param teamId - The team ID
 * @param userId - The user ID (for RLS)
 * @returns Team with member count or null
 */
export async function getTeamWithMemberCount(
  teamId: string,
  userId: string
): Promise<(Team & { memberCount: number }) | null> {
  const team = await queryOneWithRLS<Team & { memberCount: string }>(
    `SELECT
      t.*,
      COUNT(DISTINCT tm.id) as "memberCount"
    FROM "teams" t
    LEFT JOIN "team_members" tm ON t.id = tm."teamId"
    WHERE t.id = $1
    GROUP BY t.id`,
    [teamId],
    userId
  )

  if (!team) {
    return null
  }

  return {
    ...team,
    memberCount: parseInt(team.memberCount, 10)
  }
}

/**
 * Get team members with user details
 *
 * @param teamId - The team ID
 * @param userId - The requesting user ID (for RLS)
 * @returns Array of team members with user information
 */
export async function getTeamMembersWithUsers(
  teamId: string,
  userId: string
) {
  const members = await queryWithRLS<{
    id: string
    teamId: string
    userId: string
    role: TeamRole
    invitedBy: string | null
    joinedAt: string
    createdAt: string
    updatedAt: string
    userName: string | null
    userEmail: string
    userImage: string | null
  }>(
    `SELECT
      tm.*,
      u.name as "userName",
      u.email as "userEmail",
      u.image as "userImage"
    FROM "team_members" tm
    INNER JOIN "users" u ON tm."userId" = u.id
    WHERE tm."teamId" = $1
    ORDER BY
      CASE tm.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
        WHEN 'viewer' THEN 4
      END,
      tm."joinedAt" ASC`,
    [teamId],
    userId
  )

  return members
}

/**
 * Check if slug is available (not used by another team)
 *
 * @param slug - The slug to check
 * @param excludeTeamId - Optional team ID to exclude from check (for updates)
 * @returns True if slug is available, false otherwise
 */
export async function isSlugAvailable(
  slug: string,
  excludeTeamId?: string
): Promise<boolean> {
  let query = 'SELECT id FROM "teams" WHERE slug = $1'
  const params: any[] = [slug]

  if (excludeTeamId) {
    query += ' AND id != $2'
    params.push(excludeTeamId)
  }

  query += ' LIMIT 1'

  const existing = await queryOneWithRLS<{ id: string }>(query, params)

  return !existing
}

/**
 * Switch active team (for session management)
 * This would typically update the session with the new team context
 *
 * @param userId - The user ID
 * @param teamId - The team ID to switch to
 * @returns True if successful, throws error otherwise
 */
export async function switchActiveTeam(
  userId: string,
  teamId: string
): Promise<boolean> {
  // Verify user is a member of the team
  const isMember = await isTeamMember(userId, teamId)

  if (!isMember) {
    throw new Error('User is not a member of this team')
  }

  // In a full implementation, this would update the session
  // For now, we just verify membership
  console.log(`User ${userId} switched to team ${teamId}`)

  return true
}

/**
 * Delete team
 * No special protection needed (all teams can be deleted)
 *
 * @param teamId - The team ID
 * @param userId - The user ID (must be owner)
 */
export async function deleteTeam(
  teamId: string,
  userId: string
): Promise<void> {
  // Verify user is owner
  const hasPermission = await checkTeamPermission(userId, teamId, ['owner'])

  if (!hasPermission) {
    throw new Error('Only team owner can delete the team')
  }

  // Get team to verify it exists
  const team = await queryOneWithRLS<Team>(
    'SELECT * FROM "teams" WHERE id = $1',
    [teamId],
    userId
  )

  if (!team) {
    throw new Error('Team not found')
  }

  // Delete team (members and invitations will cascade)
  await queryWithRLS(
    'DELETE FROM "teams" WHERE id = $1',
    [teamId],
    userId
  )

  console.log(`Team ${teamId} deleted by user ${userId}`)
}
