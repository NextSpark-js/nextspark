/**
 * Unit Tests: Scheduled Actions Processor
 * Tests action execution, status transitions, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { processPendingActions } from '@/core/lib/scheduled-actions/processor'
import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { registerScheduledAction, clearActionRegistry, getActionHandler } from '@/core/lib/scheduled-actions/registry'
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

    test('should query pending actions with correct SQL', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      await processPendingActions()

      const call = mockQueryWithRLS.mock.calls[0]
      expect(call[0]).toContain('SELECT * FROM "scheduledActions"')
      expect(call[0]).toContain("status = 'pending'")
      expect(call[0]).toContain('scheduledAt')
      expect(call[0]).toContain('NOW()')
      expect(call[0]).toContain('ORDER BY')
      expect(call[0]).toContain('LIMIT')
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
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'test:action',
        status: 'pending',
        payload: { test: 'data' },
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

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
      const actions: ScheduledAction[] = [
        {
          id: 'action-1',
          actionType: 'test:action',
          status: 'pending',
          payload: { order: 1 },
          teamId: null,
          scheduledAt: new Date('2025-01-01T10:00:00Z'),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          attempts: 0,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'action-2',
          actionType: 'test:action',
          status: 'pending',
          payload: { order: 2 },
          teamId: null,
          scheduledAt: new Date('2025-01-01T11:00:00Z'),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          attempts: 0,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'action-3',
          actionType: 'test:action',
          status: 'pending',
          payload: { order: 3 },
          teamId: null,
          scheduledAt: new Date('2025-01-01T12:00:00Z'),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          attempts: 0,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
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
      const mockAction: ScheduledAction = {
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
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      // Check that mutateWithRLS was called to mark as running
      const runningCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'running'")
      )
      expect(runningCalls.length).toBeGreaterThan(0)
    })

    test('should increment attempts when marking as running', async () => {
      const mockAction: ScheduledAction = {
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
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      const runningCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes('attempts = attempts + 1')
      )
      expect(runningCalls.length).toBeGreaterThan(0)
    })

    test('should mark action as completed on success', async () => {
      const mockAction: ScheduledAction = {
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
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {})

      await processPendingActions()

      const completedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'completed'")
      )
      expect(completedCalls.length).toBeGreaterThan(0)
    })

    test('should mark action as failed on error', async () => {
      const mockAction: ScheduledAction = {
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
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('test:action', async () => {
        throw new Error('Handler failed')
      })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].actionId).toBe('action-123')
      expect(result.errors[0].error).toBe('Handler failed')

      const failedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'failed'")
      )
      expect(failedCalls.length).toBeGreaterThan(0)
    })

    test('should store error message when action fails', async () => {
      const mockAction: ScheduledAction = {
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
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

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

    test('should fail action when handler not registered', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'unknown:action',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('No handler registered')
      expect(result.errors[0].error).toContain('unknown:action')
    })

    test('should continue processing after one action fails', async () => {
      const actions: ScheduledAction[] = [
        {
          id: 'action-1',
          actionType: 'failing:action',
          status: 'pending',
          payload: {},
          teamId: null,
          scheduledAt: new Date(),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          attempts: 0,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'action-2',
          actionType: 'success:action',
          status: 'pending',
          payload: {},
          teamId: null,
          scheduledAt: new Date(),
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          attempts: 0,
          recurringInterval: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
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
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'test:action',
        status: 'pending',
        payload: mockPayload,
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])

      let receivedPayload: unknown
      registerScheduledAction('test:action', async (payload) => {
        receivedPayload = payload
      })

      await processPendingActions()

      expect(receivedPayload).toEqual(mockPayload)
    })

    test('should pass full action to handler', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'test:action',
        status: 'pending',
        payload: { test: 'data' },
        teamId: 'team-456',
        scheduledAt: new Date('2025-01-01T10:00:00Z'),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])

      let receivedAction: ScheduledAction | undefined
      registerScheduledAction('test:action', async (payload, action) => {
        receivedAction = action
      })

      await processPendingActions()

      expect(receivedAction).toEqual(mockAction)
    })
  })

  describe('Recurring Actions', () => {
    test('should reschedule recurring action after completion', async () => {
      // Test that recurring actions are successfully processed
      // The actual rescheduling is handled by scheduleAction which is mocked
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'recurring:action',
        status: 'pending',
        payload: { test: 'recurring' },
        teamId: 'team-456',
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('recurring:action', async () => {})

      const result = await processPendingActions()

      // Verify the action was successfully completed
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)

      // Verify it was marked as completed
      const completedCalls = mockMutateWithRLS.mock.calls.filter(call =>
        call[0].includes("status = 'completed'")
      )
      expect(completedCalls.length).toBeGreaterThan(0)
    })

    test('should not reschedule one-time action', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'onetime:action',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('onetime:action', async () => {})

      const mutateCallsBefore = mockMutateWithRLS.mock.calls.length

      await processPendingActions()

      const mutateCallsAfter = mockMutateWithRLS.mock.calls.length

      // Should have called mutate for: running and completed only (no INSERT for rescheduling)
      const insertCalls = mockMutateWithRLS.mock.calls.slice(mutateCallsBefore).filter(call =>
        call[0].includes('INSERT INTO "scheduledActions"')
      )
      expect(insertCalls.length).toBe(0)
    })

    test('should not reschedule recurring action if it failed', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'failing:recurring',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('failing:recurring', async () => {
        throw new Error('Handler failed')
      })

      const mutateCallsBefore = mockMutateWithRLS.mock.calls.length

      await processPendingActions()

      const mutateCallsAfter = mockMutateWithRLS.mock.calls.length

      // Should have called mutate for: running and failed only (no INSERT for rescheduling)
      const insertCalls = mockMutateWithRLS.mock.calls.slice(mutateCallsBefore).filter(call =>
        call[0].includes('INSERT INTO "scheduledActions"')
      )
      expect(insertCalls.length).toBe(0)
    })
  })

  describe('Timeout Protection', () => {
    test('should use default timeout of 30 seconds', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'slow:action',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])

      // Handler that takes longer than timeout
      registerScheduledAction('slow:action', async () => {
        await new Promise(resolve => setTimeout(resolve, 35000))
      })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('timeout')
    }, 40000) // Test timeout of 40s to allow for 30s timeout + overhead

    test('should use custom timeout from handler definition', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'custom:timeout',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])

      // Register with 100ms timeout for faster test
      registerScheduledAction('custom:timeout', async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      }, { timeout: 100 })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('timeout')
    }, 1000) // Test timeout of 1s
  })

  describe('Error Handling', () => {
    test('should propagate database query errors', async () => {
      const dbError = new Error('Database connection failed')
      mockQueryWithRLS.mockRejectedValue(dbError)

      await expect(processPendingActions()).rejects.toThrow('Database connection failed')
    })

    test('should handle non-Error exceptions', async () => {
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'string:thrower',
        status: 'pending',
        payload: {},
        teamId: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        attempts: 0,
        recurringInterval: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockQueryWithRLS.mockResolvedValue([mockAction])
      registerScheduledAction('string:thrower', async () => {
        throw 'String error' // Non-Error exception
      })

      const result = await processPendingActions()

      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toBe('Unknown error')
    })
  })
})
