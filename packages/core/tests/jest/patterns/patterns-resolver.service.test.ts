/**
 * Patterns Resolver Service Tests
 *
 * Tests for the PatternsResolverService that fetches patterns from the database
 * for public page rendering.
 *
 * @module tests/patterns/patterns-resolver.service.test
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { PatternsResolverService } from '@/core/lib/blocks/patterns-resolver.service'
import type { Pattern } from '@/core/types/pattern-reference'
import type { BlockInstance } from '@/core/types/blocks'

// Mock the database module
jest.mock('@/core/lib/db', () => ({
  query: jest.fn(),
}))

// Import after mocking
import { query } from '@/core/lib/db'

const mockQuery = query as jest.MockedFunction<typeof query>

describe('PatternsResolverService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getByIds', () => {
    test('should return empty array for empty input array', async () => {
      const result = await PatternsResolverService.getByIds([])
      expect(result).toEqual([])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    test('should return empty array for null input', async () => {
      const result = await PatternsResolverService.getByIds(null as any)
      expect(result).toEqual([])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    test('should return empty array for undefined input', async () => {
      const result = await PatternsResolverService.getByIds(undefined as any)
      expect(result).toEqual([])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    test('should return empty array when all IDs are empty strings', async () => {
      const result = await PatternsResolverService.getByIds(['', '  ', '\t'])
      expect(result).toEqual([])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    test('should fetch single pattern by ID', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'My Pattern',
        slug: 'my-pattern',
        blocks: [
          {
            id: 'block-1',
            blockSlug: 'hero',
            props: { title: 'Welcome' },
          },
        ],
        status: 'published',
        description: 'A test pattern',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['pattern-123']
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN ($1)'),
        ['pattern-123']
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = \'published\''),
        ['pattern-123']
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'My Pattern',
        slug: 'my-pattern',
        blocks: mockPattern.blocks,
        status: 'published',
        description: 'A test pattern',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      })
    })

    test('should fetch multiple patterns by IDs', async () => {
      const mockPatterns = [
        {
          id: 'pattern-1',
          userId: 'user-1',
          teamId: 'team-1',
          title: 'Pattern 1',
          slug: 'pattern-1',
          blocks: [
            {
              id: 'block-1',
              blockSlug: 'hero',
              props: { title: 'Hero 1' },
            },
          ],
          status: 'published',
          description: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'pattern-2',
          userId: 'user-1',
          teamId: 'team-1',
          title: 'Pattern 2',
          slug: 'pattern-2',
          blocks: [
            {
              id: 'block-2',
              blockSlug: 'text',
              props: { content: 'Text 2' },
            },
          ],
          status: 'published',
          description: null,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ]

      mockQuery.mockResolvedValue({
        rows: mockPatterns,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-1', 'pattern-2'])

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN ($1, $2)'),
        ['pattern-1', 'pattern-2']
      )

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('pattern-1')
      expect(result[1].id).toBe('pattern-2')
    })

    test('should only fetch published patterns', async () => {
      // Database returns only published patterns (draft is filtered out by query)
      const mockPatterns = [
        {
          id: 'pattern-1',
          userId: 'user-1',
          teamId: 'team-1',
          title: 'Published Pattern',
          slug: 'published-pattern',
          blocks: [],
          status: 'published',
          description: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]

      mockQuery.mockResolvedValue({
        rows: mockPatterns,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-1', 'pattern-2'])

      // Verify query includes status filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = \'published\''),
        ['pattern-1', 'pattern-2']
      )

      // Only published pattern is returned
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('pattern-1')
      expect(result[0].status).toBe('published')
    })

    test('should handle null description field', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Pattern',
        slug: 'pattern',
        blocks: [],
        status: 'published',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toHaveLength(1)
      expect(result[0].description).toBeUndefined()
    })

    test('should handle pattern with description', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Pattern',
        slug: 'pattern',
        blocks: [],
        status: 'published',
        description: 'This is a description',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toHaveLength(1)
      expect(result[0].description).toBe('This is a description')
    })

    test('should handle pattern with complex blocks array', async () => {
      const complexBlocks: BlockInstance[] = [
        {
          id: 'block-1',
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
          },
        },
        {
          id: 'block-2',
          blockSlug: 'text',
          props: {
            content: 'More content',
          },
        },
      ]

      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Complex Pattern',
        slug: 'complex-pattern',
        blocks: complexBlocks,
        status: 'published',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toHaveLength(1)
      expect(result[0].blocks).toEqual(complexBlocks)
      expect(result[0].blocks[0].props.cta).toEqual({
        text: 'Click Me',
        link: '/signup',
        target: '_blank',
      })
    })

    test('should handle pattern with empty blocks array', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Empty Pattern',
        slug: 'empty-pattern',
        blocks: [],
        status: 'published',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toHaveLength(1)
      expect(result[0].blocks).toEqual([])
    })

    test('should handle pattern with non-array blocks (graceful degradation)', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Invalid Pattern',
        slug: 'invalid-pattern',
        blocks: null, // Invalid - should default to empty array
        status: 'published',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toHaveLength(1)
      expect(result[0].blocks).toEqual([])
    })

    test('should return empty array when no patterns found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['non-existent-id'])

      expect(result).toEqual([])
    })

    test('should filter out empty/whitespace IDs before querying', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      await PatternsResolverService.getByIds(['pattern-1', '', '  ', 'pattern-2', '\t'])

      // Should only query with valid IDs
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN ($1, $2)'),
        ['pattern-1', 'pattern-2']
      )
    })

    test('should handle database error gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PatternsResolverService.getByIds] Error:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    test('should handle query with SQL injection attempt safely', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const maliciousIds = [
        'pattern-123',
        "'; DROP TABLE patterns; --",
        'pattern-456',
      ]

      await PatternsResolverService.getByIds(maliciousIds)

      // Verify parameterized query is used
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN ($1, $2, $3)'),
        maliciousIds
      )
    })

    test('should handle large number of IDs', async () => {
      const manyIds = Array.from({ length: 100 }, (_, i) => `pattern-${i}`)

      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      await PatternsResolverService.getByIds(manyIds)

      // Verify all IDs are passed to query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN'),
        manyIds
      )
    })

    test('should build correct SQL placeholders for multiple IDs', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      await PatternsResolverService.getByIds(['id-1', 'id-2', 'id-3'])

      const queryCall = mockQuery.mock.calls[0]
      const sql = queryCall[0] as string

      // Verify placeholders are correct
      expect(sql).toContain('WHERE id IN ($1, $2, $3)')
    })

    test('should map database fields correctly', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-xyz',
        teamId: 'team-abc',
        title: 'Test Pattern',
        slug: 'test-pattern',
        blocks: [{ id: 'b1', blockSlug: 'hero', props: {} }],
        status: 'published' as const,
        description: 'Test description',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T12:45:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result[0]).toEqual({
        id: 'pattern-123',
        userId: 'user-xyz',
        teamId: 'team-abc',
        title: 'Test Pattern',
        slug: 'test-pattern',
        blocks: [{ id: 'b1', blockSlug: 'hero', props: {} }],
        status: 'published',
        description: 'Test description',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T12:45:00Z',
      })
    })

    test('should handle query timeout error', async () => {
      const timeoutError = new Error('Query timeout')
      timeoutError.name = 'TimeoutError'
      mockQuery.mockRejectedValue(timeoutError)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PatternsResolverService.getByIds] Error:',
        timeoutError
      )

      consoleErrorSpy.mockRestore()
    })

    test('should handle malformed database response', async () => {
      mockQuery.mockResolvedValue({
        rows: null as any, // Malformed response
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result).toEqual([])

      consoleErrorSpy.mockRestore()
    })

    test('should preserve pattern data types', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-1',
        teamId: 'team-1',
        title: 'Pattern',
        slug: 'pattern',
        blocks: [
          {
            id: 'block-1',
            blockSlug: 'hero',
            props: {
              title: 'Title',
              count: 42, // Number
              enabled: true, // Boolean
              items: ['a', 'b', 'c'], // Array
              config: { key: 'value' }, // Object
            },
          },
        ],
        status: 'published',
        description: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockQuery.mockResolvedValue({
        rows: [mockPattern],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      })

      const result = await PatternsResolverService.getByIds(['pattern-123'])

      expect(result[0].blocks[0].props.count).toBe(42)
      expect(result[0].blocks[0].props.enabled).toBe(true)
      expect(result[0].blocks[0].props.items).toEqual(['a', 'b', 'c'])
      expect(result[0].blocks[0].props.config).toEqual({ key: 'value' })
    })
  })
})
