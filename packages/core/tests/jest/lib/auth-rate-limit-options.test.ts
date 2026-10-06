/**
 * lib/auth.ts exempts /get-session from Better Auth's rate limiter and only it.
 * The proxy's session lookup carries no client IP, so a limit there is one
 * bucket shared by every visitor: past 100 page loads in 10 seconds every
 * signed-in user was sent to /login.
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
  Pool: jest.fn(() => ({ query: jest.fn() })),
}))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) },
}))

describe('lib/auth.ts rate limit options', () => {
  test('/get-session is not limited; nothing else is switched off', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
    })
    const options = (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(options.rateLimit.customRules).toEqual({ '/get-session': false })
    expect(options.rateLimit.enabled).toBeUndefined()
  })
})
