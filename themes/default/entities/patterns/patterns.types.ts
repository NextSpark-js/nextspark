/**
 * Patterns Service Types
 *
 * Type definitions for the patterns entity and pattern references.
 * Patterns is a team-scoped entity (shared: true) - all team members see the same patterns.
 */

import type { BlockInstance } from '@nextsparkjs/core/types/blocks'

/**
 * Pattern status values
 */
export type PatternStatus = 'draft' | 'published'

/**
 * Pattern entity
 *
 * Represents a reusable block composition.
 * System fields (id, userId, teamId, createdAt, updatedAt) are always included.
 */
export interface Pattern {
  id: string
  userId: string
  teamId: string
  title: string
  slug: string
  blocks: BlockInstance[]
  status: PatternStatus
  description?: string
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new pattern
 */
export interface CreatePatternInput {
  title: string
  slug: string
  blocks?: BlockInstance[]
  status?: PatternStatus
  description?: string
}

/**
 * Input for updating an existing pattern
 */
export interface UpdatePatternInput {
  title?: string
  slug?: string
  blocks?: BlockInstance[]
  status?: PatternStatus
  description?: string
}

/**
 * Pattern reference stored in page/post blocks array
 *
 * This is NOT a real block - it's a reference that gets resolved at render time.
 * The pattern's actual blocks are fetched and expanded when rendering the page.
 *
 * @example
 * // In a page's blocks array:
 * [
 *   { id: 'block-1', blockSlug: 'hero', props: {...} },
 *   { type: 'pattern', ref: 'pattern-uuid', id: 'instance-1' }, // Pattern reference
 *   { id: 'block-2', blockSlug: 'cta', props: {...} }
 * ]
 */
export interface PatternReference {
  type: 'pattern'
  ref: string  // Pattern UUID to resolve
  id: string   // Unique instance ID for this reference
}

/**
 * Type guard to check if a block is a pattern reference
 *
 * @param block - Block or pattern reference to check
 * @returns True if block is a pattern reference
 *
 * @example
 * if (isPatternReference(block)) {
 *   // Handle pattern reference
 *   const pattern = await PatternsService.getById(block.ref, userId)
 * } else {
 *   // Handle regular block
 *   renderBlock(block)
 * }
 */
export function isPatternReference(block: unknown): block is PatternReference {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as Record<string, unknown>).type === 'pattern' &&
    typeof (block as Record<string, unknown>).ref === 'string' &&
    typeof (block as Record<string, unknown>).id === 'string'
  )
}

/**
 * Options for listing patterns
 */
export interface PatternListOptions {
  limit?: number
  offset?: number
  status?: PatternStatus
  orderBy?: 'title' | 'slug' | 'status' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing patterns with pagination
 */
export interface PatternListResult {
  data: Pattern[]
  total: number
}
