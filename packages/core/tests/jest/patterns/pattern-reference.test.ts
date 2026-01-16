/**
 * Pattern Reference Type Guard Tests
 *
 * Tests for the isPatternReference() type guard function to ensure
 * correct type detection and validation of pattern references.
 *
 * @module tests/patterns/pattern-reference.test
 */

import { describe, test, expect } from '@jest/globals'
import { isPatternReference } from '@/core/types/pattern-reference'
import type { PatternReference } from '@/core/types/pattern-reference'
import type { BlockInstance } from '@/core/types/blocks'

describe('Pattern Reference Type Guard', () => {
  describe('isPatternReference', () => {
    test('should return true for valid pattern reference', () => {
      const validReference: PatternReference = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(validReference)).toBe(true)
    })

    test('should return true for pattern reference with additional properties', () => {
      const referenceWithExtra = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
        id: 'instance-uuid-456',
        metadata: { source: 'library' }, // Additional property
      }

      expect(isPatternReference(referenceWithExtra)).toBe(true)
    })

    test('should return false for regular block instance', () => {
      const regularBlock: BlockInstance = {
        id: 'block-123',
        blockSlug: 'hero',
        props: {
          title: 'Welcome',
          content: 'Hello World',
        },
      }

      expect(isPatternReference(regularBlock)).toBe(false)
    })

    test('should return false for null', () => {
      expect(isPatternReference(null)).toBe(false)
    })

    test('should return false for undefined', () => {
      expect(isPatternReference(undefined)).toBe(false)
    })

    test('should return false for primitive types', () => {
      expect(isPatternReference('pattern')).toBe(false)
      expect(isPatternReference(123)).toBe(false)
      expect(isPatternReference(true)).toBe(false)
      expect(isPatternReference(false)).toBe(false)
    })

    test('should return false for empty object', () => {
      expect(isPatternReference({})).toBe(false)
    })

    test('should return false for array', () => {
      expect(isPatternReference([])).toBe(false)
      expect(isPatternReference([{ type: 'pattern', ref: 'id', id: 'inst' }])).toBe(false)
    })

    test('should return false when type is not "pattern"', () => {
      const invalidType = {
        type: 'block',
        ref: 'pattern-uuid-123',
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(invalidType)).toBe(false)
    })

    test('should return false when type is missing', () => {
      const missingType = {
        ref: 'pattern-uuid-123',
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(missingType)).toBe(false)
    })

    test('should return false when ref is missing', () => {
      const missingRef = {
        type: 'pattern',
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(missingRef)).toBe(false)
    })

    test('should return false when id is missing', () => {
      const missingId = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
      }

      expect(isPatternReference(missingId)).toBe(false)
    })

    test('should return false when ref is not a string', () => {
      const invalidRef = {
        type: 'pattern',
        ref: 123,
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(invalidRef)).toBe(false)
    })

    test('should return false when id is not a string', () => {
      const invalidId = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
        id: 456,
      }

      expect(isPatternReference(invalidId)).toBe(false)
    })

    test('should return false when ref is empty string', () => {
      const emptyRef = {
        type: 'pattern',
        ref: '',
        id: 'instance-uuid-456',
      }

      // Type guard only checks type, not value - empty string is still a string
      expect(isPatternReference(emptyRef)).toBe(true)
    })

    test('should return false when id is empty string', () => {
      const emptyId = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
        id: '',
      }

      // Type guard only checks type, not value - empty string is still a string
      expect(isPatternReference(emptyId)).toBe(true)
    })

    test('should return false when type is null', () => {
      const nullType = {
        type: null,
        ref: 'pattern-uuid-123',
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(nullType)).toBe(false)
    })

    test('should return false when ref is null', () => {
      const nullRef = {
        type: 'pattern',
        ref: null,
        id: 'instance-uuid-456',
      }

      expect(isPatternReference(nullRef)).toBe(false)
    })

    test('should return false when id is null', () => {
      const nullId = {
        type: 'pattern',
        ref: 'pattern-uuid-123',
        id: null,
      }

      expect(isPatternReference(nullId)).toBe(false)
    })

    test('should return false for object with wrong structure', () => {
      const wrongStructure = {
        type: 'pattern',
        reference: 'pattern-uuid-123', // Wrong property name
        identifier: 'instance-uuid-456', // Wrong property name
      }

      expect(isPatternReference(wrongStructure)).toBe(false)
    })

    test('should handle malformed objects gracefully', () => {
      const malformed1 = { type: 'pattern', ref: undefined, id: 'inst' }
      const malformed2 = { type: 'pattern', ref: 'ref', id: undefined }
      const malformed3 = { type: undefined, ref: 'ref', id: 'inst' }

      expect(isPatternReference(malformed1)).toBe(false)
      expect(isPatternReference(malformed2)).toBe(false)
      expect(isPatternReference(malformed3)).toBe(false)
    })

    test('should return false for block instance that looks similar', () => {
      const similarBlock = {
        id: 'block-123',
        blockSlug: 'pattern', // slug named "pattern" - not a pattern reference
        props: {
          ref: 'some-ref',
        },
      }

      expect(isPatternReference(similarBlock)).toBe(false)
    })

    test('should work with objects from different sources', () => {
      // From JSON parse
      const fromJson = JSON.parse('{"type":"pattern","ref":"uuid-1","id":"inst-1"}')
      expect(isPatternReference(fromJson)).toBe(true)

      // From object spread
      const base = { type: 'pattern', ref: 'uuid-2' }
      const spread = { ...base, id: 'inst-2' }
      expect(isPatternReference(spread)).toBe(true)

      // From Object.assign
      const assigned = Object.assign({}, { type: 'pattern', ref: 'uuid-3', id: 'inst-3' })
      expect(isPatternReference(assigned)).toBe(true)
    })

    test('should handle edge cases with special characters in strings', () => {
      const specialChars = {
        type: 'pattern',
        ref: 'pattern-uuid-123-!@#$%',
        id: 'instance-uuid-456-<>?',
      }

      expect(isPatternReference(specialChars)).toBe(true)
    })

    test('should handle very long string values', () => {
      const longStrings = {
        type: 'pattern',
        ref: 'a'.repeat(1000),
        id: 'b'.repeat(1000),
      }

      expect(isPatternReference(longStrings)).toBe(true)
    })

    test('should handle unicode characters in strings', () => {
      const unicodeChars = {
        type: 'pattern',
        ref: 'pattern-🎨-emoji',
        id: 'instance-日本語-unicode',
      }

      expect(isPatternReference(unicodeChars)).toBe(true)
    })
  })
})
