import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  getPublicAuthReadiness,
  getRuntimeAuthReadiness,
  withAuthRequestReadiness,
} from '@/core/lib/auth/runtime-readiness'

const validEmail = {
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_1234567890abcdefghijklmnop',
  RESEND_FROM_EMAIL: 'auth@example.com',
}
const validGoogle = {
  GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-production-secret',
}
const production = { NODE_ENV: 'production' }

const request = (path: string, init?: RequestInit) =>
  new Request(`https://example.com${path}`, init)

const okHandler = jest.fn(async () => new Response('provider-called', { status: 200 }))

const originalError = console.error

beforeEach(() => {
  console.error = jest.fn()
})

afterEach(() => {
  okHandler.mockClear()
  console.error = originalError
})

describe('runtime auth readiness adapter', () => {
  test('supplies runtime environment and resolved config to the pure evaluator', () => {
    const ready = getRuntimeAuthReadiness({
      authConfig: { methods: ['email-otp'] },
      env: { ...production, ...validEmail },
    })
    const missingAtRuntime = getRuntimeAuthReadiness({
      authConfig: { methods: ['google'] },
      env: production,
    })

    expect(ready.outcome).toBe('ready')
    expect(ready.availableMethods).toEqual(['email-otp'])
    expect(missingAtRuntime.outcome).toBe('invalid')
    expect(missingAtRuntime.deferredMethods).toEqual([])
  })

  test('an OAuth-only project ignores a bad unused email provider', () => {
    const result = getRuntimeAuthReadiness({
      authConfig: { methods: ['google'] },
      env: {
        ...production,
        ...validGoogle,
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'bad-unused-key',
        RESEND_FROM_EMAIL: 'bad-unused-sender',
      },
    })

    expect(result.outcome).toBe('ready')
    expect(result.availableMethods).toEqual(['google'])
    expect(result.diagnostics).toEqual([])
  })

  test('public readiness exposes methods and status but no credential diagnostics or values', () => {
    const secret = 'GOCSPX-do-not-leak-this-value'
    const result = getPublicAuthReadiness({
      authConfig: { methods: ['email-otp', 'google'] },
      env: {
        ...production,
        ...validEmail,
        GOOGLE_CLIENT_ID: 'bad-client-id',
        GOOGLE_CLIENT_SECRET: secret,
      },
    })

    expect(result).toEqual({
      status: 'ready',
      availableMethods: ['email-otp'],
      capabilities: { invitationPasswordSignup: true, passwordRecovery: true },
    })
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain('GOOGLE_CLIENT_ID_MALFORMED')
  })
})

describe('public auth capabilities', () => {
  test('passwordless default keeps invitation registration and recovery when the backend and email are ready', () => {
    const result = getPublicAuthReadiness({
      authConfig: { methods: ['email-otp', 'google'] },
      env: { ...production, ...validEmail },
    })

    expect(result.availableMethods).not.toContain('email-password')
    expect(result.capabilities).toEqual({ invitationPasswordSignup: true, passwordRecovery: true })
  })

  test('recovery needs email delivery while invitation registration follows only the backend switch', () => {
    const result = getPublicAuthReadiness({
      authConfig: { methods: ['email-otp', 'google'] },
      env: { ...production, ...validGoogle },
    })

    expect(result.status).toBe('ready')
    expect(result.capabilities).toEqual({ invitationPasswordSignup: true, passwordRecovery: false })
  })

  test('a disabled password backend removes both capabilities even when the UI lists email-password', () => {
    const result = getPublicAuthReadiness({
      authConfig: { methods: ['email-password', 'email-otp'], emailAndPassword: { enabled: false } },
      env: { ...production, ...validEmail },
    })

    expect(result.capabilities).toEqual({ invitationPasswordSignup: false, passwordRecovery: false })
  })

  test('capabilities carry no credential values', () => {
    const result = getPublicAuthReadiness({
      authConfig: { methods: ['email-otp'] },
      env: { ...production, ...validEmail },
    })

    expect(Object.keys(result).sort()).toEqual(['availableMethods', 'capabilities', 'status'])
    expect(JSON.stringify(result)).not.toContain(validEmail.RESEND_API_KEY)
    expect(JSON.stringify(result)).not.toContain(validEmail.RESEND_FROM_EMAIL)
  })
})

