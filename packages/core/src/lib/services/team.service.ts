/**
 * Team Service
 *
 * Provides team management functions including creation, updates,
 * and single-tenant (global team) operations.
 *
 * @module TeamService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS, getServiceTransactionClient } from '../db'
import type { Team, TeamRole } from '../teams/types'
import { TEAMS_CONFIG } from '../config'
import { getGlobalHooks } from '../plugins/hook-system'
import { scheduleAction } from '../scheduled-actions/scheduler'

/** Filter hook run before a team is deleted: throw to veto, the message reaches the caller. */
export const TEAM_BEFORE_DELETE_HOOK = 'team.before_delete'
/** Action hook run after a team was deleted (soft-deleted, memberships revoked). */
export const TEAM_DELETED_HOOK = 'team.deleted'
/** Scheduled action that removes the teams deleted longer ago than the retention. */
export const PURGE_DELETED_TEAMS_ACTION = 'teams:purge-deleted'
/** Days a deleted team is kept when `teams.options.deletedRetentionDays` is not set. */
export const DELETED_TEAM_RETENTION_DAYS = 30

/** A `team.before_delete` hook refused the deletion; the team is untouched. */
export class TeamDeleteVetoedError extends Error {
  readonly code = 'TEAM_DELETE_VETOED'
  constructor(message: string) {
    super(message)
    this.name = 'TeamDeleteVetoedError'
  }
}

