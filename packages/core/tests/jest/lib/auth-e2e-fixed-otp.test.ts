/**
 * #448: lib/auth.ts hands NEXTSPARK_E2E_FIXED_OTP to the emailOTP plugin as its code generator, sends no email while
 * it is on, ignores it when unset, and fails to load in production. tests/node/e2e-fixed-otp.test.ts runs the same
 * options against a real Better Auth.
 */
import { afterEach, describe, test, expect, jest } from '@jest/globals'

const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockEmailOTP = jest.fn(() => ({ id: 'email-otp' }))
const mockSendOtpVerificationEmail = jest.fn(() => Promise.resolve({ subject: 's', html: 'h' }))

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
}))
jest.mock('better-auth/plugins', () => ({
  emailOTP: (...args: unknown[]) => mockEmailOTP(...(args as [])),
  magicLink: jest.fn(() => ({ id: 'magic-link' })),
}))
jest.mock('better-auth/next-js', () => ({
  nextCookies: jest.fn(() => ({ id: 'next-cookies' })),
}))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { create: jest.fn(() => ({ send: jest.fn(async () => ({ id: 'e', success: true })) })) },
}))
jest.mock('@/core/lib/email/send', () => ({
  sendOtpVerificationEmail: (...args: unknown[]) => mockSendOtpVerificationEmail(...(args as [])),
  sendMagicLinkEmail: jest.fn(),
}))

const env = process.env as Record<string, string | undefined>
const saved = { NODE_ENV: env.NODE_ENV, NEXTSPARK_E2E_FIXED_OTP: env.NEXTSPARK_E2E_FIXED_OTP, NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT: env.NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT, VERCEL_ENV: env.VERCEL_ENV, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET, EMAIL_PROVIDER: env.EMAIL_PROVIDER, RESEND_API_KEY: env.RESEND_API_KEY, RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL }

type OtpOptions = {
  generateOTP?: () => string
  sendVerificationOTP: (args: { email: string; otp: string; type: string }) => Promise<void>
}

function loadOtpOptions(): OtpOptions {
  mockEmailOTP.mockClear()
  mockSendOtpVerificationEmail.mockClear()
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  expect(mockEmailOTP).toHaveBeenCalledTimes(1)
  return (mockEmailOTP.mock.calls[0] as unknown[])[0] as OtpOptions
}

describe('NEXTSPARK_E2E_FIXED_OTP in lib/auth.ts (#448)', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  })

  test('set outside production: the plugin generates the fixed code and no email is sent', async () => {
    env.NODE_ENV = 'test'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const options = loadOtpOptions()
    expect(options.generateOTP?.()).toBe('482913')
    await options.sendVerificationOTP({ email: 'a@example.test', otp: '482913', type: 'sign-in' })
    expect(mockSendOtpVerificationEmail).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).toContain('NEXTSPARK_E2E_FIXED_OTP is set')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('482913')
  })

  test('unset: Better Auth generates the code and the email goes out', async () => {
    env.NODE_ENV = 'test'
    delete env.NEXTSPARK_E2E_FIXED_OTP
    const options = loadOtpOptions()
    expect(options.generateOTP).toBeUndefined()
    await options.sendVerificationOTP({ email: 'a@example.test', otp: '123456', type: 'sign-in' })
    expect(mockSendOtpVerificationEmail).toHaveBeenCalledTimes(1)
  })

  test('production: the auth module refuses to load', () => {
    env.NODE_ENV = 'production'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    expect(() => jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
    })).toThrow(/production refuses it/)
  })

  test('production with the preview signal: the fixed code, and every send warns that this is a production build (#460)', async () => {
    env.NODE_ENV = 'production'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    env.NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT = 'preview'
    env.BETTER_AUTH_SECRET = 'Zq7-Lm2_Rt8+Vb4/Nc6=Hd1.Ys5~Wa3x'
    // A production server registers the code plugin only with a usable provider: synthetic values, never real ones
    Object.assign(env, { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_synthetic0123456789abcdef', RESEND_FROM_EMAIL: 'auth@example.test' })
    delete env.VERCEL_ENV
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const options = loadOtpOptions()
    expect(options.generateOTP?.()).toBe('482913')
    await options.sendVerificationOTP({ email: 'a@example.test', otp: '482913', type: 'sign-in' })
    expect(mockSendOtpVerificationEmail).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).toContain('this is a production build')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('482913')
  })

  test('production with the preview signal on a production deployment: the auth module refuses to load (#460)', () => {
    env.NODE_ENV = 'production'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    env.NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT = 'preview'
    env.VERCEL_ENV = 'production'
    expect(() => jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
    })).toThrow(/VERCEL_ENV=production/)
  })

  test('production with another signal value: the auth module refuses to load (#460)', () => {
    env.NODE_ENV = 'production'
    env.NEXTSPARK_E2E_FIXED_OTP = '482913'
    env.NEXTSPARK_E2E_FIXED_OTP_DEPLOYMENT = 'yes'
    delete env.VERCEL_ENV
    expect(() => jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/core/lib/auth')
    })).toThrow(/production refuses it/)
  })
})
