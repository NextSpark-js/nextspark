/**
 * lib/auth.ts wires `auth.session` from the merged app config into Better
 * Auth (#125). Loads the auth module in isolation with different AUTH_CONFIG
 * values and inspects the options handed to `betterAuth()`.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

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

type SessionOverride = Record<string, unknown> | undefined

/**
 * Load `@/core/lib/auth` in a fresh module registry with AUTH_CONFIG.session
 * replaced (or left as the core default when `session` is undefined) and
 * return the options object passed to betterAuth().
 */
function loadBetterAuthOptions(session: SessionOverride): Record<string, any> {
  mockBetterAuth.mockClear()
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/config', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config')
      const baseAuth = actual.AUTH_CONFIG ?? actual.APP_CONFIG_MERGED?.auth ?? {}
      const AUTH_CONFIG = session === undefined ? baseAuth : { ...baseAuth, session }
      return { ...actual, AUTH_CONFIG }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  expect(mockBetterAuth).toHaveBeenCalledTimes(1)
  return (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
}

const DAY = 60 * 60 * 24

describe('lib/auth.ts session options (#125)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  test('uses the core defaults when the theme does not configure auth.session', () => {
    const options = loadBetterAuthOptions(undefined)
    expect(options.session).toEqual({
      expiresIn: 7 * DAY,
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 300 },
    })
  })

  test('respects expiresIn/updateAge from the theme AUTH_CONFIG', () => {
    const options = loadBetterAuthOptions({ expiresIn: 90 * DAY, updateAge: 7 * DAY })
    expect(options.session.expiresIn).toBe(90 * DAY)
    expect(options.session.updateAge).toBe(7 * DAY)
    expect(options.session.cookieCache).toEqual({ enabled: true, maxAge: 300 })
  })

  test('theme can disable the cookie cache', () => {
    const options = loadBetterAuthOptions({ cookieCache: { enabled: false } })
    expect(options.session.cookieCache.enabled).toBe(false)
    expect(options.session.expiresIn).toBe(7 * DAY)
  })

  test('invalid theme values never reach Better Auth (sanitized to defaults)', () => {
    const options = loadBetterAuthOptions({ expiresIn: -1, updateAge: 0 })
    expect(options.session.expiresIn).toBe(7 * DAY)
    expect(options.session.updateAge).toBe(DAY)
  })
})
