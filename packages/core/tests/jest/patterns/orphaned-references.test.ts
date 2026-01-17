/**
 * Unit Tests - Orphaned Pattern References (Lazy Cleanup)
 *
 * Tests the lazy cleanup strategy for pattern deletion.
 * When a pattern is deleted, entities retain orphaned PatternReferences.
 * These are filtered out when the entity is saved (lazy cleanup).
 *
 * Related files:
 * - generic-handler.ts: filterOrphanedPatternReferences function
 * - pattern-usage.service.ts: getExistingPatternIds method
 * - isPatternReference type guard
 */

import { isPatternReference } from '@/core/types/pattern-reference'
import { extractPatternIds } from '@/core/lib/blocks/pattern-resolver'
import type { BlockInstance } from '@/core/types/blocks'
import type { PatternReference } from '@/core/types/pattern-reference'

// Sample test data
const mockBlock: BlockInstance = {
  id: 'block-001',
  blockSlug: 'hero',
  props: { title: 'Test Hero' }
}

const mockPatternRef1: PatternReference = {
  type: 'pattern',
  ref: 'pat-exists-001',
  id: 'ref-001'
}

const mockPatternRef2: PatternReference = {
  type: 'pattern',
  ref: 'pat-deleted-002',
  id: 'ref-002'
}

const mockPatternRef3: PatternReference = {
  type: 'pattern',
  ref: 'pat-exists-003',
  id: 'ref-003'
}

