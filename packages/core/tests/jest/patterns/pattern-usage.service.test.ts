/**
 * Unit Tests - PatternUsageService
 *
 * Tests all PatternUsageService methods for tracking which entities use patterns.
 * Covers: syncUsages, removeEntityUsages, getUsageCount, getUsageCounts,
 * getUsagesWithEntityInfo, and getPatternsWithUsages.
 */

import { PatternUsageService } from '@/core/lib/services/pattern-usage.service'
import { queryWithRLS, mutateWithRLS, queryOneWithRLS } from '@/core/lib/db'
import { extractPatternIds } from '@/core/lib/blocks/pattern-resolver'
import type { BlockInstance } from '@/core/types/blocks'
import type { PatternReference } from '@/core/types/pattern-reference'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
}))

// Mock pattern resolver
jest.mock('@/core/lib/blocks/pattern-resolver', () => ({
  extractPatternIds: jest.fn(),
}))

const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockExtractPatternIds = extractPatternIds as jest.MockedFunction<typeof extractPatternIds>

// Sample test data
const mockUserId = 'usr-test-001'
const mockTeamId = 'team-test-001'
const mockPatternId = 'pat-test-001'
const mockEntityType = 'pages'
const mockEntityId = 'page-test-001'

const mockPatternReference: PatternReference = {
  type: 'pattern',
  ref: mockPatternId,
  id: 'ref-001'
}

const mockBlock: BlockInstance = {
  id: 'block-001',
  blockSlug: 'hero',
  props: { title: 'Test' }
}

const mockPatternUsage = {
  id: 'pu-001',
  patternId: mockPatternId,
  entityType: mockEntityType,
  entityId: mockEntityId,
  teamId: mockTeamId,
  createdAt: new Date().toISOString()
}