/** Retention of deleted teams in days: the configured value, or the default when it is not a number >= 0. */
export function getDeletedTeamRetentionDays(): number {
  const configured = TEAMS_CONFIG?.options?.deletedRetentionDays
  return typeof configured === 'number' && Number.isFinite(configured) && configured >= 0
    ? configured
    : DELETED_TEAM_RETENTION_DAYS
}

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
  description?: string | null
  avatarUrl?: string | null
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
      'SELECT * FROM "teams" WHERE id = $1 AND "deletedAt" IS NULL',
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
      'SELECT * FROM "teams" WHERE slug = $1 AND "deletedAt" IS NULL',
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
      `SELECT * FROM "teams" WHERE "isGlobal" = TRUE AND "deletedAt" IS NULL LIMIT 1`,
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
   * Is the first-user bootstrap over? Until it is, the registration gates
   * (invitation-only, and public sign-up in single-tenant mode) let the first
   * user in. Single-tenant: the global team exists. Other modes create no
   * global team, so there: any team exists.
   *
   * Every registration gate asks this, so they cannot disagree.
   */
  static async isBootstrapDone(): Promise<boolean> {
    if (TEAMS_CONFIG.mode === 'single-tenant') return this.hasGlobal()
    return (await queryOneWithRLS('SELECT 1 FROM "teams" WHERE "deletedAt" IS NULL LIMIT 1', [])) !== null
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
      WHERE tm."userId" = $1 AND t."deletedAt" IS NULL
      GROUP BY t.id, t.name, t.slug, t.description, t."ownerId", t."avatarUrl",
               t."isGlobal", t.settings, t."createdAt", t."updatedAt", tm.role, tm."joinedAt"
      ORDER BY
        tm.role = 'owner' DESC,
        t."createdAt" DESC`,
      [userId],
      userId
    )

    // @ts-expect-error — pre-existing type error, tracked in https://github.com/NextSpark-js/nextspark/issues/131
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
      WHERE t.id = $1 AND t."deletedAt" IS NULL
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
       WHERE t.id = $1 AND t."deletedAt" IS NULL`,
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
      `SELECT * FROM "teams" WHERE "ownerId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt" DESC`,
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

    // Use a SERVICE transaction (RLS bypass) to ensure atomicity. This bootstrap
    // creates the FIRST team_members (owner) row and the team's first
    // subscription — neither can satisfy the membership-based RLS insert policies
    // (the user is not yet a member). Authorization that this user may create a
    // team is enforced by the caller; `ownerId`/membership are fixed to `userId`.
    const tx = await getServiceTransactionClient()

    try {
      // 1. Create team
      const isGlobal = TEAMS_CONFIG.mode === 'single-tenant'
      const team = await tx.queryOne<Team>(
        `INSERT INTO "teams" (name, slug, "ownerId", "isGlobal")
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [teamName, teamSlug, userId, isGlobal]
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
       WHERE id = $${paramIndex} AND "deletedAt" IS NULL
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
   * Delete team (soft delete)
   * Only the owner can delete a team, never the global team or the system admin team.
   *
   * Runs the `team.before_delete` filter hooks first: a hook that throws vetoes the
   * deletion (TeamDeleteVetoedError carrying its message) and nothing changes. Then,
   * in one transaction, sets `deletedAt`, revokes every membership and deletes the
   * pending invitations. The row stays until the `teams:purge-deleted` scheduled
   * action removes it once the retention has passed. The `team.deleted` action hooks
   * run last.
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
      'SELECT * FROM "teams" WHERE id = $1 AND "deletedAt" IS NULL',
      [teamId],
      userId
    )

    if (!team) {
      throw new Error('Team not found')
    }

    if (team.ownerId !== userId) {
      throw new Error('Only team owner can delete the team')
    }

    // Deleting either would reopen the first-user bootstrap (isBootstrapDone) or drop the platform admin team.
    if (team.isGlobal) {
      throw new Error('The global team cannot be deleted')
    }
    if ((team as Team & { metadata?: { systemAdmin?: boolean } }).metadata?.systemAdmin === true) {
      throw new Error('The system admin team cannot be deleted')
    }

    const hooks = getGlobalHooks()
    try {
      await hooks.applyFiltersStrict(TEAM_BEFORE_DELETE_HOOK, { teamId, team, userId })
    } catch (error) {
      throw new TeamDeleteVetoedError(error instanceof Error ? error.message : 'Team deletion was refused')
    }

    // Service transaction: revoking other members' rows is not something the owner's RLS allows.
    // Ownership was checked above and is part of the UPDATE, so a transfer in between cannot be raced.
    const tx = await getServiceTransactionClient()
    try {
      // "isGlobal" is cleared so the partial unique index does not keep a replacement from being created.
      const marked = await tx.mutate(
        `UPDATE "teams" SET "deletedAt" = NOW(), "isGlobal" = FALSE, "updatedAt" = NOW()
         WHERE id = $1 AND "ownerId" = $2 AND "deletedAt" IS NULL`,
        [teamId, userId]
      )
      if (marked.rowCount === 0) {
        throw new Error('Team not found')
      }
      await tx.query('DELETE FROM "team_members" WHERE "teamId" = $1', [teamId])
      await tx.query(`DELETE FROM "team_invitations" WHERE "teamId" = $1 AND status = 'pending'`, [teamId])
      await tx.commit()
    } catch (error) {
      await tx.rollback()
      throw error
    }

    // The deletion is done: neither of these can undo it. The purge also gets scheduled by the next
    // run of any earlier one, and a project may run it on its own schedule.
    try {
      const purgeAt = new Date(Date.now() + getDeletedTeamRetentionDays() * 86_400_000)
      await scheduleAction(PURGE_DELETED_TEAMS_ACTION, {}, { scheduledAt: purgeAt })
    } catch (error) {
      console.error(`[TeamService] Could not schedule the purge of deleted teams:`, error)
    }
    await hooks.doAction(TEAM_DELETED_HOOK, { teamId, team, userId })
  }

  /**
   * Physically remove the teams deleted more than `retentionDays` ago (default: the
   * configured retention). Members, invitations and subscriptions go with them (FK
   * cascade). Run by the `teams:purge-deleted` scheduled action.
   *
   * @returns Number of teams removed
   */
  static async purgeDeleted(retentionDays: number = getDeletedTeamRetentionDays()): Promise<number> {
    const result = await mutateWithRLS(
      `DELETE FROM "teams"
       WHERE "deletedAt" IS NOT NULL
         AND "deletedAt" < NOW() - make_interval(secs => $1::float8 * 86400)`,
      [retentionDays],
      null // System operation
    )
    return result.rowCount
  }

  /**
   * When the oldest team still waiting to be purged expires, or null if none waits.
   */
  static async getNextPurgeAt(retentionDays: number = getDeletedTeamRetentionDays()): Promise<Date | null> {
    const row = await queryOneWithRLS<{ deletedAt: string | Date | null }>(
      `SELECT MIN("deletedAt") AS "deletedAt" FROM "teams" WHERE "deletedAt" IS NOT NULL`,
      []
    )
    if (!row?.deletedAt) return null
    return new Date(new Date(row.deletedAt).getTime() + retentionDays * 86_400_000)
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

    // Verify the user is a member of the team AND the team is not soft-deleted.
    // A soft-deleted team must never become the active context: its members (e.g.
    // a former owner of a discarded personal team) still have a team_members row,
    // so a membership-only check would let a stale active-team pointer to a deleted
    // team be re-selected.
    const member = await queryOneWithRLS<{ id: string }>(
      `SELECT tm.id
         FROM "team_members" tm
         INNER JOIN "teams" t ON t.id = tm."teamId"
        WHERE tm."teamId" = $1 AND tm."userId" = $2 AND t."deletedAt" IS NULL`,
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
      'SELECT id FROM "teams" WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1',
      [teamId]
    )

    return !!result
  }
}
