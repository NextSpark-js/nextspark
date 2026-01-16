/**
 * Pattern Resolver Utility
 *
 * Resolves pattern references in blocks arrays by replacing references
 * with the actual blocks from the pattern.
 *
 * Used in public page rendering to expand pattern references so that
 * pages show the actual pattern content instead of references.
 *
 * @module core/lib/blocks/pattern-resolver
 */

import type { BlockInstance } from '@/core/types/blocks'
import type { Pattern, PatternReference } from '@/core/types/pattern-reference'
import { isPatternReference } from '@/core/types/pattern-reference'

/**
 * Resolve pattern references in a blocks array
 *
 * Replaces { type: 'pattern', ref: 'uuid' } with actual blocks from the pattern.
 * Pattern references are expanded inline, maintaining the order of the blocks array.
 *
 * If a pattern is not found in the cache, the reference is skipped (graceful degradation).
 *
 * @param blocks - Array of blocks which may contain pattern references
 * @param patternCache - Map of pattern ID -> Pattern data
 * @returns Flattened array of blocks with patterns expanded
 *
 * @example
 * // Input blocks array:
 * [
 *   { id: 'block-1', blockSlug: 'hero', props: {...} },
 *   { type: 'pattern', ref: 'pattern-uuid', id: 'instance-1' },
 *   { id: 'block-2', blockSlug: 'cta', props: {...} }
 * ]
 *
 * // Pattern with uuid 'pattern-uuid' contains:
 * [
 *   { id: 'p-block-1', blockSlug: 'text', props: {...} },
 *   { id: 'p-block-2', blockSlug: 'button', props: {...} }
 * ]
 *
 * // Result after resolution:
 * [
 *   { id: 'block-1', blockSlug: 'hero', props: {...} },
 *   { id: 'p-block-1', blockSlug: 'text', props: {...} },    // From pattern
 *   { id: 'p-block-2', blockSlug: 'button', props: {...} },  // From pattern
 *   { id: 'block-2', blockSlug: 'cta', props: {...} }
 * ]
 */
export function resolvePatternReferences(
  blocks: (BlockInstance | PatternReference)[],
  patternCache: Map<string, Pattern>
): BlockInstance[] {
  const resolved: BlockInstance[] = []

  for (const block of blocks) {
    if (isPatternReference(block)) {
      // This is a pattern reference - resolve it
      const pattern = patternCache.get(block.ref)

      if (pattern) {
        // Expand pattern blocks into the result
        // Each block from the pattern is added individually
        resolved.push(...pattern.blocks)
      } else {
        // Pattern not found - skip gracefully
        // Could optionally add a placeholder block here
        console.warn(
          `[pattern-resolver] Pattern not found: ${block.ref} (instance: ${block.id})`
        )
      }
    } else {
      // Regular block - add as-is
      resolved.push(block as BlockInstance)
    }
  }

  return resolved
}

/**
 * Extract pattern IDs from a blocks array
 *
 * Scans blocks array and returns unique pattern IDs that need to be fetched.
 * Used to batch fetch all referenced patterns in a single query.
 *
 * @param blocks - Array of blocks which may contain pattern references
 * @returns Array of unique pattern IDs
 *
 * @example
 * const blocks = [
 *   { id: 'block-1', blockSlug: 'hero', props: {...} },
 *   { type: 'pattern', ref: 'pattern-uuid-1', id: 'instance-1' },
 *   { type: 'pattern', ref: 'pattern-uuid-2', id: 'instance-2' },
 *   { type: 'pattern', ref: 'pattern-uuid-1', id: 'instance-3' },  // Duplicate
 *   { id: 'block-2', blockSlug: 'cta', props: {...} }
 * ]
 *
 * const patternIds = extractPatternIds(blocks)
 * // Result: ['pattern-uuid-1', 'pattern-uuid-2']
 */
export function extractPatternIds(
  blocks: (BlockInstance | PatternReference)[]
): string[] {
  const ids = new Set<string>()

  for (const block of blocks) {
    if (isPatternReference(block)) {
      ids.add(block.ref)
    }
  }

  return Array.from(ids)
}
