/**
 * Team Member Service
 *
 * Provides team membership management including adding/removing members,
 * role management, and permission checks.
 *
 * @module TeamMemberService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../db'
import { TeamService } from './team.service'
import type { TeamMember, TeamRole } from '../teams/types'

// ===========================================
// TYPES
// ===========================================

export interface TeamMemberWithUser extends TeamMember {
  userName: string | null
  userEmail: string
  userImage: string | null
}

export interface AddMemberOptions {
  invitedBy?: string
}

// ===========================================
// SERVICE
// ===========================================

export class TeamMemberService {
  // ===========================================
  // QUERIES
  // ===========================================

  /**
   * Get team member by team and user ID
   *
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns Team member or null if not found
   *
   * @example
   * const member = await TeamMemberService.getByTeamAndUser('team-123', 'user-456')
   */
  static async getByTeamAndUser(
    teamId: string,
    userId: string
  ): Promise<TeamMember | null> {
    if (!teamId || !userId) {
      return null
    }

    return queryOneWithRLS<TeamMember>(
      'SELECT * FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )
  }

  /**
   * List all team members with user details
   *
   * @param teamId - Team ID
   * @param requestingUserId - User ID making the request (for RLS)
   * @returns Array of team members with user information
   *
   * @example
   * const members = await TeamMemberService.listByTeam('team-123', 'user-456')
   */
  static async listByTeam(
    teamId: string,
    requestingUserId: string
  ): Promise<TeamMemberWithUser[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    return queryWithRLS<TeamMemberWithUser>(
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
          ELSE 5
        END,
        tm."joinedAt" ASC`,
      [teamId],
      requestingUserId
    )
  }

  /**
   * Get user's role in a team
   *
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns The user's role or null if not a member
   *
   * @example
   * const role = await TeamMemberService.getRole('team-123', 'user-456')
   */
  static async getRole(teamId: string, userId: string): Promise<TeamRole | null> {
    if (!teamId || !userId) {
      return null
    }

    const member = await queryOneWithRLS<{ role: TeamRole }>(
      'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )

    return member?.role ?? null
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

  /**
   * Add a user to a team
   *
   * @param teamId - Team ID
   * @param userId - User ID to add
   * @param role - Role to assign
   * @param options - Additional options (invitedBy)
   * @returns Created team member
   *
   * @example
   * const member = await TeamMemberService.add('team-123', 'user-456', 'member', {
   *   invitedBy: 'owner-user-id'
   * })
   */
  static async add(
    teamId: string,
    userId: string,
    role: TeamRole,
    options: AddMemberOptions = {}
  ): Promise<TeamMember> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    if (!role) {
      throw new Error('Role is required')
    }

    // Check if already a member
    const existing = await this.getByTeamAndUser(teamId, userId)
    if (existing) {
      throw new Error('User is already a member of this team')
    }

    const result = await mutateWithRLS<TeamMember>(
      `INSERT INTO "team_members" ("teamId", "userId", role, "invitedBy", "joinedAt")
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [teamId, userId, role, options.invitedBy || null],
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Failed to add team member')
    }

    return result.rows[0]
  }

  /**
   * Add user to the global team (for single-tenant invite flow)
   *
   * @param userId - User ID to add
   * @param role - Role to assign (default: 'member')
   * @param invitedBy - User ID who invited them
   *
   * @example
   * await TeamMemberService.addToGlobal('user-123', 'member', 'owner-id')
   */
  static async addToGlobal(
    userId: string,
    role: TeamRole = 'member',
    invitedBy?: string
  ): Promise<void> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    const team = await TeamService.getGlobal()
    if (!team) {
      throw new Error('No global team exists')
    }

    // Check if already a member
    const existing = await this.getByTeamAndUser(team.id, userId)
    if (existing) {
      // Already a member, just return
      return
    }

    await this.add(team.id, userId, role, { invitedBy })
  }

  /**
   * Transfer team ownership to another member
   *
   * @param teamId - Team ID
   * @param newOwnerId - User ID of the new owner (must be existing member)
   * @param currentOwnerId - Current owner's user ID (for verification)
   * @returns Updated team members (both old and new owner)
   *
   * @example
   * await TeamMemberService.transferOwnership('team-123', 'new-owner-id', 'current-owner-id')
   */
  static async transferOwnership(
    teamId: string,
    newOwnerId: string,
    currentOwnerId: string
  ): Promise<{ previousOwner: TeamMember; newOwner: TeamMember }> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!newOwnerId || newOwnerId.trim() === '') {
      throw new Error('New owner ID is required')
    }

    if (!currentOwnerId || currentOwnerId.trim() === '') {
      throw new Error('Current owner ID is required')
    }

    if (newOwnerId === currentOwnerId) {
      throw new Error('New owner must be different from current owner')
    }

    // Verify current owner
    const currentOwnerRole = await this.getRole(teamId, currentOwnerId)
    if (currentOwnerRole !== 'owner') {
      throw new Error('Only the current owner can transfer ownership')
    }

    // Verify new owner is a member
    const newOwnerMember = await this.getByTeamAndUser(teamId, newOwnerId)
    if (!newOwnerMember) {
      throw new Error('New owner must be an existing team member')
    }

    // Update both members' roles
    const previousOwnerResult = await mutateWithRLS<TeamMember>(
      `UPDATE "team_members"
       SET role = 'admin', "updatedAt" = NOW()
       WHERE "teamId" = $1 AND "userId" = $2
       RETURNING *`,
      [teamId, currentOwnerId],
      currentOwnerId
    )

    const newOwnerResult = await mutateWithRLS<TeamMember>(
      `UPDATE "team_members"
       SET role = 'owner', "updatedAt" = NOW()
       WHERE "teamId" = $1 AND "userId" = $2
       RETURNING *`,
      [teamId, newOwnerId],
      currentOwnerId
    )

    // Update team's ownerId
    await queryWithRLS(
      `UPDATE "teams" SET "ownerId" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [newOwnerId, teamId],
      currentOwnerId
    )

    if (!previousOwnerResult.rows[0] || !newOwnerResult.rows[0]) {
      throw new Error('Failed to transfer ownership')
    }

    return {
      previousOwner: previousOwnerResult.rows[0],
      newOwner: newOwnerResult.rows[0],
    }
  }

  /**
   * Remove a user from a team
   *
   * @param teamId - Team ID
   * @param userId - User ID to remove
   *
   * @example
   * await TeamMemberService.remove('team-123', 'user-456')
   */
  static async remove(teamId: string, userId: string): Promise<void> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    // Check if user is owner (can't remove owner)
    const userRole = await this.getRole(teamId, userId)
    if (userRole === 'owner') {
      throw new Error('Cannot remove team owner. Transfer ownership first.')
    }

    await queryWithRLS(
      'DELETE FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )
  }

  /**
   * Update user's role in a team
   *
   * @param teamId - Team ID
   * @param userId - User ID
   * @param role - New role
   * @returns Updated team member
   *
   * @example
   * const member = await TeamMemberService.updateRole('team-123', 'user-456', 'admin')
   */
  static async updateRole(
    teamId: string,
    userId: string,
    role: TeamRole
  ): Promise<TeamMember> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    if (!role) {
      throw new Error('Role is required')
    }

    // Check if user is owner (can't change owner's role)
    const currentRole = await this.getRole(teamId, userId)
    if (currentRole === 'owner' && role !== 'owner') {
      throw new Error('Cannot change owner role. Transfer ownership first.')
    }

    const result = await mutateWithRLS<TeamMember>(
      `UPDATE "team_members"
       SET role = $3, "updatedAt" = NOW()
       WHERE "teamId" = $1 AND "userId" = $2
       RETURNING *`,
      [teamId, userId, role],
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Team member not found')
    }

    return result.rows[0]
  }

  // ===========================================
  // PERMISSION CHECKS
  // ===========================================

  /**
   * Check if user is a member of a team
   *
   * @param teamId - Team ID
   * @param userId - User ID
   * @returns True if user is a member
   *
   * @example
   * const isMember = await TeamMemberService.isMember('team-123', 'user-456')
   */
  static async isMember(teamId: string, userId: string): Promise<boolean> {
    if (!teamId || !userId) {
      return false
    }

    const member = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )

    return !!member
  }

  /**
   * Check if user has required permission in team
   *
   * @param userId - User ID
   * @param teamId - Team ID
   * @param requiredRoles - Array of roles that are allowed
   * @returns True if user has permission
   *
   * @example
   * const hasPermission = await TeamMemberService.hasPermission(
   *   'user-123',
   *   'team-456',
   *   ['owner', 'admin']
   * )
   */
  static async hasPermission(
    userId: string,
    teamId: string,
    requiredRoles: TeamRole[] = ['owner', 'admin']
  ): Promise<boolean> {
    if (!userId || !teamId) {
      return false
    }

    const role = await this.getRole(teamId, userId)
    if (!role) {
      return false
    }

    return requiredRoles.includes(role)
  }


  /**
   * Get count of team members
   *
   * @param teamId - Team ID
   * @returns Number of members
   *
   * @example
   * const count = await TeamMemberService.count('team-123')
   */
  static async count(teamId: string): Promise<number> {
    if (!teamId || teamId.trim() === '') {
      return 0
    }

    const result = await queryOneWithRLS<{ count: string }>(
      'SELECT COUNT(*) as count FROM "team_members" WHERE "teamId" = $1',
      [teamId]
    )

    return parseInt(result?.count ?? '0', 10)
  }

  /**
   * Get count of members by role
   *
   * @param teamId - Team ID
   * @returns Object with role counts
   *
   * @example
   * const counts = await TeamMemberService.countByRole('team-123')
   * // { owner: 1, admin: 2, member: 5, viewer: 3 }
   */
  static async countByRole(teamId: string): Promise<Record<string, number>> {
    if (!teamId || teamId.trim() === '') {
      return {}
    }

    const results = await queryWithRLS<{ role: string; count: string }>(
      `SELECT role, COUNT(*) as count
       FROM "team_members"
       WHERE "teamId" = $1
       GROUP BY role`,
      [teamId]
    )

    const counts: Record<string, number> = {}
    for (const row of results) {
      counts[row.role] = parseInt(row.count, 10)
    }

    return counts
  }

  // ===========================================
  // FILTERING QUERIES
  // ===========================================

  /**
   * List all team memberships for a user
   * Useful for team switcher or user profile
   *
   * @param userId - User ID
   * @returns Array of memberships with team details
   *
   * @example
   * const memberships = await TeamMemberService.listByUser('user-123')
   */
  static async listByUser(userId: string): Promise<Array<TeamMember & {
    teamName: string
    teamSlug: string
  }>> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    return queryWithRLS<TeamMember & { teamName: string; teamSlug: string }>(
      `SELECT
        tm.*,
        t.name as "teamName",
        t.slug as "teamSlug"
      FROM "team_members" tm
      INNER JOIN "teams" t ON tm."teamId" = t.id
      WHERE tm."userId" = $1
      ORDER BY
        CASE tm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          WHEN 'viewer' THEN 4
          ELSE 5
        END,
        tm."joinedAt" DESC`,
      [userId],
      userId
    )
  }

  /**
   * List team members filtered by role
   *
   * @param teamId - Team ID
   * @param role - Role to filter by
   * @param requestingUserId - User ID making the request (for RLS)
   * @returns Array of members with that role
   *
   * @example
   * const admins = await TeamMemberService.listByRole('team-123', 'admin', 'user-456')
   */
  static async listByRole(
    teamId: string,
    role: TeamRole,
    requestingUserId: string
  ): Promise<TeamMemberWithUser[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!role) {
      throw new Error('Role is required')
    }

    return queryWithRLS<TeamMemberWithUser>(
      `SELECT
        tm.*,
        u.name as "userName",
        u.email as "userEmail",
        u.image as "userImage"
      FROM "team_members" tm
      INNER JOIN "users" u ON tm."userId" = u.id
      WHERE tm."teamId" = $1 AND tm.role = $2
      ORDER BY tm."joinedAt" ASC`,
      [teamId, role],
      requestingUserId
    )
  }

  /**
   * Search team members by name or email
   *
   * @param teamId - Team ID
   * @param query - Search query (name or email)
   * @param requestingUserId - User ID making the request (for RLS)
   * @returns Array of matching members
   *
   * @example
   * const results = await TeamMemberService.search('team-123', 'john', 'user-456')
   */
  static async search(
    teamId: string,
    query: string,
    requestingUserId: string
  ): Promise<TeamMemberWithUser[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!query || query.trim() === '') {
      return this.listByTeam(teamId, requestingUserId)
    }

    const searchPattern = `%${query.trim().toLowerCase()}%`

    return queryWithRLS<TeamMemberWithUser>(
      `SELECT
        tm.*,
        u.name as "userName",
        u.email as "userEmail",
        u.image as "userImage"
      FROM "team_members" tm
      INNER JOIN "users" u ON tm."userId" = u.id
      WHERE tm."teamId" = $1
        AND (LOWER(u.name) LIKE $2 OR LOWER(u.email) LIKE $2)
      ORDER BY
        CASE tm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          WHEN 'viewer' THEN 4
          ELSE 5
        END,
        tm."joinedAt" ASC`,
      [teamId, searchPattern],
      requestingUserId
    )
  }

  /**
   * Get recently joined members
   *
   * @param teamId - Team ID
   * @param limit - Maximum number of members to return (default: 10)
   * @param requestingUserId - User ID making the request (for RLS)
   * @returns Array of recently joined members
   *
   * @example
   * const recent = await TeamMemberService.getRecentlyJoined('team-123', 5, 'user-456')
   */
  static async getRecentlyJoined(
    teamId: string,
    limit: number = 10,
    requestingUserId: string
  ): Promise<TeamMemberWithUser[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    return queryWithRLS<TeamMemberWithUser>(
      `SELECT
        tm.*,
        u.name as "userName",
        u.email as "userEmail",
        u.image as "userImage"
      FROM "team_members" tm
      INNER JOIN "users" u ON tm."userId" = u.id
      WHERE tm."teamId" = $1
      ORDER BY tm."joinedAt" DESC
      LIMIT $2`,
      [teamId, limit],
      requestingUserId
    )
  }

  /**
   * Get members who were invited by a specific user
   *
   * @param teamId - Team ID
   * @param invitedByUserId - User ID who sent the invitations
   * @param requestingUserId - User ID making the request (for RLS)
   * @returns Array of members invited by the user
   *
   * @example
   * const invited = await TeamMemberService.listInvitedBy('team-123', 'user-456', 'user-789')
   */
  static async listInvitedBy(
    teamId: string,
    invitedByUserId: string,
    requestingUserId: string
  ): Promise<TeamMemberWithUser[]> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!invitedByUserId || invitedByUserId.trim() === '') {
      throw new Error('Invited by user ID is required')
    }

    return queryWithRLS<TeamMemberWithUser>(
      `SELECT
        tm.*,
        u.name as "userName",
        u.email as "userEmail",
        u.image as "userImage"
      FROM "team_members" tm
      INNER JOIN "users" u ON tm."userId" = u.id
      WHERE tm."teamId" = $1 AND tm."invitedBy" = $2
      ORDER BY tm."joinedAt" DESC`,
      [teamId, invitedByUserId],
      requestingUserId
    )
  }
}
