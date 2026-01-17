/**
 * Pattern Usage Service
 *
 * Tracks which entities (pages, posts, etc.) use each pattern.
 * Provides sync, query, and count operations for pattern usage tracking.
 *
 * @module PatternUsageService
 */

import { queryWithRLS, mutateWithRLS, queryOneWithRLS } from '../db'
import { extractPatternIds } from '../blocks/pattern-resolver'
import type { BlockInstance } from '../../types/blocks'
import type { PatternReference } from '../../types/pattern-reference'

// ============================================
// TYPES
// ============================================

export interface PatternUsage {
  id: string
  patternId: string
  entityType: string
  entityId: string
  teamId: string
  createdAt: string
}

export interface PatternUsageWithEntityInfo extends PatternUsage {
  entityTitle?: string
  entitySlug?: string
  entityStatus?: string
  entityUpdatedAt?: string
}

export interface PatternUsageCount {
  entityType: string
  count: number
}

export interface GetUsagesOptions {
  entityType?: string
  limit?: number
  offset?: number
}

export interface GetUsagesResult {
  usages: PatternUsageWithEntityInfo[]
  counts: PatternUsageCount[]
  total: number
}

// ============================================
// PATTERN USAGE SERVICE
// ============================================

export class PatternUsageService {
  /**
   * Sync pattern usages for an entity
   *
   * Extracts pattern references from blocks and updates the usage table.
   * Uses diff-based approach: only adds new and removes old references.
   *
   * @param entityType - Type of entity (e.g., 'pages', 'posts')
   * @param entityId - ID of the entity
   * @param teamId - Team ID for isolation
   * @param blocks - Array of blocks that may contain pattern references
   * @param userId - User ID for RLS
   */
  static async syncUsages(
    entityType: string,
    entityId: string,
    teamId: string,
    blocks: (BlockInstance | PatternReference)[],
    userId: string
  ): Promise<void> {
    try {
      // 1. Extract current pattern IDs from blocks
      const currentPatternIds = new Set(extractPatternIds(blocks))

      // 2. Get existing usages from DB
      const existingUsages = await queryWithRLS<{ patternId: string }>(
        `SELECT "patternId" FROM pattern_usages
         WHERE "entityType" = $1 AND "entityId" = $2`,
        [entityType, entityId],
        userId
      )
      const existingPatternIds = new Set(existingUsages.map(u => u.patternId))

      // 3. Calculate diff
      const toAdd = [...currentPatternIds].filter(id => !existingPatternIds.has(id))
      const toRemove = [...existingPatternIds].filter(id => !currentPatternIds.has(id))

      // 4. Remove old usages
      if (toRemove.length > 0) {
        await mutateWithRLS(
          `DELETE FROM pattern_usages
           WHERE "entityType" = $1 AND "entityId" = $2 AND "patternId" = ANY($3)`,
          [entityType, entityId, toRemove],
          userId
        )
      }

      // 5. Add new usages
      if (toAdd.length > 0) {
        const insertValues: unknown[] = []
        const placeholders: string[] = []
        let paramIndex = 1

        for (const patternId of toAdd) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
          insertValues.push(patternId, entityType, entityId, teamId)
          paramIndex += 4
        }

        await mutateWithRLS(
          `INSERT INTO pattern_usages ("patternId", "entityType", "entityId", "teamId")
           VALUES ${placeholders.join(', ')}
           ON CONFLICT ("patternId", "entityType", "entityId") DO NOTHING`,
          insertValues,
          userId
        )
      }

      console.log(`[PatternUsageService] Synced usages for ${entityType}/${entityId}: +${toAdd.length} -${toRemove.length}`)
    } catch (error) {
      // Log but don't fail the entity save
      console.error(`[PatternUsageService] Error syncing usages for ${entityType}/${entityId}:`, error)
    }
  }

  /**
   * Remove all usages for an entity (on delete)
   *
   * @param entityType - Type of entity
   * @param entityId - ID of the entity
   * @param userId - User ID for RLS
   */
  static async removeEntityUsages(
    entityType: string,
    entityId: string,
    userId: string
  ): Promise<void> {
    try {
      await mutateWithRLS(
        `DELETE FROM pattern_usages
         WHERE "entityType" = $1 AND "entityId" = $2`,
        [entityType, entityId],
        userId
      )
      console.log(`[PatternUsageService] Removed usages for ${entityType}/${entityId}`)
    } catch (error) {
      console.error(`[PatternUsageService] Error removing usages for ${entityType}/${entityId}:`, error)
    }
  }

  /**
   * Get usage count for a pattern
   *
   * @param patternId - Pattern ID
   * @param userId - User ID for RLS
   * @returns Total usage count
   */
  static async getUsageCount(
    patternId: string,
    userId: string
  ): Promise<number> {
    const result = await queryOneWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM pattern_usages WHERE "patternId" = $1`,
      [patternId],
      userId
    )
    return parseInt(result?.count || '0', 10)
  }

  /**
   * Get usage counts grouped by entity type
   *
   * @param patternId - Pattern ID
   * @param userId - User ID for RLS
   * @returns Array of counts by entity type
   */
  static async getUsageCounts(
    patternId: string,
    userId: string
  ): Promise<PatternUsageCount[]> {
    const results = await queryWithRLS<{ entityType: string; count: string }>(
      `SELECT "entityType", COUNT(*)::text as count
       FROM pattern_usages
       WHERE "patternId" = $1
       GROUP BY "entityType"
       ORDER BY count DESC`,
      [patternId],
      userId
    )
    return results.map(r => ({
      entityType: r.entityType,
      count: parseInt(r.count, 10)
    }))
  }

  /**
   * Get detailed usages with entity information
   *
   * Joins with entity tables to get title, slug, status, etc.
   *
   * @param patternId - Pattern ID
   * @param userId - User ID for RLS
   * @param options - Filtering and pagination options
   * @returns Usages with entity info, counts, and total
   */
  static async getUsagesWithEntityInfo(
    patternId: string,
    userId: string,
    options: GetUsagesOptions = {}
  ): Promise<GetUsagesResult> {
    const { entityType, limit = 50, offset = 0 } = options

    // Build WHERE clause
    let whereClause = 'WHERE pu."patternId" = $1'
    const params: unknown[] = [patternId]
    let paramIndex = 2

    if (entityType) {
      whereClause += ` AND pu."entityType" = $${paramIndex}`
      params.push(entityType)
      paramIndex++
    }

    // Get total count
    const countResult = await queryOneWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM pattern_usages pu ${whereClause}`,
      params,
      userId
    )
    const total = parseInt(countResult?.count || '0', 10)

    // Get counts by entity type
    const counts = await this.getUsageCounts(patternId, userId)

    // Get usages with basic info
    // Note: We can't easily JOIN with dynamic entity tables, so we return basic info
    // The frontend can fetch additional entity details if needed
    const usages = await queryWithRLS<PatternUsage>(
      `SELECT pu.id, pu."patternId", pu."entityType", pu."entityId", pu."teamId", pu."createdAt"
       FROM pattern_usages pu
       ${whereClause}
       ORDER BY pu."createdAt" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
      userId
    )

    // Enrich usages with entity info (batch by entityType for efficiency)
    const enrichedUsages = await this.enrichUsagesWithEntityInfo(usages, userId)

    return {
      usages: enrichedUsages,
      counts,
      total
    }
  }

  /**
   * Enrich usages with entity information
   *
   * Batches queries by entity type for efficiency.
   *
   * @param usages - Array of pattern usages
   * @param userId - User ID for RLS
   * @returns Usages with entity info added
   */
  private static async enrichUsagesWithEntityInfo(
    usages: PatternUsage[],
    userId: string
  ): Promise<PatternUsageWithEntityInfo[]> {
    if (usages.length === 0) return []

    // Group usages by entity type
    const usagesByType = new Map<string, PatternUsage[]>()
    for (const usage of usages) {
      const existing = usagesByType.get(usage.entityType) || []
      existing.push(usage)
      usagesByType.set(usage.entityType, existing)
    }

    // Fetch entity info for each type
    const entityInfoMap = new Map<string, Map<string, { title?: string; slug?: string; status?: string; updatedAt?: string }>>()

    for (const [entityType, typeUsages] of usagesByType) {
      const entityIds = typeUsages.map(u => u.entityId)
      const tableName = entityType // Assumes table name matches entity type (pages, posts, etc.)

      try {
        // Try to fetch common fields (title, slug, status, updatedAt)
        const entities = await queryWithRLS<{
          id: string
          title?: string
          name?: string
          slug?: string
          status?: string
          updatedAt?: string
        }>(
          `SELECT id,
                  COALESCE(title, name) as title,
                  slug,
                  status,
                  "updatedAt"
           FROM "${tableName}"
           WHERE id = ANY($1)`,
          [entityIds],
          userId
        )

        const infoMap = new Map<string, { title?: string; slug?: string; status?: string; updatedAt?: string }>()
        for (const entity of entities) {
          infoMap.set(entity.id, {
            title: entity.title,
            slug: entity.slug,
            status: entity.status,
            updatedAt: entity.updatedAt
          })
        }
        entityInfoMap.set(entityType, infoMap)
      } catch (error) {
        // Table might not have these columns, that's OK
        console.warn(`[PatternUsageService] Could not fetch entity info for ${entityType}:`, error)
        entityInfoMap.set(entityType, new Map())
      }
    }

    // Merge entity info into usages
    return usages.map(usage => {
      const typeInfo = entityInfoMap.get(usage.entityType)
      const entityInfo = typeInfo?.get(usage.entityId)
      return {
        ...usage,
        entityTitle: entityInfo?.title,
        entitySlug: entityInfo?.slug,
        entityStatus: entityInfo?.status,
        entityUpdatedAt: entityInfo?.updatedAt
      }
    })
  }

  /**
   * Get all pattern IDs that have usages
   * Useful for checking if any patterns are in use before bulk operations
   *
   * @param patternIds - Array of pattern IDs to check
   * @param userId - User ID for RLS
   * @returns Array of pattern IDs that have at least one usage
   */
  static async getPatternsWithUsages(
    patternIds: string[],
    userId: string
  ): Promise<string[]> {
    if (patternIds.length === 0) return []

    const results = await queryWithRLS<{ patternId: string }>(
      `SELECT DISTINCT "patternId" FROM pattern_usages WHERE "patternId" = ANY($1)`,
      [patternIds],
      userId
    )
    return results.map(r => r.patternId)
  }

  /**
   * Validate which pattern IDs exist in the database
   *
   * Returns only the IDs that exist and are accessible.
   * Used for lazy cleanup - filtering orphaned pattern references on entity save.
   *
   * @param patternIds - Array of pattern IDs to check
   * @param userId - User ID for RLS
   * @returns Set of pattern IDs that exist
   */
  static async getExistingPatternIds(
    patternIds: string[],
    userId: string
  ): Promise<Set<string>> {
    if (!patternIds.length) return new Set()

    const result = await queryWithRLS<{ id: string }>(
      `SELECT id FROM patterns WHERE id = ANY($1::text[])`,
      [patternIds],
      userId
    )

    return new Set(result.map(r => r.id))
  }
}
