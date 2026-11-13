import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

import { register } from '@/core/instrumentation'

const ENV_KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'NEXTSPARK_E2E_FIXED_OTP', 'STORAGE_DRIVER', 'UPLOADS_DIR', 'BETTER_AUTH_SECRET'] as const
const env = process.env as Record<string, string | undefined>
const saved = Object.fromEntries(ENV_KEYS.map(key => [key, env[key]]))

describe('register() and NEXTSPARK_E2E_FIXED_OTP (#448)', () => {
  let exit: jest.SpiedFunction<typeof process.exit>
  let error: jest.SpiedFunction<typeof console.error>
  let warn: jest.SpiedFunction<typeof console.warn>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'production'
    env.BETTER_AUTH_SECRET = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'
    delete env.NEXT_PHASE
    env.STORAGE_DRIVER = 'local'
    env.UPLOADS_DIR = '/tmp/e2e'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  test('a production server does not start, and the value is not printed', async () => {
    await register()
    expect(exit).toHaveBeenCalledWith(1)
    expect(String(error.mock.calls[0][0])).toContain('NEXTSPARK_E2E_FIXED_OTP is set')
    expect(JSON.stringify(error.mock.calls)).not.toContain('482913')
  })

  test('a development server starts and warns', async () => {
    env.NODE_ENV = 'development'
    await register()
    expect(exit).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).toContain('NEXTSPARK_E2E_FIXED_OTP is set')
  })

  test('unset: no exit and no warning about it', async () => {
    delete env.NEXTSPARK_E2E_FIXED_OTP
    await register()
    expect(exit).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('NEXTSPARK_E2E_FIXED_OTP')
  })
})
