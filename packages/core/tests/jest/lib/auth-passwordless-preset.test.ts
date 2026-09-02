/**
 * #126 — passwordless preset is the default, and the traditional login keeps
 * working unless a theme overrides it.
 *
 * Loads `@/core/lib/auth` and `@/core/lib/config` in isolation with different
 * theme-level AUTH_CONFIG overrides and inspects (a) what the client sees
 * (PUBLIC_AUTH_CONFIG) and (b) what Better Auth is configured with.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockEmailOTP = jest.fn(() => ({ id: 'email-otp' }))

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
}))
jest.mock('better-auth/plugins', () => ({
  emailOTP: (...args: unknown[]) => mockEmailOTP(...(args as [])),
}))
jest.mock('better-auth/next-js', () => ({
  nextCookies: jest.fn(() => ({ id: 'next-cookies' })),
}))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) },
}))

type AuthOverride = Record<string, unknown> | undefined

/**
 * Load auth + config with the theme-level `auth` block partially overridden
 * (undefined = core defaults, i.e. "the theme does not override anything").
 */
function loadWithThemeAuth(override: AuthOverride) {
  mockBetterAuth.mockClear()
  mockEmailOTP.mockClear()
  let publicAuthConfig: any
  let authConfig: any
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/config/config-sync', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config/config-sync')
      if (override === undefined) return actual
      const helpers = jest.requireActual<Record<string, any>>('@/core/lib/auth/registration-helpers')
      const AUTH_CONFIG = { ...actual.AUTH_CONFIG, ...override }
      return {
        ...actual,
        AUTH_CONFIG,
        APP_CONFIG_MERGED: { ...actual.APP_CONFIG_MERGED, auth: AUTH_CONFIG },
        PUBLIC_AUTH_CONFIG: helpers.getPublicAuthConfig(AUTH_CONFIG),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('@/core/lib/config')
    publicAuthConfig = config.PUBLIC_AUTH_CONFIG
    authConfig = config.AUTH_CONFIG
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  expect(mockBetterAuth).toHaveBeenCalledTimes(1)
  const betterAuthOptions = (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
  return { publicAuthConfig, authConfig, betterAuthOptions }
}

describe('passwordless preset (#126)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  test('is active by default: the client gets email OTP + Google and no password method', () => {
    const { publicAuthConfig, betterAuthOptions } = loadWithThemeAuth(undefined)

    expect(publicAuthConfig.methods).toEqual(['email-otp', 'google'])
    expect(publicAuthConfig.methods).not.toContain('email-password')
    expect(publicAuthConfig.providers.google.enabled).toBe(true)

    // Server: the emailOTP plugin is registered and wired to send codes
    expect(mockEmailOTP).toHaveBeenCalledTimes(1)
    const otpOptions = (mockEmailOTP.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(otpOptions.otpLength).toBe(6)
    expect(otpOptions.expiresIn).toBe(300)
    expect(otpOptions.disableSignUp).toBe(false) // first OTP sign-in creates the account
    expect(typeof otpOptions.sendVerificationOTP).toBe('function')
    expect(betterAuthOptions.plugins).toEqual(expect.arrayContaining([{ id: 'email-otp' }]))

    // Server: Google OAuth provider configured
    expect(betterAuthOptions.socialProviders.google).toBeDefined()
  })

  test('the traditional email + password login keeps working when the theme does not override it', () => {
    const { betterAuthOptions, authConfig } = loadWithThemeAuth(undefined)

    expect(authConfig.emailAndPassword.enabled).toBe(true)
    expect(betterAuthOptions.emailAndPassword.enabled).toBe(true)
    expect(betterAuthOptions.emailAndPassword.requireEmailVerification).toBe(true)
  })

  test('a theme can switch to the classic preset without touching the server', () => {
    const { publicAuthConfig, betterAuthOptions } = loadWithThemeAuth({ methods: ['email-password', 'google'] })

    expect(publicAuthConfig.methods).toEqual(['email-password', 'google'])
    expect(betterAuthOptions.emailAndPassword.enabled).toBe(true)
    // OTP plugin still registered — presets are UI-level, the server serves every method
    expect(mockEmailOTP).toHaveBeenCalledTimes(1)
  })

  test('a theme can hard-disable password auth server-side for a strictly passwordless app', () => {
    const { betterAuthOptions } = loadWithThemeAuth({ emailAndPassword: { enabled: false } })
    expect(betterAuthOptions.emailAndPassword.enabled).toBe(false)
  })

  test('dropping google from methods hides it from the client even if providers leave it enabled', () => {
    const { publicAuthConfig } = loadWithThemeAuth({ methods: ['email-otp'], providers: { google: { enabled: true } } })
    expect(publicAuthConfig.methods).toEqual(['email-otp'])
    expect(publicAuthConfig.providers.google.enabled).toBe(false)
  })
})
