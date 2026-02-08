/**
 * Unit Tests: Scheduled Actions Processor
 * Tests action execution, status transitions, retry logic, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { processPendingActions } from '@/core/lib/scheduled-actions/processor'
import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { registerScheduledAction, clearActionRegistry } from '@/core/lib/scheduled-actions/registry'
import type { ScheduledAction } from '@/core/lib/scheduled-actions/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn()
}))

// Mock scheduler (for rescheduling recurring actions)
jest.mock('@/core/lib/scheduled-actions/scheduler', () => ({
  scheduleAction: jest.fn().mockResolvedValue('new-action-id')
}))

// Mock config
jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: {
    scheduledActions: {
      batchSize: 10,
      defaultTimeout: 30000,
      concurrencyLimit: 1
    }
  }
}))

/**
 * Helper to create a mock ScheduledAction with all required fields
 */
function createMockAction(overrides: Partial<ScheduledAction> = {}): ScheduledAction {
  return {
    id: 'action-123',
    actionType: 'test:action',
    status: 'pending',
    payload: {},
    teamId: null,
    scheduledAt: new Date(),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    attempts: 0,
    maxRetries: 3,
    recurringInterval: null,
    recurrenceType: null,
    lockGroup: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('Scheduled Actions Processor', () => {
  const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
  const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

  beforeEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
    mockMutateWithRLS.mockResolvedValue({ rowCount: 1, rows: [] })
  })

  afterEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
  })

  describe('processPendingActions', () => {
    test('should return empty result when no pending actions', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await processPendingActions()

      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      })
    })

    test('should use default batch size of 10', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions()

      const params = mockQueryWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(10)
    })

    test('should use custom batch size when provided', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions(25)

      const params = mockQueryWithRLS.mock.calls[0][1]
      expect(params[0]).toBe(25)
    })

    test('should use system RLS context (null)', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions()

      const call = mockQueryWithRLS.mock.calls[0]
      expect(call[2]).toBeNull()
    })

    test('should process single action successfully', async () => {
      const mockAction = createMockAction()
      mockQueryWithRLS.mockResolvedValue([mockAction])

      let handlerCalled = false
      registerScheduledAction('test:action', async () => {
        handlerCalled = true
      })

      const result = await processPendingActions()

      expect(handlerCalled).toBe(true)
      expect(result.processed).toBe(1)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    test('should process multiple actions in order', async () => {
      const actions = [
        createMockAction({ id: 'action-1', payload: { order: 1 }, scheduledAt: new Date('2025-01-01T10:00:00Z') }),
        createMockAction({ id: 'action-2', payload: { order: 2 }, scheduledAt: new Date('2025-01-01T11:00:00Z') }),
        createMockAction({ id: 'action-3', payload: { order: 3 }, scheduledAt: new Date('2025-01-01T12:00:00Z') })
      ]

      mockQueryWithRLS.mockResolvedValue(actions)

      const executionOrder: number[] = []
      registerScheduledAction('test:action', async (payload: any) => {
        executionOrder.push(payload.order)
      })

      await processPendingActions()

      expect(executionOrder).toEqual([1, 2, 3])
    })

    test('should mark action as running before execution', async () => {
      const mockAction = createMockAction()
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      const runningCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'running'")
      )
      expect(runningCalls.length).toBeGreaterThan(0)
    })

    test('should increment attempts when marking as running', async () => {
      const mockAction = createMockAction()
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      const runningCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes('attempts = attempts + 1')
      )
      expect(runningCalls.length).toBeGreaterThan(0)
    })

    test('should mark action as completed on success', async () => {
      const mockAction = createMockAction()
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      const completedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'completed'")
      )
      expect(completedCalls.length).toBeGreaterThan(0)
    })

    test('should continue processing after one action fails', async () => {
      const actions = [
        createMockAction({ id: 'action-1', actionType: 'failing:action' }),
        createMockAction({ id: 'action-2', actionType: 'success:action' })
      ]

      mockQueryWithRLS.mockResolvedValue(actions)

      registerScheduledAction('failing:action', async () => {
        throw new Error('Expected failure')
      })
      registerScheduledAction('success:action', async () => {})

      const result = await processPendingActions()

      expect(result.processed).toBe(2)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
    })

    test('should pass payload to handler', async () => {
      const mockPayload = { test: 'data', nested: { value: 42 } }
      const mockAction = createMockAction({ payload: mockPayload })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      let receivedPayload: unknown
      registerScheduledAction('test:action', async (payload) => {
        receivedPayload = payload
      })

      await processPendingActions()

      expect(receivedPayload).toEqual(mockPayload)
    })

    test('should pass full action to handler', async () => {
      const mockAction = createMockAction({
        id: 'action-123',
        teamId: 'team-456',
        recurringInterval: 'daily',
        recurrenceType: 'fixed',
        lockGroup: 'test-group'
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      let receivedAction: ScheduledAction | undefined
      registerScheduledAction('test:action', async (payload, action) => {
        receivedAction = action
      })

      await processPendingActions()

      expect(receivedAction).toEqual(mockAction)
    })

    test('should fail action when handler not registered', async () => {
      const mockAction = createMockAction({ actionType: 'unknown:action', maxRetries: 0 })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('No handler registered')
      expect(result.errors[0].error).toContain('unknown:action')
    })
  })

  describe('Retry Logic', () => {
    test('should retry action when attempts < maxRetries', async () => {
      // Action with attempts=0, maxRetries=3 (after marking running, attempts becomes 1)
      const mockAction = createMockAction({
        id: 'retry-action',
        maxRetries: 3,
        attempts: 0
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      registerScheduledAction('test:action', async () => {
        throw new Error('Temporary failure')
      })

      await processPendingActions()

      // Should reschedule (set back to pending), NOT mark as failed
      const pendingCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'pending'") && call[0].includes('scheduledAt')
      )
      expect(pendingCalls.length).toBeGreaterThan(0)
    })

    test('should mark as failed when attempts >= maxRetries', async () => {
      // Action that has already exhausted retries
      const mockAction = createMockAction({
        id: 'exhausted-action',
        maxRetries: 3,
        attempts: 3 // Already at max, after increment will be > maxRetries
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      registerScheduledAction('test:action', async () => {
        throw new Error('Permanent failure')
      })

      await processPendingActions()

      const failedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'failed'")
      )
      expect(failedCalls.length).toBeGreaterThan(0)
    })

    test('should not retry when maxRetries is 0', async () => {
      const mockAction = createMockAction({
        maxRetries: 0,
        attempts: 0 // After marking running, becomes 1. 1 < 0 = false, so fail immediately
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      registerScheduledAction('test:action', async () => {
        throw new Error('No retry')
      })

      await processPendingActions()

      // Should mark as failed immediately (no pending reschedule)
      const failedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'failed'")
      )
      expect(failedCalls.length).toBeGreaterThan(0)
    })
  })

  describe('Recurring Actions', () => {
    test('should reschedule recurring action after completion', async () => {
      const { scheduleAction: mockScheduleAction } = require('@/core/lib/scheduled-actions/scheduler')

      const mockAction = createMockAction({
        actionType: 'recurring:action',
        recurringInterval: 'daily',
        recurrenceType: 'fixed',
        teamId: 'team-456'
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('recurring:action', async () => {})

      const result = await processPendingActions()

      expect(result.succeeded).toBe(1)

      // Should have called scheduleAction to create next occurrence
      expect(mockScheduleAction).toHaveBeenCalledWith(
        'recurring:action',
        expect.anything(),
        expect.objectContaining({
          recurringInterval: 'daily',
          recurrenceType: 'fixed',
          teamId: 'team-456'
        })
      )
    })

    test('should not reschedule one-time action', async () => {
      const { scheduleAction: mockScheduleAction } = require('@/core/lib/scheduled-actions/scheduler')

      const mockAction = createMockAction({
        actionType: 'onetime:action',
        recurringInterval: null
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('onetime:action', async () => {})

      await processPendingActions()

      // Should NOT call scheduleAction for rescheduling
      expect(mockScheduleAction).not.toHaveBeenCalled()
    })

    test('should preserve lockGroup when rescheduling', async () => {
      const { scheduleAction: mockScheduleAction } = require('@/core/lib/scheduled-actions/scheduler')

      const mockAction = createMockAction({
        actionType: 'recurring:locked',
        recurringInterval: 'hourly',
        lockGroup: 'content:456',
        recurrenceType: 'rolling'
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('recurring:locked', async () => {})

      await processPendingActions()

      expect(mockScheduleAction).toHaveBeenCalledWith(
        'recurring:locked',
        expect.anything(),
        expect.objectContaining({
          lockGroup: 'content:456',
          recurrenceType: 'rolling'
        })
      )
    })
  })

  describe('Timeout Protection', () => {
    test('should use custom timeout from handler definition', async () => {
      const mockAction = createMockAction({
        actionType: 'custom:timeout',
        maxRetries: 0
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])

      // Register with 100ms timeout for faster test
      registerScheduledAction('custom:timeout', async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      }, { timeout: 100 })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('timeout')
    }, 2000)
  })

  describe('Error Handling', () => {
    test('should propagate database query errors', async () => {
      const dbError = new Error('Database connection failed')
      mockQueryWithRLS.mockRejectedValue(dbError)

      await expect(processPendingActions()).rejects.toThrow('Database connection failed')
    })

    test('should handle non-Error exceptions', async () => {
      const mockAction = createMockAction({
        actionType: 'string:thrower',
        maxRetries: 0
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('string:thrower', async () => {
        throw 'String error' // Non-Error exception
      })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toBe('Unknown error')
    })

    test('should store error message when action fails', async () => {
      const mockAction = createMockAction({ maxRetries: 0 })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {
        throw new Error('Custom error message')
      })

      await processPendingActions()

      const failedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes('errorMessage')
      )
      expect(failedCalls.length).toBeGreaterThan(0)

      const errorMessageParam = failedCalls[0][1][1]
      expect(errorMessageParam).toBe('Custom error message')
    })
  })

  describe('Lock Groups', () => {
    test('should use FOR UPDATE SKIP LOCKED in query', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions()

      const sql = mockQueryWithRLS.mock.calls[0][0] as string
      expect(sql).toContain('FOR UPDATE SKIP LOCKED')
    })

    test('should filter by lockGroup in query', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions()

      const sql = mockQueryWithRLS.mock.calls[0][0] as string
      expect(sql).toContain('lockGroup')
      expect(sql).toContain('PARTITION BY')
    })

    test('should process action with lockGroup', async () => {
      const mockAction = createMockAction({
        lockGroup: 'client:123'
      })
      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      const result = await processPendingActions()

      expect(result.succeeded).toBe(1)
    })
  })
})
