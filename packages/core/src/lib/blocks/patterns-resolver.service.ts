/**
 * Patterns Resolver Service
 *
 * Minimal service for resolving pattern references in public pages.
 * This is a core service that provides only the functionality needed
 * for public page rendering without RLS (for anonymous access).
 *
 * NOTE: The full PatternsService (CRUD, list, etc.) is in core/entities/patterns.
 * This service specifically handles anonymous pattern resolution at render time,
 * while PatternsService handles authenticated operations with RLS.
 *
 * @module core/lib/blocks/patterns-resolver.service
 */

import { query } from '../db'
import type { Pattern } from '../../types/pattern-reference'
import type { BlockInstance } from '../../types/blocks'

// Database row type for pattern
interface DbPattern {
  id: string
  userId: string
  teamId: string
  title: string
  slug: string
  blocks: unknown // JSONB
  status: 'draft' | 'published'
  description: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Core service for pattern resolution
 *
 * Provides only the methods needed for public page rendering.
 * Uses direct queries without RLS since public pages are anonymous.
 */
export class PatternsResolverService {
  /**
   * Get multiple patterns by IDs (batch fetch)
   *
   * Used for resolving pattern references in public pages.
   * Only fetches PUBLISHED patterns (drafts are not shown publicly), and only those of the team of the page that
   * references them: a pattern owned by another team is skipped, so the page renders without it.
   *
   * @param ids - Array of pattern IDs
   * @param teamId - Team of the page being rendered (a missing team resolves nothing)
   * @returns Array of published patterns of that team
   *
   * @example
   * const patternRefs = [{ ref: 'uuid-1' }, { ref: 'uuid-2' }]
   * const patterns = await PatternsResolverService.getByIds(
   *   patternRefs.map(p => p.ref),
   *   page.teamId
   * )
   */
  static async getByIds(ids: string[], teamId: string): Promise<Pattern[]> {
    try {
      if (!Array.isArray(ids) || ids.length === 0 || typeof teamId !== 'string' || !teamId) {
        return []
      }

      // Filter out empty IDs
      const validIds = ids.filter(id => id && id.trim())
      if (validIds.length === 0) {
        return []
      }

      // Build WHERE IN clause
      const placeholders = validIds.map((_, i) => `$${i + 1}`).join(', ')

      // Only fetch PUBLISHED patterns for public rendering
      const result = await query<DbPattern>(
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
          AND status = 'published'
          AND "teamId" = $${validIds.length + 1}
        `,
        [...validIds, teamId]
      )

      return result.rows.map((pattern) => ({
        id: pattern.id,
        userId: pattern.userId,
        teamId: pattern.teamId,
        title: pattern.title,
        slug: pattern.slug,
        blocks: Array.isArray(pattern.blocks) ? pattern.blocks as BlockInstance[] : [],
        status: pattern.status,
        description: pattern.description ?? undefined,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt
      }))
    } catch (error) {
      console.error('[PatternsResolverService.getByIds] Error:', error)
      // Return empty array on error - graceful degradation
      return []
    }
  }
}
