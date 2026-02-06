/**
 * Unit Tests: Scheduled Actions Cleanup
 * Tests retention policy enforcement
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { cleanupOldActions } from '@/core/lib/scheduled-actions/cleanup'
import { mutateWithRLS } from '@/core/lib/db'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: jest.fn()
}))

// Mock config
jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: {
    scheduledActions: {
      retentionDays: 7
    }
  }
}))

describe('Scheduled Actions Cleanup', () => {
  const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

  beforeEach(() => {
    jest.clearAllMocks()
    mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('cleanupOldActions', () => {
    test('should use default retention of 7 days', async () => {
      await cleanupOldActions()

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(7)
    })

    test('should use custom retention days when provided', async () => {
      await cleanupOldActions(30)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(30)
    })

    test('should delete only completed and failed actions', async () => {
      await cleanupOldActions()

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).toContain("status IN ('completed', 'failed')")
    })

    test('should delete actions older than retention period', async () => {
      await cleanupOldActions(14)

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).toContain('completedAt')
      expect(sql).toContain('NOW()')
      expect(sql).toContain("INTERVAL '1 day'")

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(14)
    })

    test('should use system RLS context (null)', async () => {
      await cleanupOldActions()

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[2]).toBeNull()
    })

    test('should return number of deleted actions', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 15, rows: [] })

      const deletedCount = await cleanupOldActions()

      expect(deletedCount).toBe(15)
    })

    test('should return 0 when no actions deleted', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })

      const deletedCount = await cleanupOldActions()

      expect(deletedCount).toBe(0)
    })

    test('should call database delete with correct SQL structure', async () => {
      await cleanupOldActions(7)

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).toContain('DELETE FROM "scheduled_actions"')
      expect(sql).toContain('WHERE')
      expect(sql).toContain('AND')
    })

    test('should handle large deletion counts', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 10000, rows: [] })

      const deletedCount = await cleanupOldActions()

      expect(deletedCount).toBe(10000)
    })

    test('should work with retention of 1 day', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 5, rows: [] })

      const deletedCount = await cleanupOldActions(1)

      expect(deletedCount).toBe(5)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(1)
    })

    test('should work with retention of 90 days', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 100, rows: [] })

      const deletedCount = await cleanupOldActions(90)

      expect(deletedCount).toBe(100)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(90)
    })

    test('should log cleanup start', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await cleanupOldActions(7)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up actions older than 7 days')
      )

      consoleLogSpy.mockRestore()
    })

    test('should log cleanup result', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 25, rows: [] })
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await cleanupOldActions()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 25 old action(s)')
      )

      consoleLogSpy.mockRestore()
    })

    test('should log when zero actions cleaned', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await cleanupOldActions()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 0 old action(s)')
      )

      consoleLogSpy.mockRestore()
    })

    test('should not delete pending actions', async () => {
      await cleanupOldActions()

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).not.toContain("'pending'")
      expect(sql).toContain("status IN ('completed', 'failed')")
    })

    test('should not delete running actions', async () => {
      await cleanupOldActions()

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).not.toContain("'running'")
      expect(sql).toContain("status IN ('completed', 'failed')")
    })

    test('should use completedAt field for time comparison', async () => {
      await cleanupOldActions()

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).toContain('completedAt')
      expect(sql).not.toContain('createdAt')
      expect(sql).not.toContain('scheduledAt')
    })
  })

  describe('Error Handling', () => {
    test('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockMutateWithRLS.mockRejectedValue(dbError)

      await expect(cleanupOldActions()).rejects.toThrow('Database connection failed')
    })

    test('should propagate constraint violation errors', async () => {
      const constraintError = new Error('Foreign key constraint violation')
      mockMutateWithRLS.mockRejectedValue(constraintError)

      await expect(cleanupOldActions()).rejects.toThrow('Foreign key constraint violation')
    })

    test('should propagate permission errors', async () => {
      const permissionError = new Error('Insufficient permissions')
      mockMutateWithRLS.mockRejectedValue(permissionError)

      await expect(cleanupOldActions()).rejects.toThrow('Insufficient permissions')
    })
  })

  describe('SQL Injection Prevention', () => {
    test('should use parameterized query for retention days', async () => {
      await cleanupOldActions(30)

      const sql = mockMutateWithRLS.mock.calls[0][0]
      expect(sql).toContain('$1')

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params).toEqual([30])
    })

    test('should not concatenate retention value into SQL', async () => {
      await cleanupOldActions(15)

      const sql = mockMutateWithRLS.mock.calls[0][0]
      // Should use $1 placeholder, not direct number
      expect(sql).not.toContain('* 15')
      expect(sql).toContain('* $1')
    })
  })

  describe('Performance Considerations', () => {
    test('should be efficient with single DELETE query', async () => {
      await cleanupOldActions()

      // Should only make one database call
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1)
    })

    test('should use indexed field (completedAt) for query', async () => {
      await cleanupOldActions()

      const sql = mockMutateWithRLS.mock.calls[0][0]
      // Migration creates index on completedAt WHERE status IN ('completed', 'failed')
      expect(sql).toContain('completedAt')
      expect(sql).toContain("status IN ('completed', 'failed')")
    })
  })

  describe('Edge Cases', () => {
    test('should handle retention of 0 days', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 50, rows: [] })

      const deletedCount = await cleanupOldActions(0)

      expect(deletedCount).toBe(50)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(0)
    })

    test('should handle very large retention periods', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })

      const deletedCount = await cleanupOldActions(3650) // 10 years

      expect(deletedCount).toBe(0)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(3650)
    })

    test('should handle negative retention (treated as DB constraint)', async () => {
      // Database should handle this, but test that we pass it through
      await cleanupOldActions(-1)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(-1)
    })

    test('should handle decimal retention days', async () => {
      // Test that decimal days work (e.g., 0.5 days = 12 hours)
      mockMutateWithRLS.mockResolvedValue({ rowCount: 2, rows: [] })

      const deletedCount = await cleanupOldActions(0.5)

      expect(deletedCount).toBe(2)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(0.5)
    })
  })
})