describe('auth request readiness wrapper', () => {
  test('invokes OTP provider handling when production email is configured', async () => {
    const response = await withAuthRequestReadiness(
      request('/api/auth/email-otp/send-verification-otp', { method: 'POST' }),
      okHandler,
      { authConfig: { methods: ['email-otp'] }, env: { ...production, ...validEmail } },
    )

    expect(await response.text()).toBe('provider-called')
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test('allows Google in an OAuth-only project even when unused email settings are bad', async () => {
    const response = await withAuthRequestReadiness(
      request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      }),
      okHandler,
      {
        authConfig: { methods: ['google'], providers: { google: { enabled: true } } },
        env: { ...production, ...validGoogle, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'bad' },
      },
    )

    expect(response.status).toBe(200)
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test('blocks a missing runtime provider before the provider handler and leaks no secret', async () => {
    const error = jest.fn()
    console.error = error
    const secret = 'GOCSPX-secret-that-must-not-appear'
    const response = await withAuthRequestReadiness(
      request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      }),
      okHandler,
      {
        authConfig: { methods: ['google'] },
        env: {
          ...production,
          GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: secret.slice(0, 4),
        },
      },
    )
    const body = await response.json()
    const serializedLog = JSON.stringify(error.mock.calls)

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: 'Authentication method unavailable',
      code: 'AUTH_METHOD_UNAVAILABLE',
      method: 'google',
    })
    expect(okHandler).not.toHaveBeenCalled()
    expect(serializedLog).toContain('GOOGLE_CLIENT_SECRET_MALFORMED')
    expect(serializedLog).not.toContain(secret.slice(0, 4))
  })

  test.each([
    ['/api/auth/sign-in/social', { provider: 'google' }, { methods: ['google'] as const, providers: { google: { enabled: false } } }],
    ['/api/auth/sign-in/email', { email: 'a@example.com', password: 'Password1!' }, { methods: ['email-password'] as const, emailAndPassword: { enabled: false } }],
  ])('blocks policy-disabled direct request %s', async (path, body, authConfig) => {
    const response = await withAuthRequestReadiness(
      request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      okHandler,
      { authConfig, env: { ...production, ...validEmail, ...validGoogle } },
    )

    expect(response.status).toBe(503)
    expect(okHandler).not.toHaveBeenCalled()
  })

  test('does not use UI method intent as a backend switch for a configured OTP endpoint', async () => {
    const response = await withAuthRequestReadiness(
      request('/api/auth/email-otp/send-verification-otp', { method: 'POST' }),
      okHandler,
      {
        authConfig: { methods: ['google'] },
        env: { ...production, ...validEmail },
      },
    )

    expect(response.status).toBe(200)
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test('keeps authenticated change-email available when password login is disabled but email works', async () => {
    const response = await withAuthRequestReadiness(
      request('/api/auth/change-email', { method: 'POST' }),
      okHandler,
      {
        authConfig: { methods: ['email-otp'], emailAndPassword: { enabled: false } },
        env: { ...production, ...validEmail },
      },
    )

    expect(response.status).toBe(200)
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test('preserves password API compatibility when UI methods do not advertise password', async () => {
    const response = await withAuthRequestReadiness(
      request('/api/auth/sign-in/email', { method: 'POST' }),
      okHandler,
      { authConfig: { methods: ['google'], emailAndPassword: { enabled: true } }, env: production },
    )

    expect(response.status).toBe(200)
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['GET', '/api/auth/get-session'],
    ['POST', '/api/auth/sign-out'],
    ['GET', '/base/api/auth/get-session'],
    ['POST', '/base/api/auth/sign-out'],
  ])('preserves %s %s when no login provider is available', async (method, path) => {
    const response = await withAuthRequestReadiness(
      request(path, { method }),
      okHandler,
      { authConfig: { methods: ['email-otp', 'google'] }, env: production },
    )

    expect(response.status).toBe(200)
    expect(okHandler).toHaveBeenCalledTimes(1)
  })

  test('serves safe public availability under a basePath without invoking Better Auth', async () => {
    const response = await withAuthRequestReadiness(
      request('/base/api/auth/readiness'),
      okHandler,
      { authConfig: { methods: ['email-otp', 'google'] }, env: { ...production, ...validGoogle } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ready',
      availableMethods: ['google'],
      capabilities: { invitationPasswordSignup: true, passwordRecovery: false },
    })
    expect(okHandler).not.toHaveBeenCalled()
  })

  test('allows development console OTP and does not log-deliver OTP in production', async () => {
    const developmentResponse = await withAuthRequestReadiness(
      request('/api/auth/email-otp/send-verification-otp', { method: 'POST' }),
      okHandler,
      { authConfig: { methods: ['email-otp'] }, env: { NODE_ENV: 'development', EMAIL_PROVIDER: 'console' } },
    )
    okHandler.mockClear()
    const productionResponse = await withAuthRequestReadiness(
      request('/api/auth/email-otp/send-verification-otp', { method: 'POST' }),
      okHandler,
      { authConfig: { methods: ['email-otp'] }, env: { NODE_ENV: 'production', EMAIL_PROVIDER: 'console' } },
    )

    expect(developmentResponse.status).toBe(200)
    expect(productionResponse.status).toBe(503)
    expect(okHandler).not.toHaveBeenCalled()
  })
})
