/**
 * Unit Tests: core action types run in a process that never registered them
 *
 * A cron instance (serverless, or the same server after a restart) starts with
 * an empty handler registry: the processor itself must provide the handlers of
 * the action types core enqueues.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const mockSend = jest.fn()
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { getInstance: () => ({ send: mockSend }) },
}))

const mockGetUsages = jest.fn()
jest.mock('@/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { getUsagesWithEntityInfo: mockGetUsages },
}))

const mockRevalidatePath = jest.fn()
jest.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

jest.mock('@/core/lib/scheduled-actions/scheduler', () => ({
  scheduleAction: jest.fn(),
}))

jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: { scheduledActions: { batchSize: 10, defaultTimeout: 30000, concurrencyLimit: 1 } },
}))

import { processPendingActions } from '@/core/lib/scheduled-actions/processor'
import {
  clearActionRegistry,
  getActionHandler,
  registerScheduledAction,
} from '@/core/lib/scheduled-actions/registry'
import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { setEntityRegistry } from '@/core/lib/entities/queries'
import type { ScheduledAction } from '@/core/lib/scheduled-actions/types'

function action(id: string, actionType: string, payload: unknown): ScheduledAction {
  return {
    id, actionType, payload, status: 'pending', teamId: null, scheduledAt: new Date(),
    startedAt: null, completedAt: null, errorMessage: null, attempts: 0, maxRetries: 3,
    recurringInterval: null, recurrenceType: null, lockGroup: null,
    createdAt: new Date(), updatedAt: new Date(),
  }
}

describe('core scheduled-action handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
    ;(mutateWithRLS as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [] } as never)
    mockSend.mockResolvedValue({ success: true } as never)
    mockGetUsages.mockResolvedValue({ usages: [], total: 0 } as never)
  })

  test('the processor runs auth:security-notification and pattern:invalidate-cache with an empty registry', async () => {
    ;(queryWithRLS as jest.Mock).mockResolvedValue([
      action('a1', 'auth:security-notification', { to: 'u@example.com', type: 'passwordChanged', locale: 'en' }),
      action('a2', 'pattern:invalidate-cache', { patternId: 'p1', userId: 'u1' }),
    ] as never)

    const result = await processPendingActions()

    expect(result.errors).toEqual([])
    expect(result).toMatchObject({ processed: 2, succeeded: 2, failed: 0 })
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'u@example.com' }))
    expect(mockGetUsages).toHaveBeenCalledWith('p1', 'u1', expect.anything())
  })

  test('pattern:invalidate-cache resolves the entities of its usages from the generated registry', async () => {
    // a module graph where no entity route ran: its entity registry is empty
    setEntityRegistry({})
    mockGetUsages.mockResolvedValue({ usages: [{ entityType: 'posts', entityId: 'e1', entitySlug: 'hello' }], total: 1 } as never)
    ;(queryWithRLS as jest.Mock).mockResolvedValue([
      action('a2', 'pattern:invalidate-cache', { patternId: 'p1', userId: 'u1' }),
    ] as never)

    await processPendingActions()

    expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    expect(mockRevalidatePath.mock.calls[0][0]).toMatch(/\/hello$/)
  })

  test('a handler the project registered under a core name is kept', async () => {
    const projectHandler = jest.fn(async () => {})
    registerScheduledAction('auth:security-notification', projectHandler)
    ;(queryWithRLS as jest.Mock).mockResolvedValue([
      action('a1', 'auth:security-notification', { to: 'u@example.com', type: 'passwordChanged' }),
    ] as never)

    await processPendingActions()

    expect(projectHandler).toHaveBeenCalledTimes(1)
    expect(mockSend).not.toHaveBeenCalled()
    expect(getActionHandler('auth:security-notification')?.handler).toBe(projectHandler)
  })
})
