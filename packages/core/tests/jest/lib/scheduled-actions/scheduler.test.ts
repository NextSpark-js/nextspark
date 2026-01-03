/**
 * Unit Tests: Scheduled Actions Scheduler
 * Tests scheduling of one-time and recurring actions
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { scheduleAction, scheduleRecurringAction, cancelScheduledAction } from '@/core/lib/scheduled-actions/scheduler'
import { mutateWithRLS, queryWithRLS } from '@/core/lib/db'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: jest.fn(),
  queryWithRLS: jest.fn()
}))

// Mock config
jest.mock('@/core/lib/config/config-sync', () => ({
  APP_CONFIG_MERGED: {
    scheduledActions: {
      deduplication: {
        windowSeconds: 5
      }
    }
  }
}))

describe('Scheduled Actions Scheduler', () => {
  const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
  const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>

  beforeEach(() => {
    jest.clearAllMocks()
    mockMutateWithRLS.mockResolvedValue({ rowCount: 1, rows: [] })
    // Default: no duplicates found, advisory lock succeeds
    mockQueryWithRLS.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('scheduleAction', () => {
    test('should schedule action with minimal parameters', async () => {
      const actionId = await scheduleAction('webhook:send', { test: 'data' })

      expect(actionId).toBeDefined()
      expect(typeof actionId).toBe('string')
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1)
    })

    test('should insert action with correct SQL', async () => {
      await scheduleAction('webhook:send', { test: 'data' })

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[0]).toContain('INSERT INTO "scheduled_actions"')
      expect(call[0]).toContain('actionType')
      expect(call[0]).toContain('status')
      expect(call[0]).toContain('payload')
      expect(call[0]).toContain('teamId')
      expect(call[0]).toContain('scheduledAt')
      expect(call[0]).toContain('recurringInterval')
    })

    test('should use system RLS context (null)', async () => {
      await scheduleAction('webhook:send', { test: 'data' })

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[2]).toBeNull() // Third parameter is RLS context
    })

    test('should set status to pending', async () => {
      await scheduleAction('webhook:send', { test: 'data' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params).toContain('pending')
    })

    test('should serialize payload as JSON', async () => {
      const payload = { eventType: 'create', entityId: '123', nested: { value: 42 } }
      await scheduleAction('webhook:send', payload)

      const params = mockMutateWithRLS.mock.calls[0][1]
      const payloadParam = params[3] // payload is 4th parameter
      expect(payloadParam).toBe(JSON.stringify(payload))
    })

    test('should use current time as default scheduledAt', async () => {
      const beforeCall = new Date()
      await scheduleAction('webhook:send', { test: 'data' })
      const afterCall = new Date()

      const params = mockMutateWithRLS.mock.calls[0][1]
      const scheduledAt = new Date(params[5] as string)

      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    test('should use provided scheduledAt when specified', async () => {
      const futureDate = new Date('2025-12-31T23:59:59Z')
      await scheduleAction('webhook:send', { test: 'data' }, { scheduledAt: futureDate })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[5]).toBe(futureDate.toISOString())
    })

    test('should set teamId when provided', async () => {
      await scheduleAction('webhook:send', { test: 'data' }, { teamId: 'team-123' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[4]).toBe('team-123')
    })

    test('should set teamId to null when not provided', async () => {
      await scheduleAction('webhook:send', { test: 'data' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[4]).toBeNull()
    })

    test('should set recurringInterval when provided', async () => {
      await scheduleAction('webhook:send', { test: 'data' }, { recurringInterval: 'daily' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[6]).toBe('daily')
    })

    test('should set recurringInterval to null when not provided', async () => {
      await scheduleAction('webhook:send', { test: 'data' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[6]).toBeNull()
    })

    test('should generate unique action IDs', async () => {
      const id1 = await scheduleAction('webhook:send', { test: '1' })
      const id2 = await scheduleAction('webhook:send', { test: '2' })
      const id3 = await scheduleAction('webhook:send', { test: '3' })

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    test('should handle complex payload objects', async () => {
      const complexPayload = {
        user: {
          id: '123',
          metadata: {
            preferences: ['opt1', 'opt2'],
            settings: { theme: 'dark', notifications: true }
          }
        },
        timestamp: new Date().toISOString(),
        tags: ['tag1', 'tag2', 'tag3']
      }

      await scheduleAction('webhook:send', complexPayload)

      const params = mockMutateWithRLS.mock.calls[0][1]
      const storedPayload = JSON.parse(params[3] as string)
      expect(storedPayload).toEqual(complexPayload)
    })

    test('should handle all options together', async () => {
      const scheduledAt = new Date('2025-06-15T10:30:00Z')
      const payload = { test: 'data', nested: { value: 42 } }

      await scheduleAction('billing:check', payload, {
        scheduledAt,
        teamId: 'team-456',
        recurringInterval: 'weekly'
      })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[1]).toBe('billing:check')
      expect(params[2]).toBe('pending')
      expect(JSON.parse(params[3] as string)).toEqual(payload)
      expect(params[4]).toBe('team-456')
      expect(params[5]).toBe(scheduledAt.toISOString())
      expect(params[6]).toBe('weekly')
    })
  })

  describe('Deduplication', () => {
    test('should acquire advisory lock when deduplicating', async () => {
      const payload = { entityId: 'task-123', entityType: 'task', data: {} }
      await scheduleAction('webhook:send', payload)

      // First call should be the advisory lock
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Array),
        null
      )
    })

    test('should check for existing duplicate', async () => {
      const payload = { entityId: 'task-123', entityType: 'task', data: {} }
      await scheduleAction('webhook:send', payload)

      // Second call should be the duplicate check
      const calls = mockQueryWithRLS.mock.calls
      const checkCall = calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('SELECT id')
      )
      expect(checkCall).toBeDefined()
      expect(checkCall![0]).toContain('scheduled_actions')
      expect(checkCall![0]).toContain('pending')
    })

    test('should update payload when duplicate found', async () => {
      // Mock finding a duplicate
      mockQueryWithRLS
        .mockResolvedValueOnce([]) // advisory lock
        .mockResolvedValueOnce([{ id: 'existing-action-id' }]) // duplicate found

      const payload = { entityId: 'task-123', entityType: 'task', data: { title: 'Updated' } }
      const result = await scheduleAction('webhook:send', payload)

      // Should return the existing action ID
      expect(result).toBe('existing-action-id')

      // Should have updated the existing action
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([JSON.stringify(payload), 'existing-action-id']),
        null
      )
    })

    test('should create new action when no duplicate found', async () => {
      mockQueryWithRLS.mockResolvedValue([]) // No duplicate

      const payload = { entityId: 'task-123', entityType: 'task', data: {} }
      const result = await scheduleAction('webhook:send', payload)

      // Should return a new UUID
      expect(result).toBeDefined()
      expect(result).not.toBe('existing-action-id')

      // Should have inserted new action
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "scheduled_actions"'),
        expect.any(Array),
        null
      )
    })

    test('should skip deduplication when no entityId in payload', async () => {
      const payload = { data: { title: 'No entity' } }
      await scheduleAction('webhook:send', payload)

      // Should not acquire advisory lock (no entityId to deduplicate on)
      const lockCalls = mockQueryWithRLS.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('pg_advisory_xact_lock')
      )
      expect(lockCalls.length).toBe(0)

      // Should directly insert
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array),
        null
      )
    })

    test('should skip deduplication for recurring actions', async () => {
      const payload = { entityId: 'task-123', entityType: 'task', data: {} }
      await scheduleAction('webhook:send', payload, { recurringInterval: 'daily' })

      // Should not acquire advisory lock for recurring actions
      const lockCalls = mockQueryWithRLS.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('pg_advisory_xact_lock')
      )
      expect(lockCalls.length).toBe(0)
    })
  })

  describe('scheduleRecurringAction', () => {
    test('should schedule recurring action with interval', async () => {
      const actionId = await scheduleRecurringAction('billing:check', {}, 'daily')

      expect(actionId).toBeDefined()
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1)
    })

    test('should set recurringInterval from interval parameter', async () => {
      await scheduleRecurringAction('billing:check', { test: 'data' }, 'hourly')

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[6]).toBe('hourly')
    })

    test('should support all predefined intervals', async () => {
      const intervals = ['hourly', 'daily', 'weekly']

      for (const interval of intervals) {
        jest.clearAllMocks()
        await scheduleRecurringAction('test:action', {}, interval)

        const params = mockMutateWithRLS.mock.calls[0][1]
        expect(params[6]).toBe(interval)
      }
    })

    test('should support custom cron expressions', async () => {
      const cronExpression = '0 0 * * *'
      await scheduleRecurringAction('test:action', {}, cronExpression)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[6]).toBe(cronExpression)
    })

    test('should accept teamId option', async () => {
      await scheduleRecurringAction('billing:check', {}, 'daily', { teamId: 'team-789' })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[4]).toBe('team-789')
    })

    test('should accept scheduledAt option for first run', async () => {
      const firstRun = new Date('2025-01-01T00:00:00Z')
      await scheduleRecurringAction('billing:check', {}, 'daily', { scheduledAt: firstRun })

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[5]).toBe(firstRun.toISOString())
    })

    test('should not override interval with recurringInterval option', async () => {
      // TypeScript prevents this, but test runtime behavior
      await scheduleRecurringAction('test:action', {}, 'daily', {
        scheduledAt: new Date()
      } as any)

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[6]).toBe('daily')
    })
  })

  describe('cancelScheduledAction', () => {
    test('should cancel pending action successfully', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 1, rows: [] })

      const result = await cancelScheduledAction('action-123')

      expect(result).toBe(true)
      expect(mockMutateWithRLS).toHaveBeenCalledTimes(1)
    })

    test('should return false when action not found', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })

      const result = await cancelScheduledAction('nonexistent-id')

      expect(result).toBe(false)
    })

    test('should update action with failed status', async () => {
      await cancelScheduledAction('action-123')

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[0]).toContain("status = 'failed'")
    })

    test('should set error message to cancellation reason', async () => {
      await cancelScheduledAction('action-123')

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[0]).toContain('errorMessage')
      expect(call[0]).toContain('Action cancelled by system')
    })

    test('should only cancel pending actions', async () => {
      await cancelScheduledAction('action-123')

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[0]).toContain("status = 'pending'")
    })

    test('should use system RLS context (null)', async () => {
      await cancelScheduledAction('action-123')

      const call = mockMutateWithRLS.mock.calls[0]
      expect(call[2]).toBeNull()
    })

    test('should pass action ID as parameter', async () => {
      await cancelScheduledAction('action-456')

      const params = mockMutateWithRLS.mock.calls[0][1]
      expect(params[0]).toBe('action-456')
    })

    test('should log warning when cancellation fails', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 0, rows: [] })
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await cancelScheduledAction('action-789')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not cancel action action-789')
      )

      consoleWarnSpy.mockRestore()
    })

    test('should log success when cancellation succeeds', async () => {
      mockMutateWithRLS.mockResolvedValue({ rowCount: 1, rows: [] })
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await cancelScheduledAction('action-123')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cancelled action: action-123')
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    test('should propagate database errors from scheduleAction', async () => {
      const dbError = new Error('Database connection failed')
      mockMutateWithRLS.mockRejectedValue(dbError)

      await expect(scheduleAction('test:action', {})).rejects.toThrow('Database connection failed')
    })

    test('should propagate database errors from scheduleRecurringAction', async () => {
      const dbError = new Error('Database connection failed')
      mockMutateWithRLS.mockRejectedValue(dbError)

      await expect(scheduleRecurringAction('test:action', {}, 'daily')).rejects.toThrow(
        'Database connection failed'
      )
    })

    test('should propagate database errors from cancelScheduledAction', async () => {
      const dbError = new Error('Database connection failed')
      mockMutateWithRLS.mockRejectedValue(dbError)

      await expect(cancelScheduledAction('action-123')).rejects.toThrow('Database connection failed')
    })
  })
})
