/**
 * Pattern Resolver Utility Tests
 *
 * Tests for pattern resolution functions that expand pattern references
 * into actual blocks for page rendering.
 *
 * @module tests/patterns/pattern-resolver.test
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  resolvePatternReferences,
  extractPatternIds,
} from '@/core/lib/blocks/pattern-resolver'
import type { Pattern, PatternReference } from '@/core/types/pattern-reference'
import type { BlockInstance } from '@/core/types/blocks'

// Mock console.warn to suppress warnings in tests
const originalWarn = console.warn
beforeEach(() => {
  console.warn = jest.fn()
})

afterEach(() => {
  console.warn = originalWarn
})

describe('Pattern Resolver Utility', () => {
  describe('resolvePatternReferences', () => {
    test('should return empty array for empty input', () => {
      const result = resolvePatternReferences([], new Map())
      expect(result).toEqual([])
    })

    test('should pass through regular blocks unchanged', () => {
      const blocks: BlockInstance[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Welcome' },
        },
        {
          id: 'block-2',
          blockSlug: 'cta',
          props: { buttonText: 'Sign Up' },
        },
      ]

      const result = resolvePatternReferences(blocks, new Map())

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(blocks[0])
      expect(result[1]).toEqual(blocks[1])
    })

    test('should expand single pattern reference', () => {
      const patternBlocks: BlockInstance[] = [
        {
          id: 'pattern-block-1',
          blockSlug: 'text',
          props: { content: 'Text from pattern' },
        },
        {
          id: 'pattern-block-2',
          blockSlug: 'button',
          props: { text: 'Button from pattern' },
        },
      ]

      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'My Pattern',
        slug: 'my-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(patternBlocks[0])
      expect(result[1]).toEqual(patternBlocks[1])
    })

    test('should expand multiple pattern references', () => {
      const pattern1Blocks: BlockInstance[] = [
        {
          id: 'pattern1-block-1',
          blockSlug: 'header',
          props: { title: 'Header 1' },
        },
      ]

      const pattern2Blocks: BlockInstance[] = [
        {
          id: 'pattern2-block-1',
          blockSlug: 'footer',
          props: { text: 'Footer 1' },
        },
      ]

      const pattern1: Pattern = {
        id: 'pattern-1',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Pattern 1',
        slug: 'pattern-1',
        blocks: pattern1Blocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const pattern2: Pattern = {
        id: 'pattern-2',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Pattern 2',
        slug: 'pattern-2',
        blocks: pattern2Blocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-1', pattern1)
      patternCache.set('pattern-2', pattern2)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-1',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-2',
          id: 'instance-2',
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(pattern1Blocks[0])
      expect(result[1]).toEqual(pattern2Blocks[0])
    })

    test('should mix regular blocks and pattern references', () => {
      const patternBlocks: BlockInstance[] = [
        {
          id: 'pattern-block-1',
          blockSlug: 'text',
          props: { content: 'Pattern text' },
        },
      ]

      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'My Pattern',
        slug: 'my-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Hero' },
        },
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
        {
          id: 'block-2',
          blockSlug: 'cta',
          props: { text: 'CTA' },
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        id: 'block-1',
        blockSlug: 'hero',
        props: { title: 'Hero' },
      })
      expect(result[1]).toEqual(patternBlocks[0])
      expect(result[2]).toEqual({
        id: 'block-2',
        blockSlug: 'cta',
        props: { text: 'CTA' },
      })
    })

    test('should skip pattern reference when pattern not found (graceful degradation)', () => {
      const patternCache = new Map<string, Pattern>() // Empty cache

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Hero' },
        },
        {
          type: 'pattern',
          ref: 'missing-pattern',
          id: 'instance-1',
        },
        {
          id: 'block-2',
          blockSlug: 'cta',
          props: { text: 'CTA' },
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      // Pattern reference is skipped, only regular blocks remain
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'block-1',
        blockSlug: 'hero',
        props: { title: 'Hero' },
      })
      expect(result[1]).toEqual({
        id: 'block-2',
        blockSlug: 'cta',
        props: { text: 'CTA' },
      })

      // Should log warning
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pattern not found: missing-pattern')
      )
    })

    test('should handle pattern with empty blocks array', () => {
      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Empty Pattern',
        slug: 'empty-pattern',
        blocks: [], // No blocks
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Hero' },
        },
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
        {
          id: 'block-2',
          blockSlug: 'cta',
          props: { text: 'CTA' },
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      // Empty pattern adds nothing, only regular blocks remain
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(blocks[0])
      expect(result[1]).toEqual(blocks[2])
    })

    test('should handle pattern with many blocks', () => {
      const patternBlocks: BlockInstance[] = Array.from({ length: 10 }, (_, i) => ({
        id: `pattern-block-${i}`,
        blockSlug: 'text',
        props: { content: `Block ${i}` },
      }))

      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Large Pattern',
        slug: 'large-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(10)
      expect(result[0]).toEqual(patternBlocks[0])
      expect(result[9]).toEqual(patternBlocks[9])
    })

    test('should expand same pattern multiple times (multiple instances)', () => {
      const patternBlocks: BlockInstance[] = [
        {
          id: 'pattern-block-1',
          blockSlug: 'text',
          props: { content: 'Text' },
        },
      ]

      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'My Pattern',
        slug: 'my-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Hero' },
        },
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-2', // Same pattern, different instance ID
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(patternBlocks[0]) // First instance
      expect(result[1]).toEqual({
        id: 'block-1',
        blockSlug: 'hero',
        props: { title: 'Hero' },
      })
      expect(result[2]).toEqual(patternBlocks[0]) // Second instance
    })

    test('should preserve block props and structure', () => {
      const patternBlocks: BlockInstance[] = [
        {
          id: 'pattern-block-1',
          blockSlug: 'hero',
          props: {
            title: 'Welcome',
            content: 'This is content',
            cta: {
              text: 'Click Me',
              link: '/signup',
              target: '_blank',
            },
            backgroundColor: 'primary',
            className: 'custom-class',
          },
          order: 5,
        },
      ]

      const pattern: Pattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Complex Pattern',
        slug: 'complex-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-123', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(patternBlocks[0])
      expect(result[0].props.cta).toEqual({
        text: 'Click Me',
        link: '/signup',
        target: '_blank',
      })
      expect(result[0].order).toBe(5)
    })

    test('should handle mixed found and missing patterns', () => {
      const patternBlocks: BlockInstance[] = [
        {
          id: 'pattern-block-1',
          blockSlug: 'text',
          props: { content: 'Text' },
        },
      ]

      const pattern: Pattern = {
        id: 'pattern-found',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Found Pattern',
        slug: 'found-pattern',
        blocks: patternBlocks,
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const patternCache = new Map<string, Pattern>()
      patternCache.set('pattern-found', pattern)

      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-found',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-missing',
          id: 'instance-2',
        },
        {
          type: 'pattern',
          ref: 'pattern-found',
          id: 'instance-3',
        },
      ]

      const result = resolvePatternReferences(blocks, patternCache)

      // Missing pattern is skipped
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(patternBlocks[0])
      expect(result[1]).toEqual(patternBlocks[0])
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pattern not found: pattern-missing')
      )
    })
  })

  describe('extractPatternIds', () => {
    test('should return empty array for empty input', () => {
      const result = extractPatternIds([])
      expect(result).toEqual([])
    })

    test('should return empty array when no patterns exist', () => {
      const blocks: BlockInstance[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Welcome' },
        },
        {
          id: 'block-2',
          blockSlug: 'cta',
          props: { text: 'Sign Up' },
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toEqual([])
    })

    test('should extract single pattern ID', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-1',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toEqual(['pattern-123'])
    })

    test('should extract multiple unique pattern IDs', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-1',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-2',
          id: 'instance-2',
        },
        {
          type: 'pattern',
          ref: 'pattern-3',
          id: 'instance-3',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toEqual(['pattern-1', 'pattern-2', 'pattern-3'])
    })

    test('should deduplicate pattern IDs', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-1',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-2',
          id: 'instance-2',
        },
        {
          type: 'pattern',
          ref: 'pattern-1', // Duplicate
          id: 'instance-3',
        },
        {
          type: 'pattern',
          ref: 'pattern-2', // Duplicate
          id: 'instance-4',
        },
        {
          type: 'pattern',
          ref: 'pattern-1', // Duplicate
          id: 'instance-5',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toHaveLength(2)
      expect(result).toContain('pattern-1')
      expect(result).toContain('pattern-2')
    })

    test('should extract pattern IDs from mixed blocks and patterns', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          id: 'block-1',
          blockSlug: 'hero',
          props: { title: 'Hero' },
        },
        {
          type: 'pattern',
          ref: 'pattern-1',
          id: 'instance-1',
        },
        {
          id: 'block-2',
          blockSlug: 'text',
          props: { content: 'Text' },
        },
        {
          type: 'pattern',
          ref: 'pattern-2',
          id: 'instance-2',
        },
        {
          id: 'block-3',
          blockSlug: 'cta',
          props: { text: 'CTA' },
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toEqual(['pattern-1', 'pattern-2'])
    })

    test('should handle pattern IDs with special characters', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-uuid-123-abc',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern_with_underscores',
          id: 'instance-2',
        },
        {
          type: 'pattern',
          ref: 'pattern.with.dots',
          id: 'instance-3',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toHaveLength(3)
      expect(result).toContain('pattern-uuid-123-abc')
      expect(result).toContain('pattern_with_underscores')
      expect(result).toContain('pattern.with.dots')
    })

    test('should maintain insertion order for unique IDs', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: 'pattern-3',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-1',
          id: 'instance-2',
        },
        {
          type: 'pattern',
          ref: 'pattern-2',
          id: 'instance-3',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toEqual(['pattern-3', 'pattern-1', 'pattern-2'])
    })

    test('should handle large number of patterns', () => {
      const blocks: (BlockInstance | PatternReference)[] = Array.from(
        { length: 100 },
        (_, i) => ({
          type: 'pattern',
          ref: `pattern-${i}`,
          id: `instance-${i}`,
        })
      )

      const result = extractPatternIds(blocks)
      expect(result).toHaveLength(100)
      expect(result[0]).toBe('pattern-0')
      expect(result[99]).toBe('pattern-99')
    })

    test('should handle many duplicates efficiently', () => {
      // Same 5 patterns repeated 20 times each
      const blocks: (BlockInstance | PatternReference)[] = []
      for (let i = 0; i < 20; i++) {
        for (let j = 1; j <= 5; j++) {
          blocks.push({
            type: 'pattern',
            ref: `pattern-${j}`,
            id: `instance-${i}-${j}`,
          })
        }
      }

      const result = extractPatternIds(blocks)
      expect(result).toHaveLength(5)
      expect(result).toEqual(['pattern-1', 'pattern-2', 'pattern-3', 'pattern-4', 'pattern-5'])
    })

    test('should handle empty string pattern IDs', () => {
      const blocks: (BlockInstance | PatternReference)[] = [
        {
          type: 'pattern',
          ref: '',
          id: 'instance-1',
        },
        {
          type: 'pattern',
          ref: 'pattern-123',
          id: 'instance-2',
        },
      ]

      const result = extractPatternIds(blocks)
      expect(result).toHaveLength(2)
      expect(result).toContain('')
      expect(result).toContain('pattern-123')
    })
  })
})
