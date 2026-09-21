/**
 * lib/auth.ts creates the email provider inside `sendVerificationEmail`. A
 * synchronous EmailFactory.create() failure (e.g. resend without an API key)
 * must surface as a rejected promise, which Better Auth's background signup
 * send catches and logs, not as a synchronous throw that fails the request.
 */
import { describe, test, expect, jest } from '@jest/globals'

const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockCreate = jest.fn(() => {
  throw new Error('Email provider is not configured')
})

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
}))
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn(() => ({ id: 'email-otp' })) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: jest.fn(() => ({ id: 'next-cookies' })) }))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({
  EmailFactory: { create: () => mockCreate() },
}))

function loadBetterAuthOptions(): Record<string, any> {
  mockBetterAuth.mockClear()
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  expect(mockBetterAuth).toHaveBeenCalledTimes(1)
  return (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
}

describe('lib/auth.ts sendVerificationEmail', () => {
  test('turns a synchronous EmailFactory failure into a rejected promise without logging the token', async () => {
    const logged: unknown[][] = []
    const spies = (['log', 'info', 'warn', 'error'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args) }),
    )
    try {
      const options = loadBetterAuthOptions()
      const token = 'synthetic-verification-token-9f3a'
      mockCreate.mockClear()

      let result: unknown
      expect(() => {
        result = options.emailVerification.sendVerificationEmail({
          user: { id: 'user-1', email: 'invitee@example.com', firstName: 'Ada' },
          url: `https://example.com/api/auth/verify-email?token=${token}`,
          token,
        })
      }).not.toThrow()

      expect(result).toBeInstanceOf(Promise)
      await expect(result).rejects.toThrow('Email provider is not configured')
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(logged)).not.toContain(token)
    } finally {
      spies.forEach((spy) => spy.mockRestore())
    }
  })
})
