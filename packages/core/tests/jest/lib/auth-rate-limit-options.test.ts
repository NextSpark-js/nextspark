/**
 * lib/auth.ts exempts /get-session from Better Auth's rate limiter and only it.
 * The proxy's session lookup carries no client IP, so a limit there is one
 * bucket shared by every visitor: past 100 page loads in 10 seconds every
 * signed-in user was sent to /login.
 * DISABLE_RATE_LIMITING=true (QA/preview deploys and tests) turns the whole
 * limiter off, plugin rules included; any other value leaves Better Auth's default.
 */
import { describe, test, expect, jest } from '@jest/globals'

const mockBetterAuth = jest.fn(() => ({
  api: { getSession: jest.fn() },
  $Infer: {},
}))

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
}))
jest.mock('better-auth/plugins', () => ({
  emailOTP: jest.fn(() => ({ id: 'email-otp' })),
}))
jest.mock('better-auth/next-js', () => ({
  nextCookies: jest.fn(() => ({ id: 'next-cookies' })),
}))
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })),
}))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) },
}))

function authOptionsWith(disableRateLimiting: string | undefined): Record<string, any> {
  const previous = process.env.DISABLE_RATE_LIMITING
  if (disableRateLimiting === undefined) delete process.env.DISABLE_RATE_LIMITING
  else process.env.DISABLE_RATE_LIMITING = disableRateLimiting
  mockBetterAuth.mockClear()
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('nextspark.rateLimitDisabledWarned')]
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
    })
  } finally {
    if (previous === undefined) delete process.env.DISABLE_RATE_LIMITING
    else process.env.DISABLE_RATE_LIMITING = previous
  }
  return (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
}

describe('lib/auth.ts rate limit options', () => {
  test('/get-session is not limited; nothing else is switched off', () => {
    const options = authOptionsWith(undefined)
    expect(options.rateLimit.customRules).toEqual({ '/get-session': false })
    expect('enabled' in options.rateLimit).toBe(false)
  })

  test('DISABLE_RATE_LIMITING=true turns the whole Better Auth limiter off', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const options = authOptionsWith('true')
      expect(options.rateLimit.enabled).toBe(false)
      expect(options.rateLimit.customRules).toEqual({ '/get-session': false })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain('Better Auth')
    } finally {
      warn.mockRestore()
    }
  })

  test('any other value leaves Better Auth on its default', () => {
    const options = authOptionsWith('1')
    expect(options.rateLimit.customRules).toEqual({ '/get-session': false })
    expect('enabled' in options.rateLimit).toBe(false)
  })
})
