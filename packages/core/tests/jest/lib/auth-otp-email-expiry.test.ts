/**
 * The emailOTP plugin's `sendVerificationOTP` hook (#186) must forward the
 * resolved `otpConfig.expiresIn` to the OTP email template. Without it, the
 * email keeps whatever hardcoded lifetime the template falls back to — wrong
 * as soon as a theme configures `auth.otp.expiresIn` away from the default.
 *
 * Mocks `sendOtpVerificationEmail` directly (rather than the email registry)
 * so this test asserts the exact call contract instead of rendered HTML,
 * which `tests/jest/emails/otp-verification-expiry.test.ts` already covers.
 */
import { describe, test, expect, jest } from '@jest/globals'

const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockEmailOTP = jest.fn(() => ({ id: 'email-otp' }))
const mockSendOtpVerificationEmail = jest.fn(() => Promise.resolve({ subject: 's', html: 'h' }))

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
jest.mock('@/core/lib/email/send', () => ({
  sendOtpVerificationEmail: (...args: unknown[]) => mockSendOtpVerificationEmail(...(args as [])),
}))

type AuthOverride = Record<string, unknown> | undefined

function loadWithThemeAuth(override: AuthOverride) {
  mockBetterAuth.mockClear()
  mockEmailOTP.mockClear()
  mockSendOtpVerificationEmail.mockClear()
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
    require('@/core/lib/auth')
  })
  expect(mockEmailOTP).toHaveBeenCalledTimes(1)
  const otpOptions = (mockEmailOTP.mock.calls[0] as unknown[])[0] as {
    sendVerificationOTP: (args: { email: string; otp: string; type: string }) => Promise<void>
  }
  return otpOptions
}

describe('emailOTP sendVerificationOTP forwards the resolved expiresIn (#186)', () => {
  test('the default lifetime (300s) reaches the email template', async () => {
    const otpOptions = loadWithThemeAuth(undefined)
    await otpOptions.sendVerificationOTP({ email: 'a@example.test', otp: '123456', type: 'sign-in' })

    expect(mockSendOtpVerificationEmail).toHaveBeenCalledTimes(1)
    const [data] = mockSendOtpVerificationEmail.mock.calls[0] as [Record<string, unknown>]
    expect(data.expiresIn).toBe(300)
  })

  test("a theme's auth.otp.expiresIn reaches the email template unchanged", async () => {
    const otpOptions = loadWithThemeAuth({ otp: { expiresIn: 120 } })
    await otpOptions.sendVerificationOTP({ email: 'a@example.test', otp: '123456', type: 'sign-in' })

    expect(mockSendOtpVerificationEmail).toHaveBeenCalledTimes(1)
    const [data] = mockSendOtpVerificationEmail.mock.calls[0] as [Record<string, unknown>]
    expect(data.expiresIn).toBe(120)
  })

  test('the same expiresIn also reaches the emailOTP plugin config, so the login screen and the email never disagree', async () => {
    loadWithThemeAuth({ otp: { expiresIn: 120 } })
    const pluginOptions = (mockEmailOTP.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(pluginOptions.expiresIn).toBe(120)
  })
})
