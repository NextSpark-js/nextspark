import { afterEach, describe, expect, jest, test } from '@jest/globals'

const ENV_KEYS = ['NODE_ENV', 'BETTER_AUTH_SECRET'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const env = process.env as Record<string, string | undefined>

function loadAuth(nodeEnv: string, secret: string) {
  env.NODE_ENV = nodeEnv
  env.BETTER_AUTH_SECRET = secret
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
})
