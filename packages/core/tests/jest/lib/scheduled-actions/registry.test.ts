/**
 * Unit Tests: Scheduled Actions Registry
 * Tests registration and lookup of action handlers
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import {
  registerScheduledAction,
  getActionHandler,
  getAllRegisteredActions,
  isActionRegistered,
  clearActionRegistry
} from '@/core/lib/scheduled-actions/registry'
import type { ScheduledActionHandler, ScheduledAction } from '@/core/lib/scheduled-actions/types'

describe('Scheduled Actions Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    clearActionRegistry()
  })

  afterEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
  })

  describe('registerScheduledAction', () => {
    test('should register action handler with name only', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('test:action', handler)

      const definition = getActionHandler('test:action')
      expect(definition).toBeDefined()
      expect(definition?.name).toBe('test:action')
      expect(definition?.handler).toBe(handler)
      expect(definition?.description).toBeUndefined()
      expect(definition?.timeout).toBeUndefined()
    })

    test('should register action handler with description', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('test:action', handler, {
        description: 'Test action handler'
      })

      const definition = getActionHandler('test:action')
      expect(definition?.description).toBe('Test action handler')
    })

    test('should register action handler with custom timeout', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('test:action', handler, {
        timeout: 60000
      })

      const definition = getActionHandler('test:action')
      expect(definition?.timeout).toBe(60000)
    })

    test('should register action handler with both description and timeout', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('test:action', handler, {
        description: 'Test action',
        timeout: 45000
      })

      const definition = getActionHandler('test:action')
      expect(definition?.name).toBe('test:action')
      expect(definition?.description).toBe('Test action')
      expect(definition?.timeout).toBe(45000)
    })

    test('should allow overwriting existing action with warning', () => {
      const handler1: ScheduledActionHandler = async () => {}
      const handler2: ScheduledActionHandler = async () => {}

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      registerScheduledAction('test:action', handler1)
      registerScheduledAction('test:action', handler2)

      const definition = getActionHandler('test:action')
      expect(definition?.handler).toBe(handler2)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Action 'test:action' is already registered")
      )

      consoleWarnSpy.mockRestore()
    })

    test('should register multiple different actions', () => {
      const handler1: ScheduledActionHandler = async () => {}
      const handler2: ScheduledActionHandler = async () => {}
      const handler3: ScheduledActionHandler = async () => {}

      registerScheduledAction('webhook:send', handler1)
      registerScheduledAction('billing:check', handler2)
      registerScheduledAction('email:send', handler3)

      expect(getAllRegisteredActions()).toHaveLength(3)
      expect(getActionHandler('webhook:send')).toBeDefined()
      expect(getActionHandler('billing:check')).toBeDefined()
      expect(getActionHandler('email:send')).toBeDefined()
    })
  })

  describe('getActionHandler', () => {
    test('should return undefined for unregistered action', () => {
      const definition = getActionHandler('nonexistent:action')
      expect(definition).toBeUndefined()
    })

    test('should return correct definition for registered action', () => {
      const handler: ScheduledActionHandler = async (payload, action) => {
        console.log('Handler called')
      }

      registerScheduledAction('test:action', handler, {
        description: 'Test',
        timeout: 5000
      })

      const definition = getActionHandler('test:action')
      expect(definition).toEqual({
        name: 'test:action',
        handler,
        description: 'Test',
        timeout: 5000
      })
    })

    test('should return different handlers for different actions', () => {
      const handler1: ScheduledActionHandler = async () => {}
      const handler2: ScheduledActionHandler = async () => {}

      registerScheduledAction('action1', handler1)
      registerScheduledAction('action2', handler2)

      expect(getActionHandler('action1')?.handler).toBe(handler1)
      expect(getActionHandler('action2')?.handler).toBe(handler2)
    })
  })

  describe('getAllRegisteredActions', () => {
    test('should return empty array when no actions registered', () => {
      const actions = getAllRegisteredActions()
      expect(actions).toEqual([])
      expect(actions).toHaveLength(0)
    })

    test('should return all registered action names', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('webhook:send', handler)
      registerScheduledAction('billing:check', handler)
      registerScheduledAction('email:send', handler)

      const actions = getAllRegisteredActions()
      expect(actions).toHaveLength(3)
      expect(actions).toContain('webhook:send')
      expect(actions).toContain('billing:check')
      expect(actions).toContain('email:send')
    })

    test('should return updated list after registration', () => {
      const handler: ScheduledActionHandler = async () => {}

      expect(getAllRegisteredActions()).toHaveLength(0)

      registerScheduledAction('action1', handler)
      expect(getAllRegisteredActions()).toHaveLength(1)

      registerScheduledAction('action2', handler)
      expect(getAllRegisteredActions()).toHaveLength(2)
    })

    test('should not duplicate action names when overwriting', () => {
      const handler1: ScheduledActionHandler = async () => {}
      const handler2: ScheduledActionHandler = async () => {}

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      registerScheduledAction('test:action', handler1)
      registerScheduledAction('test:action', handler2)

      const actions = getAllRegisteredActions()
      expect(actions).toHaveLength(1)
      expect(actions.filter(a => a === 'test:action')).toHaveLength(1)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('isActionRegistered', () => {
    test('should return false for unregistered action', () => {
      expect(isActionRegistered('nonexistent:action')).toBe(false)
    })

    test('should return true for registered action', () => {
      const handler: ScheduledActionHandler = async () => {}
      registerScheduledAction('test:action', handler)

      expect(isActionRegistered('test:action')).toBe(true)
    })

    test('should return false after clearing registry', () => {
      const handler: ScheduledActionHandler = async () => {}
      registerScheduledAction('test:action', handler)

      expect(isActionRegistered('test:action')).toBe(true)

      clearActionRegistry()

      expect(isActionRegistered('test:action')).toBe(false)
    })

    test('should check multiple actions correctly', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('action1', handler)
      registerScheduledAction('action2', handler)

      expect(isActionRegistered('action1')).toBe(true)
      expect(isActionRegistered('action2')).toBe(true)
      expect(isActionRegistered('action3')).toBe(false)
    })
  })

  describe('clearActionRegistry', () => {
    test('should clear all registered actions', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('action1', handler)
      registerScheduledAction('action2', handler)
      registerScheduledAction('action3', handler)

      expect(getAllRegisteredActions()).toHaveLength(3)

      clearActionRegistry()

      expect(getAllRegisteredActions()).toHaveLength(0)
    })

    test('should allow re-registration after clearing', () => {
      const handler: ScheduledActionHandler = async () => {}

      registerScheduledAction('test:action', handler)
      clearActionRegistry()
      registerScheduledAction('test:action', handler)

      expect(isActionRegistered('test:action')).toBe(true)
    })

    test('should not warn when registering after clearing', () => {
      const handler: ScheduledActionHandler = async () => {}
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      registerScheduledAction('test:action', handler)
      clearActionRegistry()
      registerScheduledAction('test:action', handler)

      // Should only log registration, not warning about overwrite
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Action Handler Execution', () => {
    test('should store and retrieve handler that can be executed', async () => {
      let executionCount = 0
      const handler: ScheduledActionHandler = async (payload, action) => {
        executionCount++
      }

      registerScheduledAction('test:action', handler)

      const definition = getActionHandler('test:action')
      expect(definition).toBeDefined()

      // Execute the handler
      const mockAction: ScheduledAction = {
        id: 'test-id',
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

      await definition!.handler({}, mockAction)

      expect(executionCount).toBe(1)
    })

    test('should pass payload and action to handler', async () => {
      let receivedPayload: unknown
      let receivedAction: ScheduledAction | undefined

      const handler: ScheduledActionHandler = async (payload, action) => {
        receivedPayload = payload
        receivedAction = action
      }

      registerScheduledAction('test:action', handler)

      const definition = getActionHandler('test:action')
      const mockPayload = { test: 'data', value: 123 }
      const mockAction: ScheduledAction = {
        id: 'action-123',
        actionType: 'test:action',
        status: 'running',
        payload: mockPayload,
        teamId: 'team-456',
        scheduledAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        attempts: 1,
        recurringInterval: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await definition!.handler(mockPayload, mockAction)

      expect(receivedPayload).toEqual(mockPayload)
      expect(receivedAction).toEqual(mockAction)
    })
  })
})
