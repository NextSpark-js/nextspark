import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

const mockSignUpEmail = jest.fn()
const mockQueryOne = jest.fn()
const mockAuthConfig = { emailAndPassword: { enabled: false } }

jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: { api: { signUpEmail: mockSignUpEmail } } }))
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryOneWithRLS: mockQueryOne,
  mutateWithRLS: jest.fn(),
  getTransactionClient: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/config', () => ({
  get AUTH_CONFIG() { return mockAuthConfig },
  I18N_CONFIG: { defaultLocale: 'en' },
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: jest.fn((data: object, status = 200) => NextResponse.json(data, { status })),
  createApiError: jest.fn((message: string, status: number, _details: unknown, code: string) =>
    NextResponse.json({ error: message, code }, { status })),
  withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: jest.fn(async (response: NextResponse) => response),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/auth-context', () => ({ withSignupContext: jest.fn((_value, fn) => fn()) }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePath: (path: string) => path }))

import { POST } from '@/app/api/v1/auth/signup-with-invite/route'

function request() {
  return new NextRequest('https://example.com/api/v1/auth/signup-with-invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'invitee@example.com',
      password: 'CorrectHorse1!',
      inviteToken: 'synthetic-token',
    }),
  }) as unknown as NextRequest
}

describe('signup-with-invite password policy', () => {
  beforeEach(() => jest.clearAllMocks())

  test('rejects before reading invitations or invoking password signup when disabled', async () => {
    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Password authentication is unavailable',
      code: 'AUTH_METHOD_UNAVAILABLE',
    })
    expect(mockQueryOne).not.toHaveBeenCalled()
    expect(mockSignUpEmail).not.toHaveBeenCalled()
  })
})
