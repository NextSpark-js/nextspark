import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const initializeScheduledActions = jest.fn()
const initializeRecurringActions = jest.fn<() => Promise<void>>()
jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/media/storage', () => ({ logStorageAtStartup: jest.fn() }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: () => initializeScheduledActions(),
  initializeRecurringActions: () => initializeRecurringActions(),
}))

import { register } from '@/core/instrumentation'

const env = process.env as Record<string, string | undefined>
const saved = { NEXT_RUNTIME: env.NEXT_RUNTIME, NODE_ENV: env.NODE_ENV }

describe('register() and the recurring-actions seed (#398)', () => {
  let warn: jest.SpiedFunction<typeof console.warn>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'development'
    initializeScheduledActions.mockReset()
    initializeRecurringActions.mockReset()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  })

  test('resolves while the seed never settles, with the handlers already registered', async () => {
    initializeRecurringActions.mockReturnValue(new Promise<void>(() => {}))
    await register()
    expect(initializeScheduledActions).toHaveBeenCalledTimes(1)
    expect(initializeRecurringActions).toHaveBeenCalledTimes(1)
  })

  test('a seed that fails does not reject register() and is logged as a warning', async () => {
    initializeRecurringActions.mockRejectedValue(new Error('connection refused'))
    await expect(register()).resolves.toBeUndefined()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to seed recurring actions: connection refused'))
  })

  test('the handlers are registered before the seed starts', async () => {
    const order: string[] = []
    initializeScheduledActions.mockImplementation(() => void order.push('handlers'))
    initializeRecurringActions.mockImplementation(async () => void order.push('seed'))
    await register()
    expect(order).toEqual(['handlers', 'seed'])
  })
})
