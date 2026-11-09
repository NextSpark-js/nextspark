import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

import { register } from '@/core/instrumentation'

const ENV_KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'NEXTSPARK_DEMO_MODE', 'RESEND_API_KEY', 'STORAGE_DRIVER', 'UPLOADS_DIR', 'BETTER_AUTH_SECRET'] as const
const env = process.env as Record<string, string | undefined>
const saved = Object.fromEntries(ENV_KEYS.map(key => [key, env[key]]))

describe('register() demo mode check', () => {
  let exit: jest.SpiedFunction<typeof process.exit>
  let error: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'production'
    env.BETTER_AUTH_SECRET = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'
    delete env.NEXT_PHASE
    env.STORAGE_DRIVER = 'local'
    env.UPLOADS_DIR = '/tmp/demo'
    delete env.RESEND_API_KEY
    delete env.NEXTSPARK_DEMO_MODE
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  test('demo mode next to a real credential does not start, and prints its name only', async () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    env.RESEND_API_KEY = 're_value_that_must_not_be_printed'
    await register()
    expect(exit).toHaveBeenCalledWith(1)
    expect(String(error.mock.calls[0][0])).toContain('RESEND_API_KEY is set')
    expect(JSON.stringify(error.mock.calls)).not.toContain('re_value_that_must_not_be_printed')
  })

  test('a clean demo starts', async () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })

  test('the same credential without demo mode starts', async () => {
    env.RESEND_API_KEY = 're_x'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })

  test('the build phase is not judged', async () => {
    env.NEXTSPARK_DEMO_MODE = 'true'
    env.RESEND_API_KEY = 're_x'
    env.NEXT_PHASE = 'phase-production-build'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })
})
