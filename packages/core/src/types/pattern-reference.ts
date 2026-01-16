/**
 * Pattern Reference Types
 *
 * These types define the structure of pattern references stored in page blocks.
 * Pattern references are resolved at render time to support automatic propagation
 * of changes when patterns are edited.
 *
 * NOTE: The Pattern entity itself (config, service, fields) lives in the theme.
 * Only the reference types are in core because they're used by core components.
 */

import type { BlockInstance } from './blocks'

/**
 * Pattern status values
 */
export type PatternStatus = 'draft' | 'published'

/**
 * Pattern entity (minimal interface for core components)
 *
 * This is the minimal Pattern interface needed by core components.
 * The full Pattern type with all fields is defined in the theme entity.
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
