/**
 * Patterns Service
 *
 * Provides data access methods for patterns.
 * Patterns is a team-scoped entity (shared: true) - all team members see the same patterns.
 *
 * All methods require authentication and use RLS with team isolation.
 *
 * @module PatternsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '../../lib/db'
import type {
  Pattern,
  CreatePatternInput,
  UpdatePatternInput,
  PatternListOptions,
  PatternListResult,
  PatternStatus
} from './patterns.types'
import { isPatternReference } from './patterns.types'

// Database row type for pattern
interface DbPattern {
  id: string
  userId: string
  teamId: string
  title: string
  slug: string
  blocks: unknown // JSONB
  status: PatternStatus
  description: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Helper function to check if blocks contain pattern references
 * Used to prevent nesting patterns inside patterns
 */
function containsPatternReference(blocks: unknown[]): boolean {
  if (!Array.isArray(blocks)) return false
  return blocks.some(block => isPatternReference(block))
}

export class PatternsService {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a pattern by ID
   *
   * Respects RLS policies. Since patterns has shared: true,
   * all team members can access patterns from their team.
   *
   * @param id - Pattern ID
   * @param userId - Current user ID for RLS
   * @returns Pattern data or null if not found/not authorized
   *
   * @example
   * const pattern = await PatternsService.getById('pattern-uuid', currentUserId)
   */
  static async getById(
    id: string,
    userId: string
  ): Promise<Pattern | null> {
    try {
      if (!id?.trim()) {
        throw new Error('Pattern ID is required')
      }

      if (!userId?.trim()) {
        throw new Error('User ID is required for authentication')
      }

      const pattern = await queryOneWithRLS<DbPattern>(
        `
        SELECT
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        FROM "patterns"
        WHERE id = $1
        `,
        [id],
        userId
      )

      if (!pattern) {
        return null
      }

      return {
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }
    } catch (error) {
      console.error('[PatternsService.getById] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch pattern'
      )
    }
  }

  /**
   * Get a pattern by slug and team ID
   *
   * @param slug - Pattern slug
   * @param teamId - Team ID
   * @param userId - Current user ID for RLS
   * @returns Pattern data or null if not found
   *
   * @example
   * const pattern = await PatternsService.getBySlug('newsletter-cta', teamId, userId)
   */
  static async getBySlug(
    slug: string,
    teamId: string,
    userId: string
  ): Promise<Pattern | null> {
    try {
      if (!slug?.trim()) {
        throw new Error('Slug is required')
      }

      if (!teamId?.trim()) {
        throw new Error('Team ID is required')
      }

      if (!userId?.trim()) {
        throw new Error('User ID is required for authentication')
      }

      const pattern = await queryOneWithRLS<DbPattern>(
        `
        SELECT
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        FROM "patterns"
        WHERE slug = $1 AND "teamId" = $2
        `,
        [slug, teamId],
        userId
      )

      if (!pattern) {
        return null
      }

      return {
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }
    } catch (error) {
      console.error('[PatternsService.getBySlug] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch pattern by slug'
      )
    }
  }

