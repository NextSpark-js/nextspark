import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { readUploadClaim, signUploadClaim, type UploadClaim } from '@/core/lib/media/upload-token'

const ENV_KEYS = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_SECRETS', 'AUTH_SECRET'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
const env = process.env as Record<string, string | undefined>

const LONG_A = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'
const LONG_B = 'k9f3k9f3k9f3k9f3k9f3k9f3k9f3k9f3'
const claim: UploadClaim = {
  name: 'media/abc.png', userId: 'u1', teamId: 't1', mimeType: 'image/png', size: 10, filename: 'abc.png', expiresAt: 1,
}

/** Sets exactly these secret variables. */
function secrets(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete env[key]
  Object.assign(env, vars)
}

// The token key comes from the secret the auth library signs sessions with (#297)
describe('upload token key', () => {
  beforeEach(() => secrets({}))
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  test('AUTH_SECRET alone signs and reads tokens', () => {
    secrets({ AUTH_SECRET: LONG_A })
    expect(readUploadClaim(signUploadClaim(claim))).toEqual(claim)
  })

  test('with BETTER_AUTH_SECRETS, the first entry signs, not a short BETTER_AUTH_SECRET', () => {
    secrets({ BETTER_AUTH_SECRETS: `2:${LONG_A},1:${LONG_B}`, BETTER_AUTH_SECRET: 'short' })
    const token = signUploadClaim(claim)
    secrets({ BETTER_AUTH_SECRET: LONG_A })
    expect(readUploadClaim(token)).toEqual(claim)
    secrets({ BETTER_AUTH_SECRET: 'short' })
    expect(readUploadClaim(token)).toBeNull()
  })

  test('a token signed under one effective secret fails under another', () => {
    secrets({ BETTER_AUTH_SECRET: LONG_A })
    const token = signUploadClaim(claim)
    secrets({ BETTER_AUTH_SECRET: LONG_B })
    expect(readUploadClaim(token)).toBeNull()
    secrets({ BETTER_AUTH_SECRETS: `1:${LONG_B}`, BETTER_AUTH_SECRET: LONG_A })
    expect(readUploadClaim(token)).toBeNull()
  })

  test('no secret at all throws a fixed message naming the three variables', () => {
    expect(() => signUploadClaim(claim)).toThrow('No session secret is set: set BETTER_AUTH_SECRET (or BETTER_AUTH_SECRETS, or AUTH_SECRET)')
  })
})