describe('PatternUsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // syncUsages
  // ===========================================
  describe('syncUsages', () => {
    it('does nothing when blocks contain no pattern references', async () => {
      mockExtractPatternIds.mockReturnValue([])
      mockQueryWithRLS.mockResolvedValue([])

      await PatternUsageService.syncUsages(
        mockEntityType,
        mockEntityId,
        mockTeamId,
        [mockBlock],
        mockUserId
      )

      // Should not call mutate since nothing to add/remove
      expect(mockMutateWithRLS).not.toHaveBeenCalled()
    })

    it('adds new pattern usages when patterns are added', async () => {
      mockExtractPatternIds.mockReturnValue([mockPatternId])
      mockQueryWithRLS.mockResolvedValue([]) // No existing usages
      mockMutateWithRLS.mockResolvedValue({ rows: [] })

      await PatternUsageService.syncUsages(
        mockEntityType,
        mockEntityId,
        mockTeamId,
        [mockPatternReference],
        mockUserId
      )

      // Should insert the new pattern usage
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pattern_usages'),
        expect.arrayContaining([mockPatternId, mockEntityType, mockEntityId, mockTeamId]),
        mockUserId
      )
    })

    it('removes old pattern usages when patterns are removed', async () => {
      const oldPatternId = 'pat-old-001'
      mockExtractPatternIds.mockReturnValue([]) // No patterns in blocks now
      mockQueryWithRLS.mockResolvedValue([{ patternId: oldPatternId }]) // Old usage exists
      mockMutateWithRLS.mockResolvedValue({ rows: [] })

      await PatternUsageService.syncUsages(
        mockEntityType,
        mockEntityId,
        mockTeamId,
        [mockBlock], // No pattern references
        mockUserId
      )

      // Should delete the old pattern usage
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pattern_usages'),
        expect.arrayContaining([mockEntityType, mockEntityId, [oldPatternId]]),
        mockUserId
      )
    })

    it('handles diff with both additions and removals', async () => {
      const oldPatternId = 'pat-old-001'
      const newPatternId = 'pat-new-001'

      mockExtractPatternIds.mockReturnValue([newPatternId])
      mockQueryWithRLS.mockResolvedValue([{ patternId: oldPatternId }])
      mockMutateWithRLS.mockResolvedValue({ rows: [] })

      await PatternUsageService.syncUsages(
        mockEntityType,
        mockEntityId,
        mockTeamId,
        [{ type: 'pattern', ref: newPatternId, id: 'ref-new' } as PatternReference],
        mockUserId
      )

      // Should call mutate twice: once for delete, once for insert
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(2)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array),
        mockUserId
      )
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array),
        mockUserId
      )
    })

    it('handles errors gracefully without throwing', async () => {
      mockExtractPatternIds.mockReturnValue([mockPatternId])
      mockQueryWithRLS.mockRejectedValue(new Error('DB error'))

      // Should not throw - just log error
      await expect(
        PatternUsageService.syncUsages(
          mockEntityType,
          mockEntityId,
          mockTeamId,
          [mockPatternReference],
          mockUserId
        )
      ).resolves.not.toThrow()
    })
  })

  // ===========================================
  // removeEntityUsages
  // ===========================================
  describe('removeEntityUsages', () => {
    it('successfully removes all usages for an entity', async () => {
      mockMutateWithRLS.mockResolvedValue({ rows: [] })

      await PatternUsageService.removeEntityUsages(
        mockEntityType,
        mockEntityId,
        mockUserId
      )

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pattern_usages'),
        [mockEntityType, mockEntityId],
        mockUserId
      )
    })

    it('handles errors gracefully without throwing', async () => {
      mockMutateWithRLS.mockRejectedValue(new Error('DB error'))

      // Should not throw - just log error
      await expect(
        PatternUsageService.removeEntityUsages(
          mockEntityType,
          mockEntityId,
          mockUserId
        )
      ).resolves.not.toThrow()
    })
  })

  // ===========================================
  // getUsageCount
  // ===========================================
  describe('getUsageCount', () => {
    it('returns the correct count for a pattern', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: '5' })

      const result = await PatternUsageService.getUsageCount(mockPatternId, mockUserId)

      expect(result).toBe(5)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [mockPatternId],
        mockUserId
      )
    })

    it('returns 0 when query returns null', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await PatternUsageService.getUsageCount(mockPatternId, mockUserId)

      expect(result).toBe(0)
    })

    it('returns 0 when count is null', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: null })

      const result = await PatternUsageService.getUsageCount(mockPatternId, mockUserId)

      expect(result).toBe(0)
    })
  })

  // ===========================================
  // getUsageCounts
  // ===========================================
  describe('getUsageCounts', () => {
    it('returns counts grouped by entity type', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { entityType: 'pages', count: '10' },
        { entityType: 'posts', count: '5' }
      ])

      const result = await PatternUsageService.getUsageCounts(mockPatternId, mockUserId)

      expect(result).toEqual([
        { entityType: 'pages', count: 10 },
        { entityType: 'posts', count: 5 }
      ])
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY "entityType"'),
        [mockPatternId],
        mockUserId
      )
    })

    it('returns empty array when no usages exist', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await PatternUsageService.getUsageCounts(mockPatternId, mockUserId)

      expect(result).toEqual([])
    })
  })

  // ===========================================
  // getUsagesWithEntityInfo
  // ===========================================
  describe('getUsagesWithEntityInfo', () => {
    it('returns usages with enriched entity information', async () => {
      // Mock count query
      mockQueryOneWithRLS.mockResolvedValueOnce({ count: '1' })

      // Mock counts by type
      mockQueryWithRLS
        .mockResolvedValueOnce([{ entityType: 'pages', count: '1' }]) // getUsageCounts
        .mockResolvedValueOnce([mockPatternUsage]) // usages query
        .mockResolvedValueOnce([{ // entity info query
          id: mockEntityId,
          title: 'Test Page',
          slug: 'test-page',
          status: 'published',
          updatedAt: new Date().toISOString()
        }])

      const result = await PatternUsageService.getUsagesWithEntityInfo(
        mockPatternId,
        mockUserId
      )

      expect(result.total).toBe(1)
      expect(result.counts).toEqual([{ entityType: 'pages', count: 1 }])
      expect(result.usages).toHaveLength(1)
      expect(result.usages[0].entityTitle).toBe('Test Page')
    })

    it('filters by entityType when provided', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: '1' })
      mockQueryWithRLS
        .mockResolvedValueOnce([{ entityType: 'pages', count: '1' }])
        .mockResolvedValueOnce([mockPatternUsage])
        .mockResolvedValueOnce([])

      await PatternUsageService.getUsagesWithEntityInfo(
        mockPatternId,
        mockUserId,
        { entityType: 'pages' }
      )

      // Check that the query included entityType filter
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"entityType"'),
        expect.arrayContaining(['pages']),
        mockUserId
      )
    })

    it('applies pagination with limit and offset', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: '100' })
      mockQueryWithRLS
        .mockResolvedValueOnce([{ entityType: 'pages', count: '100' }])
        .mockResolvedValueOnce([])

      await PatternUsageService.getUsagesWithEntityInfo(
        mockPatternId,
        mockUserId,
        { limit: 10, offset: 20 }
      )

      // Check that limit and offset were passed
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20]),
        mockUserId
      )
    })
  })

  // ===========================================
  // getPatternsWithUsages
  // ===========================================
  describe('getPatternsWithUsages', () => {
    it('returns empty array when given empty input', async () => {
      const result = await PatternUsageService.getPatternsWithUsages([], mockUserId)

      expect(result).toEqual([])
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })

    it('returns pattern IDs that have usages', async () => {
      const patternIds = ['pat-001', 'pat-002', 'pat-003']
      mockQueryWithRLS.mockResolvedValue([
        { patternId: 'pat-001' },
        { patternId: 'pat-003' }
      ])

      const result = await PatternUsageService.getPatternsWithUsages(patternIds, mockUserId)

      expect(result).toEqual(['pat-001', 'pat-003'])
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT'),
        [patternIds],
        mockUserId
      )
    })

    it('returns empty array when no patterns have usages', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await PatternUsageService.getPatternsWithUsages(
        ['pat-no-usage'],
        mockUserId
      )

      expect(result).toEqual([])
    })
  })

  // ===========================================
  // getExistingPatternIds (Lazy Cleanup)
  // ===========================================
  describe('getExistingPatternIds', () => {
    it('returns empty set when given empty input', async () => {
      const result = await PatternUsageService.getExistingPatternIds([], mockUserId)

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(0)
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })

    it('returns set of existing pattern IDs', async () => {
      const patternIds = ['pat-001', 'pat-002', 'pat-003']
      mockQueryWithRLS.mockResolvedValue([
        { id: 'pat-001' },
        { id: 'pat-003' }
      ])

      const result = await PatternUsageService.getExistingPatternIds(patternIds, mockUserId)

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(2)
      expect(result.has('pat-001')).toBe(true)
      expect(result.has('pat-002')).toBe(false)
      expect(result.has('pat-003')).toBe(true)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM patterns'),
        [patternIds],
        mockUserId
      )
    })

    it('returns empty set when no patterns exist', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await PatternUsageService.getExistingPatternIds(
        ['pat-deleted-001'],
        mockUserId
      )

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(0)
    })

    it('queries using ANY() for efficient bulk lookup', async () => {
      const patternIds = ['pat-001', 'pat-002']
      mockQueryWithRLS.mockResolvedValue([{ id: 'pat-001' }])

      await PatternUsageService.getExistingPatternIds(patternIds, mockUserId)

      // Should use ANY() for array parameter
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('ANY($1::text[])'),
        [patternIds],
        mockUserId
      )
    })
  })
})
