import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'

const mockGet = jest.fn(async () => new Response('get-provider', { status: 200 }))
const mockPost = jest.fn(async () => new Response('post-provider', { status: 200 }))
const mockRateLimit = jest.fn(async () => ({ allowed: true, limit: 5, resetTime: 0 }))
const mockAuthConfig: any = {
  methods: ['email-otp', 'google'],
  providers: { google: { enabled: true } },
  emailAndPassword: { enabled: true },
  registration: { mode: 'open' },
}

jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: {} }))
jest.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({ GET: mockGet, POST: mockPost }),
}))
jest.mock('@nextsparkjs/core/lib/config', () => ({
  get AUTH_CONFIG() { return mockAuthConfig },
  TEAMS_CONFIG: { mode: 'multi-tenant' },
}))
jest.mock('@nextsparkjs/core/lib/teams/helpers', () => ({ isPublicSignupRestricted: () => false }))
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: { hasGlobal: jest.fn(async () => false) } }))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  handleCorsPreflightRequest: jest.fn(async () => new Response(null, { status: 200 })),
  addCorsHeaders: jest.fn(async (response: Response) => response),
  wrapAuthHandlerWithCors: jest.fn(async (handler: () => Promise<Response>) => handler()),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  checkDistributedRateLimit: mockRateLimit,
}))
jest.mock('@nextsparkjs/core/lib/auth-context', () => ({ withSignupContext: jest.fn((_value, fn) => fn()) }))
jest.mock('@nextsparkjs/core/lib/auth/security-notifications', () => ({
  dispatchSecurityNotificationsForRequest: jest.fn(async () => undefined),
}))
jest.mock('@nextsparkjs/core/lib/auth/verify-email-link', () => ({ verifyEmailPageUrl: jest.fn(() => null) }))
jest.mock('@nextsparkjs/core/lib/base-path', () => ({ withBasePathRequest: (request: Request) => request }))

import { GET, POST } from '@/app/api/auth/[...all]/route'

const ENV_KEYS = [
  'NODE_ENV',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

function setProductionEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  for (const key of ENV_KEYS) delete process.env[key]
  process.env.NODE_ENV = 'production'
  Object.assign(process.env, values)
}

function nextRequest(path: string, init?: RequestInit) {
  const req = new NextRequest(`https://example.com${path}`, init) as unknown as NextRequest & { clone?: () => NextRequest }
  req.clone = () => req
  return req
}

describe('shipped auth route runtime readiness integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockAuthConfig.methods = ['email-otp', 'google']
    mockAuthConfig.providers = { google: { enabled: true } }
    mockAuthConfig.emailAndPassword = { enabled: true }
    setProductionEnv()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  test('rejects missing runtime OTP configuration before invoking Better Auth', async () => {
    const response = await POST(nextRequest('/api/auth/email-otp/send-verification-otp', { method: 'POST' }))

    expect(response.status).toBe(503)
    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('invokes Better Auth when the requested provider is usable', async () => {
    setProductionEnv({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_1234567890abcdefghijklmnop',
      RESEND_FROM_EMAIL: 'auth@example.com',
    })

    const response = await POST(nextRequest('/api/auth/email-otp/send-verification-otp', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  test('blocks a policy-disabled Google request at the real route boundary', async () => {
    mockAuthConfig.providers = { google: { enabled: false } }
    setProductionEnv({
      GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-production-secret',
    })

    const response = await POST(nextRequest('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google' }),
    }))

    expect(response.status).toBe(503)
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('preserves direct password sign-in when the UI does not advertise it', async () => {
    mockAuthConfig.methods = ['google']

    const response = await POST(nextRequest('/api/auth/sign-in/email', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  test('serves public method availability without invoking Better Auth', async () => {
    setProductionEnv({
      GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-production-secret',
    })

    const response = await GET(nextRequest('/base/api/auth/readiness'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ready',
      availableMethods: ['google'],
      capabilities: { invitationPasswordSignup: true, passwordRecovery: false },
    })
    expect(mockGet).not.toHaveBeenCalled()
  })

  test.each([
    ['GET', '/api/auth/get-session'],
    ['POST', '/api/auth/sign-out'],
  ])('preserves %s %s for existing sessions', async (method, path) => {
    const response = method === 'GET'
      ? await GET(nextRequest(path))
      : await POST(nextRequest(path, { method }))

    expect(response.status).toBe(200)
    expect(method === 'GET' ? mockGet : mockPost).toHaveBeenCalledTimes(1)
  })
})