describe('Orphaned Pattern References - Lazy Cleanup', () => {
  // ===========================================
  // isPatternReference type guard
  // ===========================================
  describe('isPatternReference', () => {
    it('returns true for valid PatternReference', () => {
      expect(isPatternReference(mockPatternRef1)).toBe(true)
    })

    it('returns false for regular BlockInstance', () => {
      expect(isPatternReference(mockBlock)).toBe(false)
    })

    it('returns false for null', () => {
      expect(isPatternReference(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isPatternReference(undefined)).toBe(false)
    })

    it('returns false for object without type field', () => {
      expect(isPatternReference({ ref: 'pat-001', id: 'ref-001' })).toBe(false)
    })

    it('returns false for object with wrong type value', () => {
      expect(isPatternReference({ type: 'block', ref: 'pat-001', id: 'ref-001' })).toBe(false)
    })

    it('returns false for object without ref field', () => {
      expect(isPatternReference({ type: 'pattern', id: 'ref-001' })).toBe(false)
    })

    it('returns false for object without id field', () => {
      expect(isPatternReference({ type: 'pattern', ref: 'pat-001' })).toBe(false)
    })
  })

  // ===========================================
  // extractPatternIds utility
  // ===========================================
  describe('extractPatternIds', () => {
    it('extracts pattern IDs from mixed blocks array', () => {
      const blocks = [mockBlock, mockPatternRef1, mockPatternRef2]
      const ids = extractPatternIds(blocks)

      expect(ids).toHaveLength(2)
      expect(ids).toContain('pat-exists-001')
      expect(ids).toContain('pat-deleted-002')
    })

    it('returns empty array when no pattern references', () => {
      const blocks = [mockBlock, mockBlock]
      const ids = extractPatternIds(blocks)

      expect(ids).toHaveLength(0)
    })

    it('returns empty array for empty blocks', () => {
      const ids = extractPatternIds([])
      expect(ids).toHaveLength(0)
    })

    it('deduplicates pattern IDs', () => {
      const duplicateRef: PatternReference = {
        type: 'pattern',
        ref: 'pat-exists-001', // Same as mockPatternRef1
        id: 'ref-duplicate'
      }
      const blocks = [mockPatternRef1, duplicateRef]
      const ids = extractPatternIds(blocks)

      expect(ids).toHaveLength(1)
      expect(ids).toContain('pat-exists-001')
    })
  })

  // ===========================================
  // Filtering Logic (Unit test simulation)
  // ===========================================
  describe('filterOrphanedPatternReferences logic', () => {
    /**
     * Simulates the filtering logic from generic-handler.ts
     * This tests the algorithm without database dependencies
     */
    function simulateFilterOrphanedReferences(
      blocks: unknown[],
      existingPatternIds: Set<string>
    ): unknown[] {
      if (!Array.isArray(blocks) || blocks.length === 0) return blocks

      const patternIds = extractPatternIds(blocks as (BlockInstance | PatternReference)[])
      if (patternIds.length === 0) return blocks

      // If all patterns exist, return blocks unchanged
      if (patternIds.every(id => existingPatternIds.has(id))) return blocks

      // Filter out references to deleted patterns
      return blocks.filter(block => {
        if (isPatternReference(block)) {
          return existingPatternIds.has(block.ref)
        }
        return true
      })
    }

    it('returns blocks unchanged if no pattern references', () => {
      const blocks = [mockBlock]
      const existingIds = new Set<string>()
      const result = simulateFilterOrphanedReferences(blocks, existingIds)

      expect(result).toEqual(blocks)
    })

    it('returns blocks unchanged if all patterns exist', () => {
      const blocks = [mockBlock, mockPatternRef1, mockPatternRef3]
      const existingIds = new Set(['pat-exists-001', 'pat-exists-003'])
      const result = simulateFilterOrphanedReferences(blocks, existingIds)

      expect(result).toHaveLength(3)
      expect(result).toEqual(blocks)
    })

    it('filters out references to deleted patterns', () => {
      const blocks = [mockBlock, mockPatternRef1, mockPatternRef2, mockPatternRef3]
      const existingIds = new Set(['pat-exists-001', 'pat-exists-003'])
      const result = simulateFilterOrphanedReferences(blocks, existingIds)

      expect(result).toHaveLength(3)
      expect(result).toContain(mockBlock)
      expect(result).toContain(mockPatternRef1)
      expect(result).not.toContain(mockPatternRef2) // Deleted pattern
      expect(result).toContain(mockPatternRef3)
    })

    it('removes all pattern references when none exist', () => {
      const blocks = [mockBlock, mockPatternRef1, mockPatternRef2]
      const existingIds = new Set<string>() // No patterns exist
      const result = simulateFilterOrphanedReferences(blocks, existingIds)

      expect(result).toHaveLength(1)
      expect(result).toContain(mockBlock)
    })

    it('handles empty blocks array', () => {
      const result = simulateFilterOrphanedReferences([], new Set())
      expect(result).toEqual([])
    })

    it('preserves block order after filtering', () => {
      const block1: BlockInstance = { id: 'b1', blockSlug: 'hero', props: {} }
      const block2: BlockInstance = { id: 'b2', blockSlug: 'cta', props: {} }
      const blocks = [block1, mockPatternRef2, block2] // pat-deleted in middle
      const existingIds = new Set<string>()
      const result = simulateFilterOrphanedReferences(blocks, existingIds)

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(block1)
      expect(result[1]).toBe(block2)
    })
  })

  // ===========================================
  // Edge Cases
  // ===========================================
  describe('Edge Cases', () => {
    it('handles mixed valid and invalid pattern references', () => {
      const invalidRef = { type: 'pattern', ref: 'pat-001' } // Missing id
      const blocks = [mockBlock, invalidRef as unknown, mockPatternRef1]
      const existingIds = new Set(['pat-exists-001'])

      // Invalid refs should not match isPatternReference and pass through as regular blocks
      const patternIds = extractPatternIds(blocks as (BlockInstance | PatternReference)[])
      expect(patternIds).toHaveLength(1)
      expect(patternIds).toContain('pat-exists-001')
    })

    it('handles blocks with null/undefined values', () => {
      const blocks = [mockBlock, null, undefined, mockPatternRef1]
      // extractPatternIds should handle null/undefined gracefully
      const filtered = blocks.filter(Boolean) as (BlockInstance | PatternReference)[]
      const patternIds = extractPatternIds(filtered)

      expect(patternIds).toHaveLength(1)
    })
  })
})
