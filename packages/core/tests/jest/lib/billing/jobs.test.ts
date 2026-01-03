/**
 * Unit tests for Billing Lifecycle Jobs
 *
 * Tests background job functions for subscription lifecycle management:
 * - Expire trials
 * - Handle past_due grace periods
 * - Reset monthly usage counters
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock database functions
const mockQueryWithRLS = jest.fn()
const mockQueryOneWithRLS = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: mockQueryWithRLS,
  queryOneWithRLS: mockQueryOneWithRLS
}))

// Import after mocks are set up
import { expireTrials, handlePastDueGracePeriod, resetMonthlyUsage } from '@/core/lib/billing/jobs'

describe('Billing Lifecycle Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('expireTrials', () => {
    test('should expire trials that have passed trial end date', async () => {
      const mockExpiredTrials = [
        { id: 'sub-1', teamId: 'team-1' },
        { id: 'sub-2', teamId: 'team-2' }
      ]

      // Mock SELECT query to find expired trials
      mockQueryWithRLS.mockResolvedValueOnce(mockExpiredTrials)
      // Mock UPDATE queries for each trial
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])
      // Mock INSERT queries for logging
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await expireTrials()

      expect(result.processed).toBe(2)
      expect(result.errors).toHaveLength(0)

      // Verify SELECT query
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id, "teamId" FROM subscriptions')
      )

      // Verify UPDATE queries for status change
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions'),
        ['sub-1']
      )
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions'),
        ['sub-2']
      )

      // Verify log events
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "billing_events"'),
        expect.arrayContaining([
          'sub-1',
          expect.stringContaining('trial_expired')
        ])
      )
    })

    test('should handle no expired trials', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await expireTrials()

      expect(result.processed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle errors when updating subscriptions', async () => {
      const mockExpiredTrials = [
        { id: 'sub-error', teamId: 'team-error' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockExpiredTrials)
      mockQueryWithRLS.mockRejectedValueOnce(new Error('Database error'))

      const result = await expireTrials()

      expect(result.processed).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to expire trial sub-error')
      expect(result.errors[0]).toContain('Database error')
    })

    test('should use FOR UPDATE SKIP LOCKED for concurrency safety', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await expireTrials()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED')
      )
    })

    test('should only select trials without external subscription ID', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await expireTrials()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"externalSubscriptionId" IS NULL')
      )
    })

    test('should set status to expired', async () => {
      const mockExpiredTrials = [{ id: 'sub-1', teamId: 'team-1' }]

      mockQueryWithRLS.mockResolvedValueOnce(mockExpiredTrials)
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])

      await expireTrials()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringMatching(/status = 'expired'/),
        ['sub-1']
      )
    })

    test('should log lifecycle event for each expired trial', async () => {
      const mockExpiredTrials = [
        { id: 'sub-1', teamId: 'team-1' },
        { id: 'sub-2', teamId: 'team-2' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockExpiredTrials)
      mockQueryWithRLS.mockResolvedValue([])

      await expireTrials()

      // Verify lifecycle events were logged (2 updates + 2 logs = 4 calls after initial SELECT)
      const logCalls = mockQueryWithRLS.mock.calls.filter(call =>
        call[0].includes('INSERT INTO "billing_events"')
      )
      expect(logCalls).toHaveLength(2)
    })
  })

  describe('handlePastDueGracePeriod', () => {
    test('should expire past_due subscriptions after 3 day grace period', async () => {
      const mockPastDue = [
        { id: 'sub-pd-1' },
        { id: 'sub-pd-2' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockPastDue)
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await handlePastDueGracePeriod()

      expect(result.processed).toBe(2)
      expect(result.errors).toHaveLength(0)

      // Verify grace period query
      expect(mockQueryWithRLS).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INTERVAL '3 days'")
      )
    })

    test('should handle no past_due subscriptions', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await handlePastDueGracePeriod()

      expect(result.processed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should handle errors when expiring past_due', async () => {
      const mockPastDue = [{ id: 'sub-pd-error' }]

      mockQueryWithRLS.mockResolvedValueOnce(mockPastDue)
      mockQueryWithRLS.mockRejectedValueOnce(new Error('Update failed'))

      const result = await handlePastDueGracePeriod()

      expect(result.processed).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to expire past_due sub-pd-error')
    })

    test('should use FOR UPDATE SKIP LOCKED', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await handlePastDueGracePeriod()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED')
      )
    })

    test('should only select subscriptions with status past_due', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await handlePastDueGracePeriod()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("status = 'past_due'")
      )
    })

    test('should log lifecycle event as past_due_expired', async () => {
      const mockPastDue = [{ id: 'sub-pd-1' }]

      mockQueryWithRLS.mockResolvedValueOnce(mockPastDue)
      mockQueryWithRLS.mockResolvedValue([])

      await handlePastDueGracePeriod()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "billing_events"'),
        expect.arrayContaining([
          'sub-pd-1',
          expect.stringContaining('past_due_expired')
        ])
      )
    })

    test('should process multiple past_due subscriptions independently', async () => {
      const mockPastDue = [
        { id: 'sub-1' },
        { id: 'sub-2' },
        { id: 'sub-3' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockPastDue)
      mockQueryWithRLS.mockResolvedValue([])

      const result = await handlePastDueGracePeriod()

      expect(result.processed).toBe(3)
      expect(result.errors).toHaveLength(0)
    })

    test('should continue processing after individual errors', async () => {
      const mockPastDue = [
        { id: 'sub-success' },
        { id: 'sub-error' },
        { id: 'sub-success-2' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockPastDue)
      // First success
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])
      // Error
      mockQueryWithRLS.mockRejectedValueOnce(new Error('DB error'))
      // Second success
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await handlePastDueGracePeriod()

      expect(result.processed).toBe(2)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('resetMonthlyUsage', () => {
    beforeEach(() => {
      // Mock current date to January 15, 2025
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-01-15T10:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should archive previous month usage records', async () => {
      const mockArchivedRecords = [
        { id: 'usage-1' },
        { id: 'usage-2' },
        { id: 'usage-3' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockArchivedRecords)

      const result = await resetMonthlyUsage()

      expect(result.processed).toBe(3)
      expect(result.errors).toHaveLength(0)

      // Verify previous month calculation (December 2024)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE usage'),
        ['2024-12']
      )
    })

    test('should calculate previous month correctly for January', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await resetMonthlyUsage()

      // January 2025 → previous month = December 2024
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        ['2024-12']
      )
    })

    test('should calculate previous month correctly for mid-year', async () => {
      jest.setSystemTime(new Date('2025-06-15T10:00:00Z'))
      mockQueryWithRLS.mockResolvedValueOnce([])

      await resetMonthlyUsage()

      // June 2025 → previous month = May 2025
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        ['2025-05']
      )
    })

    test('should mark usage as archived in metadata', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([{ id: 'usage-1' }])

      await resetMonthlyUsage()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("jsonb_set(COALESCE(metadata, '{}'::jsonb), '{archived}', 'true')"),
        expect.anything()
      )
    })

    test('should only archive records not already archived', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      await resetMonthlyUsage()

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining("(metadata->>'archived') IS NULL"),
        expect.anything()
      )
    })

    test('should handle no usage records to archive', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([])

      const result = await resetMonthlyUsage()

      expect(result.processed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should use RETURNING id to count archived records', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([
        { id: 'usage-1' },
        { id: 'usage-2' }
      ])

      const result = await resetMonthlyUsage()

      expect(result.processed).toBe(2)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING id'),
        expect.anything()
      )
    })

    test('should format period key with zero-padded month', async () => {
      jest.setSystemTime(new Date('2025-10-01T10:00:00Z'))
      mockQueryWithRLS.mockResolvedValueOnce([])

      await resetMonthlyUsage()

      // October 2025 → previous month = September 2025 = "2025-09"
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.anything(),
        ['2025-09']
      )
    })

    test('should handle database errors gracefully', async () => {
      mockQueryWithRLS.mockRejectedValueOnce(new Error('Database connection lost'))

      await expect(resetMonthlyUsage()).rejects.toThrow('Database connection lost')
    })

    test('should log the archiving operation', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log')
      mockQueryWithRLS.mockResolvedValueOnce([{ id: 'usage-1' }])

      await resetMonthlyUsage()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[lifecycle-job] Archiving usage for period: 2024-12')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[lifecycle-job] Archived 1 usage records')
      )
    })
  })

  describe('JobResult interface', () => {
    test('should return correct structure for successful job', async () => {
      mockQueryWithRLS.mockResolvedValueOnce([{ id: 'sub-1' }])
      mockQueryWithRLS.mockResolvedValue([])

      const result = await expireTrials()

      expect(result).toHaveProperty('processed')
      expect(result).toHaveProperty('errors')
      expect(typeof result.processed).toBe('number')
      expect(Array.isArray(result.errors)).toBe(true)
    })

    test('should accumulate errors correctly', async () => {
      const mockTrials = [
        { id: 'sub-1', teamId: 'team-1' },
        { id: 'sub-2', teamId: 'team-2' },
        { id: 'sub-3', teamId: 'team-3' }
      ]

      mockQueryWithRLS.mockResolvedValueOnce(mockTrials)
      mockQueryWithRLS.mockRejectedValueOnce(new Error('Error 1'))
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockResolvedValueOnce([])
      mockQueryWithRLS.mockRejectedValueOnce(new Error('Error 2'))

      const result = await expireTrials()

      expect(result.processed).toBe(1) // Only sub-2 succeeded
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('Console logging', () => {
    test('expireTrials should log count of trials found', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log')
      mockQueryWithRLS.mockResolvedValueOnce([
        { id: 'sub-1', teamId: 'team-1' },
        { id: 'sub-2', teamId: 'team-2' }
      ])
      mockQueryWithRLS.mockResolvedValue([])

      await expireTrials()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[lifecycle-job] Found 2 trials to expire'
      )
    })

    test('handlePastDueGracePeriod should log count found', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log')
      mockQueryWithRLS.mockResolvedValueOnce([{ id: 'sub-1' }])
      mockQueryWithRLS.mockResolvedValue([])

      await handlePastDueGracePeriod()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[lifecycle-job] Found 1 past_due subscriptions to expire'
      )
    })
  })
})
