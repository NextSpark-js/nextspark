import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'

const mockHandler = jest.fn()
const mockFindUserByEmail = jest.fn()
const mockCreateUser = jest.fn()
const mockQueryOne = jest.fn()
const mockMutate = jest.fn()
const mockTx = { query: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
const mockAuthConfig: { methods: string[]; emailAndPassword: { enabled?: boolean }; registration?: Record<string, unknown> } = {
  methods: ['email-otp', 'google'],
  emailAndPassword: { enabled: false },
}

jest.mock('@nextsparkjs/core/lib/auth', () => ({
  auth: {
    handler: mockHandler,
    $context: Promise.resolve({ internalAdapter: { findUserByEmail: mockFindUserByEmail, createUser: mockCreateUser } }),
  },
}))
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryOneWithRLS: mockQueryOne,
  mutateWithRLS: mockMutate,
  getTransactionClient: jest.fn(async () => mockTx),
}))
jest.mock('@nextsparkjs/core/lib/config', () => ({
  get AUTH_CONFIG() { return mockAuthConfig },
  I18N_CONFIG: { defaultLocale: 'en' },
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: jest.fn((data: object, _meta: unknown, status = 200) => NextResponse.json({ data }, { status })),
  createApiError: jest.fn((message: string, status: number, _details: unknown, code: string) =>
    NextResponse.json({ error: message, code }, { status })),
  withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: jest.fn(async (response: NextResponse) => response),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/auth-context', () => ({ withSignupContext: jest.fn((_value, fn: () => unknown) => fn()) }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePath: (path: string) => path }))

import { POST } from '@/app/api/v1/auth/signup-with-invite/route'

const invitation = {
  id: 'inv-1',
  teamId: 'team-1',
  email: 'invitee@example.com',
  role: 'member',
  invitedBy: 'owner-1',
  status: 'pending',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}

function request(body: Record<string, unknown>) {
  return new NextRequest('https://example.com/api/v1/auth/signup-with-invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invitee@example.com', inviteToken: 'synthetic-token', ...body }),
  }) as unknown as NextRequest
}

describe('signup-with-invite password policy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQueryOne.mockResolvedValue(invitation as never)
    mockTx.query.mockResolvedValue([{ id: 'member-1' }] as never)
    mockFindUserByEmail.mockResolvedValue(null as never)
    mockCreateUser.mockResolvedValue({ id: 'user-1' } as never)
  })

  test('with password login off it creates an OTP-only account and accepts the invitation', async () => {
    mockAuthConfig.emailAndPassword = { enabled: false }

    const response = await POST(request({ password: 'CorrectHorse1!', firstName: 'Ana' }))

    expect(response.status).toBe(201)
    expect(mockHandler).not.toHaveBeenCalled()
    expect(mockCreateUser).toHaveBeenCalledTimes(1)
    const created = mockCreateUser.mock.calls[0][0] as Record<string, unknown>
    expect(created).toMatchObject({ email: 'invitee@example.com', emailVerified: true, firstName: 'Ana' })
    expect(created).not.toHaveProperty('password')
    expect(mockTx.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "team_members"'), ['team-1', 'user-1', 'member', 'owner-1'])
    expect(mockTx.commit).toHaveBeenCalled()
  })

  test('with password login off a password is not required, and an existing account is refused', async () => {
    mockAuthConfig.emailAndPassword = { enabled: false }
    mockFindUserByEmail.mockResolvedValue({ id: 'existing' } as never)

    const response = await POST(request({}))

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'USER_ALREADY_EXISTS' })
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  test('with password login on it signs up through Better Auth with the password', async () => {
    mockAuthConfig.emailAndPassword = { enabled: true }
    mockHandler.mockResolvedValue(Response.json({ user: { id: 'user-2' } }) as never)

    const missing = await POST(request({}))
    expect(missing.status).toBe(400)

    const response = await POST(request({ password: 'CorrectHorse1!' }))

    expect(response.status).toBe(201)
    expect(mockCreateUser).not.toHaveBeenCalled()
    const signUp = mockHandler.mock.calls[0][0] as Request
    expect(new URL(signUp.url).pathname).toBe('/api/auth/sign-up/email')
    expect(await signUp.json()).toMatchObject({ email: 'invitee@example.com', password: 'CorrectHorse1!' })
  })

  describe('refusals while creating the OTP-only account', () => {
    beforeEach(() => {
      mockAuthConfig.emailAndPassword = { enabled: false }
      mockAuthConfig.registration = { mode: 'domain-restricted', allowedDomains: ['corp.test'] }
    })
    afterEach(() => { delete mockAuthConfig.registration })

    test('a domain-restricted refusal from the registration hook is a 403 with its code', async () => {
      // The message the user.create.before hook in lib/auth throws for a domain outside allowedDomains
      mockCreateUser.mockRejectedValue(new Error('DOMAIN_NOT_ALLOWED: Email domain not authorized. Please use an email from: corp.test') as never)

      const response = await POST(request({}))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Email domain not authorized. Please use an email from: corp.test',
        code: 'DOMAIN_NOT_ALLOWED',
      })
      expect(mockTx.query).not.toHaveBeenCalled()
    })

    test('an invitation-only refusal is a 403 SIGNUP_RESTRICTED', async () => {
      mockCreateUser.mockRejectedValue(new Error('SIGNUP_RESTRICTED: Registration requires an invitation. Contact an administrator.') as never)

      const response = await POST(request({}))

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'SIGNUP_RESTRICTED' })
    })

    test('the same email created concurrently is a 409', async () => {
      mockCreateUser.mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), { code: '23505' }) as never)

      const response = await POST(request({}))

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'USER_ALREADY_EXISTS' })
    })

    test('a hook that declines the account (no user) is a 403 SIGNUP_FAILED', async () => {
      mockCreateUser.mockResolvedValue(null as never)

      const response = await POST(request({}))

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'SIGNUP_FAILED' })
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })
})
