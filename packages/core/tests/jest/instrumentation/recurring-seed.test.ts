import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const initializeScheduledActions = jest.fn()
const initializeRecurringActions = jest.fn<() => Promise<void>>()
jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/media/storage', () => ({ logStorageAtStartup: jest.fn() }))
const scheduledActionsConfig: { requireRecurringSeed?: boolean } = {}
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: { scheduledActions: scheduledActionsConfig } }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: () => initializeScheduledActions(),
  initializeRecurringActions: () => initializeRecurringActions(),
}))

import { register } from '@/core/instrumentation'

const env = process.env as Record<string, string | undefined>
const saved = { NEXT_RUNTIME: env.NEXT_RUNTIME, NODE_ENV: env.NODE_ENV, NEXT_PHASE: env.NEXT_PHASE }

describe('register() and the recurring-actions seed (#398)', () => {
  let warn: jest.SpiedFunction<typeof console.warn>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'development'
    initializeScheduledActions.mockReset()
    initializeRecurringActions.mockReset()
    delete scheduledActionsConfig.requireRecurringSeed
    delete env.NEXT_PHASE
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

  describe('with scheduledActions.requireRecurringSeed (#435)', () => {
    let exit: jest.SpiedFunction<typeof process.exit>
    let error: jest.SpiedFunction<typeof console.error>
    beforeEach(() => {
      scheduledActionsConfig.requireRecurringSeed = true
      exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
      error = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    test('register() resolves only once the seed has', async () => {
      let finishSeed = () => {}
      initializeRecurringActions.mockReturnValue(new Promise<void>((resolve) => { finishSeed = resolve }))
      let resolved = false
      const registering = register().then(() => { resolved = true })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(resolved).toBe(false)
      finishSeed()
      await registering
      expect(exit).not.toHaveBeenCalled()
    })

    test('a seed that fails stops the server with an error that names the option', async () => {
      initializeRecurringActions.mockRejectedValue(new Error('connection refused'))
      await register()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to seed recurring actions: connection refused'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('scheduledActions.requireRecurringSeed'))
      expect(exit).toHaveBeenCalledWith(1)
    })

    test('handlers that fail to register stop the server with their own message, not the seed one', async () => {
      initializeScheduledActions.mockImplementation(() => { throw new Error('bad handler') })
      await register()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize scheduled actions: bad handler'))
      expect(error).not.toHaveBeenCalledWith(expect.stringContaining('Failed to seed recurring actions'))
      expect(initializeRecurringActions).not.toHaveBeenCalled()
      expect(exit).toHaveBeenCalledWith(1)
    })

    test('next build neither waits for the seed nor stops on its failure', async () => {
      env.NEXT_PHASE = 'phase-production-build'
      initializeRecurringActions.mockRejectedValue(new Error('connection refused'))
      await register()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(exit).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to seed recurring actions: connection refused'))
    })
  })
})
