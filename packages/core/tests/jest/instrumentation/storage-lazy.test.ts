import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

// A factory runs when the module is first required: the counter says whether register() loaded storage (#478)
const storageLoads = jest.fn()
const logStorageAtStartup = jest.fn()
jest.mock('@/core/lib/media/storage', () => {
  storageLoads()
  return { logStorageAtStartup: () => logStorageAtStartup() }
})
jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: {} }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

const env = process.env as Record<string, string | undefined>
const saved = { NEXT_RUNTIME: env.NEXT_RUNTIME, STORAGE_DRIVER: env.STORAGE_DRIVER }

describe('register() and the storage module (#478)', () => {
  // Fresh module registry per case: a cached storage module would make storageLoads count only the first case
  let register: () => Promise<void>
  beforeEach(async () => {
    jest.resetModules()
    ;({ register } = await import('@/core/instrumentation'))
    env.NEXT_RUNTIME = 'nodejs'
    storageLoads.mockClear()
    logStorageAtStartup.mockClear()
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  })

  test.each([undefined, '', '  '])('does not load storage when STORAGE_DRIVER is %j', async value => {
    if (value === undefined) delete env.STORAGE_DRIVER
    else env.STORAGE_DRIVER = value
    await register()
    expect(storageLoads).not.toHaveBeenCalled()
    expect(logStorageAtStartup).not.toHaveBeenCalled()
  })

  test('loads storage and checks it when STORAGE_DRIVER is set', async () => {
    env.STORAGE_DRIVER = 'local'
    await register()
    expect(storageLoads).toHaveBeenCalledTimes(1)
    expect(logStorageAtStartup).toHaveBeenCalledTimes(1)
  })
})
