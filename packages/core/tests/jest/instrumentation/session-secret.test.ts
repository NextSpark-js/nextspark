import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

const ENV_KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'BETTER_AUTH_SECRET'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const env = process.env as Record<string, string | undefined>

import { register } from '@/core/instrumentation'

describe('register() session secret check', () => {
  let exit: jest.SpiedFunction<typeof process.exit>
  let error: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'production'
    delete env.NEXT_PHASE
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  test.each(['your-secret-key-min-32-chars', 'a'.repeat(31)])('production exits with 1 for %s, without logging it', async (secret) => {
    env.BETTER_AUTH_SECRET = secret
    await register()

    expect(exit).toHaveBeenCalledWith(1)
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret)
    expect(String(error.mock.calls[0][0])).toContain('BETTER_AUTH_SECRET_')
  })

  test('production with a random secret does not exit', async () => {
    env.BETTER_AUTH_SECRET = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })

  test('the production build phase does not exit', async () => {
    env.BETTER_AUTH_SECRET = 'your-secret-key-min-32-chars'
    env.NEXT_PHASE = 'phase-production-build'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })

  test('outside production a placeholder does not exit', async () => {
    env.NODE_ENV = 'development'
    env.BETTER_AUTH_SECRET = 'your-secret-key-min-32-chars'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })
})