  /**
   * List patterns with pagination and filtering
   *
   * @param userId - Current user ID for RLS
   * @param teamId - Team ID
   * @param options - List options (limit, offset, status, orderBy, orderDir)
   * @returns Object with patterns array and total count
   *
   * @example
   * const { data, total } = await PatternsService.list(userId, teamId, {
   *   status: 'published',
   *   limit: 10
   * })
   */
  static async list(
    userId: string,
    teamId: string,
    options: PatternListOptions = {}
  ): Promise<PatternListResult> {
    try {
      if (!userId?.trim()) {
        throw new Error('User ID is required for authentication')
      }

      if (!teamId?.trim()) {
        throw new Error('Team ID is required')
      }

      const {
        limit = 20,
        offset = 0,
        status,
        orderBy = 'createdAt',
        orderDir = 'desc'
      } = options

      // Build WHERE clause
      const conditions: string[] = ['"teamId" = $1']
      const params: unknown[] = [teamId]
      let paramIndex = 2

      if (status) {
        conditions.push(`status = $${paramIndex}`)
        params.push(status)
        paramIndex++
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      // Validate orderBy to prevent SQL injection
      const validOrderBy = ['title', 'slug', 'status', 'createdAt', 'updatedAt'].includes(orderBy)
        ? orderBy
        : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'

      // Map field names to database columns
      const orderColumnMap: Record<string, string> = {
        title: 'title',
        slug: 'slug',
        status: 'status',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"'
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM "patterns" ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get patterns
      params.push(limit, offset)
      const patterns = await queryWithRLS<DbPattern>(
        `
        SELECT
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        FROM "patterns"
        ${whereClause}
        ORDER BY ${orderColumn} ${validOrderDir}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        params,
        userId
      )

      return {
        data: patterns.map((pattern) => ({
          id: pattern.id,
          userId: pattern.userId,
          teamId: pattern.teamId,
          title: pattern.title,
          slug: pattern.slug,
          blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
          status: pattern.status,
          description: pattern.description ?? undefined,
          createdAt: pattern.createdAt,
          updatedAt: pattern.updatedAt
        })),
        total
      }
    } catch (error) {
      console.error('[PatternsService.list] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to list patterns'
      )
    }
  }

  /**
   * List only published patterns for a team
   *
   * Convenience method to fetch all published patterns.
   * Used by the block picker to show available patterns for insertion.
   *
   * @param userId - Current user ID for RLS
   * @param teamId - Team ID
   * @returns Array of published patterns
   *
   * @example
   * const publishedPatterns = await PatternsService.listPublished(userId, teamId)
   */
  static async listPublished(
    userId: string,
    teamId: string
  ): Promise<Pattern[]> {
    try {
      const { data } = await this.list(userId, teamId, {
        status: 'published',
        limit: 1000, // Large limit to get all published patterns
        orderBy: 'title',
        orderDir: 'asc'
      })

      return data
    } catch (error) {
      console.error('[PatternsService.listPublished] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch published patterns'
      )
    }
  }

  /**
   * Get multiple patterns by IDs (batch fetch)
   *
   * Used for resolving pattern references in pages.
   * Efficiently fetches all referenced patterns in a single query.
   *
   * @param ids - Array of pattern IDs
   * @param userId - Current user ID for RLS
   * @returns Array of patterns (may be fewer than ids if some not found)
   *
   * @example
   * const patternRefs = [{ ref: 'uuid-1' }, { ref: 'uuid-2' }]
   * const patterns = await PatternsService.getByIds(
   *   patternRefs.map(p => p.ref),
   *   userId
   * )
   */
  static async getByIds(
    ids: string[],
    userId: string
  ): Promise<Pattern[]> {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return []
      }

      if (!userId?.trim()) {
        throw new Error('User ID is required for authentication')
      }

      // Filter out empty IDs
      const validIds = ids.filter(id => id && id.trim())
      if (validIds.length === 0) {
        return []
      }

      // Build WHERE IN clause
      const placeholders = validIds.map((_, i) => `$${i + 1}`).join(', ')

      const patterns = await queryWithRLS<DbPattern>(
        `
        SELECT
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        FROM "patterns"
        WHERE id IN (${placeholders})
        `,
        validIds,
        userId
      )

      return patterns.map((pattern) => ({
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }))
    } catch (error) {
      console.error('[PatternsService.getByIds] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch patterns by IDs'
      )
    }
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new pattern
   *
   * @param userId - Current user ID (will be pattern owner)
   * @param teamId - Team ID (pattern belongs to team)
   * @param data - Pattern data
   * @returns Created pattern
   *
   * @example
   * const pattern = await PatternsService.create(userId, teamId, {
   *   title: 'Newsletter CTA',
   *   slug: 'newsletter-cta',
   *   blocks: [...],
   *   status: 'draft'
   * })
   */
  static async create(
    userId: string,
    teamId: string,
    data: CreatePatternInput
  ): Promise<Pattern> {
    try {
      if (!userId?.trim()) {
        throw new Error('User ID is required')
      }

      if (!teamId?.trim()) {
        throw new Error('Team ID is required')
      }

      if (!data.title?.trim()) {
        throw new Error('Title is required')
      }

      if (!data.slug?.trim()) {
        throw new Error('Slug is required')
      }

      // Validate: patterns cannot contain other patterns (prevent nesting)
      if (data.blocks && containsPatternReference(data.blocks)) {
        throw new Error('Patterns cannot contain other patterns')
      }

      const result = await mutateWithRLS<DbPattern>(
        `
        INSERT INTO "patterns" (
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        `,
        [
          userId,
          teamId,
          data.title,
          data.slug,
          JSON.stringify(data.blocks || []),
          data.status || 'draft',
          data.description || null
        ],
        userId
      )

      if (!result || result.rows.length === 0) {
        throw new Error('Failed to create pattern')
      }

      const pattern = result.rows[0]

      return {
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }
    } catch (error) {
      console.error('[PatternsService.create] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create pattern'
      )
    }
  }

  /**
   * Update an existing pattern
   *
   * @param id - Pattern ID
   * @param userId - Current user ID for RLS
   * @param data - Pattern data to update
   * @returns Updated pattern
   *
   * @example
   * const pattern = await PatternsService.update('pattern-id', userId, {
   *   title: 'Updated Title',
   *   status: 'published'
   * })
   */
  static async update(
    id: string,
    userId: string,
    data: UpdatePatternInput
  ): Promise<Pattern> {
    try {
      if (!id?.trim()) {
        throw new Error('Pattern ID is required')
      }

      if (!userId?.trim()) {
        throw new Error('User ID is required')
      }

      // Validate: patterns cannot contain other patterns (prevent nesting)
      if (data.blocks !== undefined && containsPatternReference(data.blocks)) {
        throw new Error('Patterns cannot contain other patterns')
      }

      // Build SET clause dynamically
      const updates: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex}`)
        params.push(data.title)
        paramIndex++
      }

      if (data.slug !== undefined) {
        updates.push(`slug = $${paramIndex}`)
        params.push(data.slug)
        paramIndex++
      }

      if (data.blocks !== undefined) {
        updates.push(`blocks = $${paramIndex}`)
        params.push(JSON.stringify(data.blocks))
        paramIndex++
      }

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`)
        params.push(data.status)
        paramIndex++
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`)
        params.push(data.description || null)
        paramIndex++
      }

      if (updates.length === 0) {
        throw new Error('No fields to update')
      }

      params.push(id)

      const result = await mutateWithRLS<DbPattern>(
        `
        UPDATE "patterns"
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING
          id,
          "userId",
          "teamId",
          title,
          slug,
          blocks,
          status,
          description,
          "createdAt",
          "updatedAt"
        `,
        params,
        userId
      )

      if (!result || result.rows.length === 0) {
        throw new Error('Pattern not found or not authorized')
      }

      const pattern = result.rows[0]

      return {
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }
    } catch (error) {
      console.error('[PatternsService.update] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to update pattern'
      )
    }
  }

  /**
   * Delete a pattern
   *
   * WARNING: This does not check for pattern references in pages.
   * Consider implementing soft delete or reference counting before deletion.
   *
   * @param id - Pattern ID
   * @param userId - Current user ID for RLS
   * @returns True if deleted successfully
   *
   * @example
   * await PatternsService.delete('pattern-id', userId)
   */
  static async delete(
    id: string,
    userId: string
  ): Promise<boolean> {
    try {
      if (!id?.trim()) {
        throw new Error('Pattern ID is required')
      }

      if (!userId?.trim()) {
        throw new Error('User ID is required')
      }

      const result = await mutateWithRLS<DbPattern>(
        `
        DELETE FROM "patterns"
        WHERE id = $1
        RETURNING id
        `,
        [id],
        userId
      )

      return result && result.rows.length > 0
    } catch (error) {
      console.error('[PatternsService.delete] Error:', error)
      throw new Error(
        error instanceof Error ? error.message : 'Failed to delete pattern'
      )
    }
  }
}
