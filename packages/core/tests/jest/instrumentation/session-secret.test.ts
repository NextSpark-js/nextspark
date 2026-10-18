import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/core/lib/auth/runtime-readiness', () => ({ logAuthReadinessAtStartup: jest.fn() }))
jest.mock('@/core/lib/scheduled-actions', () => ({
  initializeScheduledActions: jest.fn(),
  initializeRecurringActions: jest.fn(async () => {}),
}))

const ENV_KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_SECRETS', 'AUTH_SECRET'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const env = process.env as Record<string, string | undefined>

import { register } from '@/core/instrumentation'
import { effectiveSessionSecret } from '@/core/lib/auth/readiness'

const RANDOM = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'

describe('register() session secret check', () => {
  let exit: jest.SpiedFunction<typeof process.exit>
  let error: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    env.NEXT_RUNTIME = 'nodejs'
    env.NODE_ENV = 'production'
    delete env.NEXT_PHASE
    delete env.BETTER_AUTH_SECRETS
    delete env.AUTH_SECRET
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

  // The secret the auth library signs with (better-auth 1.7.7): BETTER_AUTH_SECRETS' first entry, else
  // BETTER_AUTH_SECRET, else AUTH_SECRET (#297)
  test('production with no secret at all exits with 1 and names the three variables', async () => {
    delete env.BETTER_AUTH_SECRET
    await register()
    expect(exit).toHaveBeenCalledWith(1)
    const logged = String(error.mock.calls[0][0])
    expect(logged).toContain('BETTER_AUTH_SECRET_MISSING')
    for (const name of ['BETTER_AUTH_SECRET', 'BETTER_AUTH_SECRETS', 'AUTH_SECRET']) expect(logged).toContain(name)
  })

  test.each([
    ['AUTH_SECRET alone', { AUTH_SECRET: 'short-auth-secret' }, 'AUTH_SECRET is shorter'],
    ['BETTER_AUTH_SECRETS with a short first entry', { BETTER_AUTH_SECRETS: `2:short-current, 1:${RANDOM}`, BETTER_AUTH_SECRET: RANDOM }, 'The first entry of BETTER_AUTH_SECRETS'],
    ['BETTER_AUTH_SECRETS with a placeholder first entry', { BETTER_AUTH_SECRETS: '1:your-secret-key-min-32-chars' }, 'is a placeholder'],
    ['BETTER_AUTH_SECRETS without a version', { BETTER_AUTH_SECRETS: RANDOM }, 'BETTER_AUTH_SECRETS must be'],
    ['BETTER_AUTH_SECRETS with a malformed later entry', { BETTER_AUTH_SECRETS: `2:${RANDOM},bad` }, 'BETTER_AUTH_SECRETS must be'],
    ['BETTER_AUTH_SECRETS with a non-integer version', { BETTER_AUTH_SECRETS: `x:${RANDOM}` }, 'BETTER_AUTH_SECRETS must be'],
    ['BETTER_AUTH_SECRETS with a version twice', { BETTER_AUTH_SECRETS: `1:${RANDOM},1:${RANDOM}x` }, 'BETTER_AUTH_SECRETS must be'],
    ['BETTER_AUTH_SECRETS with an empty later secret', { BETTER_AUTH_SECRETS: `2:${RANDOM},1:` }, 'BETTER_AUTH_SECRETS must be'],
  ])('production exits with 1 for a weak effective secret: %s, without logging it', async (_label, vars, reason) => {
    delete env.BETTER_AUTH_SECRET
    Object.assign(env, vars)
    await register()
    expect(exit).toHaveBeenCalledWith(1)
    expect(String(error.mock.calls[0][0])).toContain(reason)
    for (const value of Object.values(vars)) expect(JSON.stringify(error.mock.calls)).not.toContain(value)
  })

  test.each([
    ['a long AUTH_SECRET alone', { AUTH_SECRET: RANDOM }],
    ['an empty BETTER_AUTH_SECRET and a long AUTH_SECRET', { BETTER_AUTH_SECRET: '', AUTH_SECRET: RANDOM }],
    ['BETTER_AUTH_SECRETS with a proper first entry', { BETTER_AUTH_SECRETS: `2:${RANDOM}, 1:old` }],
    ['BETTER_AUTH_SECRETS with a proper first entry and a short BETTER_AUTH_SECRET', { BETTER_AUTH_SECRETS: `1:${RANDOM}`, BETTER_AUTH_SECRET: 'short' }],
  ])('production with %s does not exit', async (_label, vars) => {
    delete env.BETTER_AUTH_SECRET
    Object.assign(env, vars)
    await register()
    expect(exit).not.toHaveBeenCalled()
  })

  test('the build phase does not require a secret', async () => {
    delete env.BETTER_AUTH_SECRET
    env.NEXT_PHASE = 'phase-production-build'
    await register()
    expect(exit).not.toHaveBeenCalled()
  })
})

describe('effectiveSessionSecret', () => {
  test('resolves in the auth library\'s order', () => {
    expect(effectiveSessionSecret({})).toBeNull()
    expect(effectiveSessionSecret({ BETTER_AUTH_SECRETS: '', BETTER_AUTH_SECRET: '', AUTH_SECRET: '' })).toBeNull()
    expect(effectiveSessionSecret({ AUTH_SECRET: 'a' })).toEqual({ variable: 'AUTH_SECRET', value: 'a' })
    expect(effectiveSessionSecret({ BETTER_AUTH_SECRET: 'b', AUTH_SECRET: 'a' })).toEqual({ variable: 'BETTER_AUTH_SECRET', value: 'b' })
    expect(effectiveSessionSecret({ BETTER_AUTH_SECRETS: ' 3: c3 ,2:c2', BETTER_AUTH_SECRET: 'b' })).toEqual({ variable: 'BETTER_AUTH_SECRETS', value: 'c3' })
    expect(effectiveSessionSecret({ BETTER_AUTH_SECRETS: 'no-colon' })).toEqual({ variable: 'BETTER_AUTH_SECRETS', value: '' })
  })
})
