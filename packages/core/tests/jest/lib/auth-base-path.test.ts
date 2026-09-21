/**
 * lib/auth.ts under a Next.js basePath: Better Auth serves its routes, builds
 * its links and redirects OAuth errors under the base path. Loads the auth
 * module in isolation and inspects the options handed to `betterAuth()`.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'

const mockEmailSend = jest.fn(async () => ({ success: true }))
const mockEmailCreate = jest.fn(() => ({ send: mockEmailSend }))
const mockEmailOtp = jest.fn((options: object) => ({ id: 'email-otp', ...options }))

const mockBetterAuth = jest.fn(() => ({
  api: { getSession: jest.fn() },
  $Infer: {},
}))

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
}))
jest.mock('better-auth/plugins', () => ({
  emailOTP: mockEmailOtp,
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
  EmailFactory: { create: mockEmailCreate },
}))

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

interface BasePathOptions {
  basePath?: string
  onAPIError: { errorURL?: string }
  plugins: Array<{ id?: string; sendVerificationOTP?: (value: { email: string; otp: string; type: string }) => Promise<void> }>
}

function loadBetterAuthOptions(basePath: string | undefined): BasePathOptions {
  if (basePath === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = basePath
  mockBetterAuth.mockClear()
  mockEmailCreate.mockClear()
  mockEmailSend.mockClear()
  mockEmailOtp.mockClear()
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  expect(mockBetterAuth).toHaveBeenCalledTimes(1)
  return (mockBetterAuth.mock.calls[0] as unknown[])[0] as BasePathOptions
}

describe('lib/auth.ts base path options', () => {
  test('does not create an email provider while the auth module is loading', () => {
    loadBetterAuthOptions(undefined)

    expect(mockEmailCreate).not.toHaveBeenCalled()
  })

  test('creates the email provider lazily when an enabled OTP callback sends', async () => {
    const options = loadBetterAuthOptions(undefined)
    const otpPlugin = options.plugins.find((plugin) => plugin.id === 'email-otp')

    expect(otpPlugin?.sendVerificationOTP).toBeDefined()
    expect(mockEmailCreate).not.toHaveBeenCalled()
    await otpPlugin!.sendVerificationOTP!({ email: 'user@example.com', otp: '123456', type: 'sign-in' })
    expect(mockEmailCreate).toHaveBeenCalledTimes(1)
    expect(mockEmailSend).toHaveBeenCalledTimes(1)
  })

  test('without a base path, routes live at /api/auth and errors go to /auth-error', () => {
    const options = loadBetterAuthOptions(undefined)
    expect(options.basePath).toBe('/api/auth')
    expect(options.onAPIError.errorURL).toBe('/auth-error')
  })

  test('under a base path, both carry it', () => {
    const options = loadBetterAuthOptions('/base')
    expect(options.basePath).toBe('/base/api/auth')
    expect(options.onAPIError.errorURL).toBe('/base/auth-error')
  })
})
