import { afterEach, describe, expect, jest, test } from '@jest/globals'

const ENV_KEYS = ['NODE_ENV', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_SECRETS', 'AUTH_SECRET'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const env = process.env as Record<string, string | undefined>

function loadAuth(nodeEnv: string, secret: string | undefined, other: Record<string, string> = {}) {
  env.NODE_ENV = nodeEnv
  if (secret === undefined) delete env.BETTER_AUTH_SECRET
  else env.BETTER_AUTH_SECRET = secret
  delete env.BETTER_AUTH_SECRETS
  delete env.AUTH_SECRET
  Object.assign(env, other)
  jest.resetModules()
  return require('@/core/lib/auth')
}

describe('auth instance session secret', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  test.each(['your-secret-key-min-32-chars', 'a'.repeat(31)])('production refuses to build the instance with %s', (secret) => {
    expect(() => loadAuth('production', secret)).toThrow('BETTER_AUTH_SECRET')
  })

  test('production builds the instance with a random secret', () => {
    expect(loadAuth('production', 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x').auth).toBeDefined()
  })

  test('outside production a short secret still builds', () => {
    expect(loadAuth('test', 'short').auth).toBeDefined()
  })

  // The secret the auth library resolves, not only BETTER_AUTH_SECRET (#297)
  test('production refuses a short AUTH_SECRET or a short first entry of BETTER_AUTH_SECRETS', () => {
    expect(() => loadAuth('production', undefined, { AUTH_SECRET: 'short' })).toThrow('AUTH_SECRET is shorter')
    expect(() => loadAuth('production', 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x', { BETTER_AUTH_SECRETS: '2:short' })).toThrow('BETTER_AUTH_SECRETS')
  })

  test('production builds the instance with a long AUTH_SECRET alone, or a proper BETTER_AUTH_SECRETS', () => {
    expect(loadAuth('production', undefined, { AUTH_SECRET: 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x' }).auth).toBeDefined()
    expect(loadAuth('production', undefined, { BETTER_AUTH_SECRETS: '1:Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x' }).auth).toBeDefined()
  })

  test('production with no secret builds the instance: the server start refuses it (register())', () => {
    expect(loadAuth('production', undefined).auth).toBeDefined()
  })
})
