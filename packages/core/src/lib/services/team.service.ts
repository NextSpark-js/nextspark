/**
 * Team Service
 *
 * Provides team management functions including creation, updates,
 * and single-tenant (global team) operations.
 *
 * @module TeamService
 */

import { queryOneWithRLS, queryWithRLS, getTransactionClient } from '../db'
import type { Team, TeamRole } from '../teams/types'

// ===========================================
// TYPES
// ===========================================

export interface TeamWithMemberCount extends Team {
  memberCount: number
}

export interface TeamWithDetails extends Team {
  userRole: TeamRole
  joinedAt: string
  memberCount: number
}

export interface UpdateTeamPayload {
  name?: string
  slug?: string
  description?: string
  avatarUrl?: string
  settings?: Record<string, unknown>
}

// ===========================================
// SERVICE
// ===========================================

export class TeamService {
  // ===========================================
  // QUERIES
  // ===========================================

  /**
   * Get team by ID
   *
   * @param teamId - Team ID
   * @param userId - Optional user ID for RLS
   * @returns Team or null if not found
   *
   * @example
   * const team = await TeamService.getById('team-123')
   */
  static async getById(teamId: string, userId?: string): Promise<Team | null> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    return queryOneWithRLS<Team>(
      'SELECT * FROM "teams" WHERE id = $1',
      [teamId],
      userId
    )
  }

  /**
   * Get team by slug
   *
   * @param slug - Team slug
   * @returns Team or null if not found
   *
   * @example
   * const team = await TeamService.getBySlug('my-team')
   */
  static async getBySlug(slug: string): Promise<Team | null> {
    if (!slug || slug.trim() === '') {
      throw new Error('Team slug is required')
    }

    return queryOneWithRLS<Team>(
      'SELECT * FROM "teams" WHERE slug = $1',
      [slug]
    )
  }

  /**
   * Get the global team (for single-tenant mode)
   * Returns the first team found (should be the only one)
   *
   * @returns The global team or null if none exists
   *
   * @example
   * const globalTeam = await TeamService.getGlobal()
   */
  static async getGlobal(): Promise<Team | null> {
    return queryOneWithRLS<Team>(
      `SELECT * FROM "teams"
       WHERE (metadata->>'isSeedData')::boolean IS NOT TRUE
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      []
    )
  }

  /**
   * Check if global team exists (for single-tenant mode)
   * Used to determine if public signup should be blocked
   *
   * @returns True if a team exists, false otherwise
   *
   * @example
   * const hasTeam = await TeamService.hasGlobal()
   */
  static async hasGlobal(): Promise<boolean> {
    const team = await this.getGlobal()
    return team !== null
  }

  /**
   * Get all teams for a user with detailed information
   *
   * @param userId - The user ID
   * @returns Array of teams with membership details
   *
   * @example
   * const teams = await TeamService.getUserTeams('user-123')
   */
  static async getUserTeams(userId: string): Promise<TeamWithDetails[]> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    const teams = await queryWithRLS<{
      id: string
      name: string
      slug: string
      description: string | null
      ownerId: string
      avatarUrl: string | null
      settings: Record<string, unknown>
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
        tm.role = 'owner' DESC,
        t."createdAt" DESC`,
      [userId],
      userId
    )

    return teams.map(team => ({
      ...team,
      memberCount: parseInt(team.memberCount, 10),
    }))
  }

  /**
   * Get team by ID with member count
   *
   * @param teamId - The team ID
   * @param userId - The user ID (for RLS)
   * @returns Team with member count or null
   *
   * @example
   * const team = await TeamService.getWithMemberCount('team-123', 'user-456')
   */
  static async getWithMemberCount(
    teamId: string,
    userId: string
  ): Promise<TeamWithMemberCount | null> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

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
      memberCount: parseInt(team.memberCount, 10),
    }
  }

  /**
   * Get team owner with user details
   *
   * @param teamId - Team ID
   * @returns Owner user information or null
   *
   * @example
   * const owner = await TeamService.getOwner('team-123')
   */
  static async getOwner(teamId: string): Promise<{
    id: string
    name: string | null
    email: string
    image: string | null
  } | null> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    return queryOneWithRLS<{
      id: string
      name: string | null
      email: string
      image: string | null
    }>(
      `SELECT u.id, u.name, u.email, u.image
       FROM "teams" t
       INNER JOIN "users" u ON t."ownerId" = u.id
       WHERE t.id = $1`,
      [teamId]
    )
  }

  /**
   * Get teams owned by a user
   *
   * @param userId - User ID
   * @returns Array of teams owned by the user
   *
   * @example
   * const ownedTeams = await TeamService.getByOwnerId('user-123')
   */
  static async getByOwnerId(userId: string): Promise<Team[]> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    return queryWithRLS<Team>(
      `SELECT * FROM "teams" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
      userId
    )
  }

  // ===========================================
  // MUTATIONS
  // ===========================================

  /**
   * Create a new team
   * Also creates team membership for owner and default subscription
   *
   * @param userId - The ID of the user creating the team
   * @param name - Optional team name (defaults to user's name + Team)
   * @returns The created Team
   *
   * @example
   * const team = await TeamService.create('user-123', 'My Company')
   */
  static async create(userId: string, name?: string): Promise<Team> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

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
      const team = await tx.queryOne<Team>(
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
      const freePlan = await tx.queryOne<{ id: string }>(
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

      return team
    } catch (error) {
      await tx.rollback()
      throw error
    }
  }

  /**
   * Update team
   *
   * @param teamId - Team ID
   * @param data - Update payload
   * @param userId - User ID (for permission check and RLS)
   * @returns Updated team
   *
   * @example
   * const team = await TeamService.update('team-123', { name: 'New Name' }, 'user-456')
   */
  static async update(
    teamId: string,
    data: UpdateTeamPayload,
    userId: string
  ): Promise<Team> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    // Build dynamic update query
    const updates: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      params.push(data.name)
      paramIndex++
    }

    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex}`)
      params.push(data.slug)
      paramIndex++
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`)
      params.push(data.description)
      paramIndex++
    }

    if (data.avatarUrl !== undefined) {
      updates.push(`"avatarUrl" = $${paramIndex}`)
      params.push(data.avatarUrl)
      paramIndex++
    }

    if (data.settings !== undefined) {
      updates.push(`settings = $${paramIndex}`)
      params.push(JSON.stringify(data.settings))
      paramIndex++
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    updates.push(`"updatedAt" = NOW()`)
    params.push(teamId)

    const result = await queryOneWithRLS<Team>(
      `UPDATE "teams"
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
      userId
    )

    if (!result) {
      throw new Error(`Team not found: ${teamId}`)
    }

    return result
  }

  /**
   * Delete team
   * Only the owner can delete a team
   *
   * @param teamId - Team ID
   * @param userId - User ID (must be owner)
   *
   * @example
   * await TeamService.delete('team-123', 'user-456')
   */
  static async delete(teamId: string, userId: string): Promise<void> {
    if (!teamId || teamId.trim() === '') {
      throw new Error('Team ID is required')
    }

    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required')
    }

    // Get team to verify it exists and check ownership
    const team = await queryOneWithRLS<Team>(
      'SELECT * FROM "teams" WHERE id = $1',
      [teamId],
      userId
    )

    if (!team) {
      throw new Error('Team not found')
    }

    if (team.ownerId !== userId) {
      throw new Error('Only team owner can delete the team')
    }

    // Delete team (members and invitations will cascade)
    await queryWithRLS(
      'DELETE FROM "teams" WHERE id = $1',
      [teamId],
      userId
    )
  }

  // ===========================================
  // SLUG HELPERS
  // ===========================================

  /**
   * Check if slug is available (not used by another team)
   *
   * @param slug - The slug to check
   * @param excludeTeamId - Optional team ID to exclude from check (for updates)
   * @returns True if slug is available, false otherwise
   *
   * @example
   * const available = await TeamService.isSlugAvailable('my-team')
   */
  static async isSlugAvailable(
    slug: string,
    excludeTeamId?: string
  ): Promise<boolean> {
    if (!slug || slug.trim() === '') {
      return false
    }

    let query = 'SELECT id FROM "teams" WHERE slug = $1'
    const params: unknown[] = [slug]

    if (excludeTeamId) {
      query += ' AND id != $2'
      params.push(excludeTeamId)
    }

    query += ' LIMIT 1'

    const existing = await queryOneWithRLS<{ id: string }>(query, params)

    return !existing
  }

  /**
   * Generate a unique slug for a team
   *
   * @param baseName - The base name to generate slug from
   * @returns A unique slug
   *
   * @example
   * const slug = await TeamService.generateSlug('My Company')
   * // 'my-company' or 'my-company-1' if taken
   */
  static async generateSlug(baseName: string): Promise<string> {
    if (!baseName || baseName.trim() === '') {
      throw new Error('Base name is required')
    }

    // Convert to slug format
    let baseSlug = baseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check if available
    if (await this.isSlugAvailable(baseSlug)) {
      return baseSlug
    }

    // Try with number suffix
    let counter = 1
    while (counter < 1000) {
      const slugWithNumber = `${baseSlug}-${counter}`
      if (await this.isSlugAvailable(slugWithNumber)) {
        return slugWithNumber
      }
      counter++
    }

    // Fallback to timestamp
    return `${baseSlug}-${Date.now().toString(36)}`
  }

  // ===========================================
  // CONTEXT HELPERS
  // ===========================================

  /**
   * Switch active team (for session management)
   * Verifies user is a member of the team
   *
   * @param userId - The user ID
   * @param teamId - The team ID to switch to
   * @returns True if successful
   *
   * @example
   * await TeamService.switchActive('user-123', 'team-456')
   */
  static async switchActive(userId: string, teamId: string): Promise<boolean> {
    if (!userId || !teamId) {
      throw new Error('User ID and Team ID are required')
    }

    // Verify user is a member of the team
    const member = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )

    if (!member) {
      throw new Error('User is not a member of this team')
    }

    return true
  }

  /**
   * Check if team exists
   *
   * @param teamId - Team ID
   * @returns True if team exists
   *
   * @example
   * const exists = await TeamService.exists('team-123')
   */
  static async exists(teamId: string): Promise<boolean> {
    if (!teamId || teamId.trim() === '') {
      return false
    }

    const result = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "teams" WHERE id = $1 LIMIT 1',
      [teamId]
    )

    return !!result
  }
}
