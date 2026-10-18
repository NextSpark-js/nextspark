/**
 * lib/auth.ts database hooks reject a registration-policy violation with a
 * Better Auth APIError (403 + code). A plain Error thrown there reaches Better
 * Auth's router as an unknown error and the client got an empty 500.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

// jest.config maps `better-auth` to tests/jest/__mocks__/better-auth.js, whose
// APIError has the real constructor shape. The production run (S140 evidence)
// shows the real one answering 403 + code.
const { APIError } = jest.requireActual<{ APIError: new (...args: any[]) => Error & { status: string; body?: { code?: string; message?: string } } }>('better-auth')
const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockQuery = jest.fn<(sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>()
const mockBootstrapDone = jest.fn<() => Promise<boolean>>()
const mockQueryOne = jest.fn<(sql: string, params: unknown[]) => Promise<unknown>>()

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
  APIError,
}))
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn(() => ({ id: 'email-otp' })) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: jest.fn(() => ({ id: 'next-cookies' })) }))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: mockQuery, on: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: (sql: string, params: unknown[]) => mockQueryOne(sql, params),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({ EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { isBootstrapDone: () => mockBootstrapDone() } }))

type Hook = (data: Record<string, unknown>, ctx?: unknown) => Promise<unknown>

function hooksWith(registration: { mode: string; allowedDomains?: string[] }) {
  mockBetterAuth.mockClear()
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/config/config-sync', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config/config-sync')
      return { ...actual, AUTH_CONFIG: { ...actual.AUTH_CONFIG, registration } }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  const options = (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
  return {
    userCreate: options.databaseHooks.user.create.before as Hook,
    sessionCreate: options.databaseHooks.session.create.before as Hook,
  }
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(APIError)
  const apiError = error as InstanceType<typeof APIError>
  return { status: apiError.status, code: apiError.body?.code, message: apiError.body?.message }
}

const domainOpen = { mode: 'domain-open', allowedDomains: ['nextspark.dev'] }

describe('lib/auth.ts registration hooks', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockQuery.mockReset()
    mockBootstrapDone.mockReset()
    mockQueryOne.mockReset()
  })

  test('user.create: a domain outside allowedDomains is a 403 DOMAIN_NOT_ALLOWED, and the log has no full email', async () => {
    const { userCreate } = hooksWith(domainOpen)
    const result = await rejection(userCreate({ email: 'someone@other.example' }))
    expect(result).toEqual({
      status: 'FORBIDDEN',
      code: 'DOMAIN_NOT_ALLOWED',
      message: "This email's domain can't sign in here. Use your organization's email.",
    })
    const logged = (console.log as jest.Mock).mock.calls.flat().join(' ')
    expect(logged).toContain('other.example')
    expect(logged).not.toContain('someone@')
  })

  test('user.create: domain-restricted rejects the same way', async () => {
    const { userCreate } = hooksWith({ mode: 'domain-restricted', allowedDomains: ['nextspark.dev'] })
    expect((await rejection(userCreate({ email: 'a@other.example' }))).code).toBe('DOMAIN_NOT_ALLOWED')
  })

  test('user.create: on an OAuth callback the message is the code (Better Auth puts it in ?error=)', async () => {
    const { userCreate } = hooksWith(domainOpen)
    const result = await rejection(userCreate({ email: 'a@other.example' }, { path: '/callback/google' }))
    expect(result).toEqual({ status: 'FORBIDDEN', code: 'DOMAIN_NOT_ALLOWED', message: 'DOMAIN_NOT_ALLOWED' })
  })

  test('user.create: an allowed domain passes, in any letter case', async () => {
    const { userCreate } = hooksWith(domainOpen)
    const user = { email: 'someone@NextSpark.dev' }
    await expect(userCreate(user)).resolves.toBe(user)
  })

  test('user.create: an empty allowedDomains allows every domain', async () => {
    const { userCreate } = hooksWith({ mode: 'domain-open', allowedDomains: [] })
    const user = { email: 'someone@other.example' }
    await expect(userCreate(user)).resolves.toBe(user)
  })

  test('user.create: open mode ignores allowedDomains', async () => {
    const { userCreate } = hooksWith({ mode: 'open', allowedDomains: ['nextspark.dev'] })
    const user = { email: 'someone@other.example' }
    await expect(userCreate(user)).resolves.toBe(user)
  })

  test('user.create: invitation-only after the bootstrap is a 403 SIGNUP_RESTRICTED', async () => {
    mockBootstrapDone.mockResolvedValue(true)
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    const result = await rejection(userCreate({ email: 'someone@other.example' }))
    expect(result.status).toBe('FORBIDDEN')
    expect(result.code).toBe('SIGNUP_RESTRICTED')
  })

  test('user.create: invitation-only lets the first user in', async () => {
    mockBootstrapDone.mockResolvedValue(false)
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    const user = { email: 'first@other.example' }
    await expect(userCreate(user)).resolves.toBe(user)
  })

  test('user.create: invitation-only lets in a verified address with a pending invitation', async () => {
    mockBootstrapDone.mockResolvedValue(true)
    mockQueryOne.mockResolvedValue({ id: 'inv-1' })
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    const user = { email: 'invited@other.example', emailVerified: true }
    await expect(userCreate(user)).resolves.toBe(user)
    expect(mockQueryOne.mock.calls[0]).toEqual([expect.stringContaining("status = 'pending'"), ['invited@other.example']])
  })

  test('user.create: invitation-only refuses an unverified address even with a pending invitation', async () => {
    mockBootstrapDone.mockResolvedValue(true)
    mockQueryOne.mockResolvedValue({ id: 'inv-1' })
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    for (const user of [{ email: 'invited@other.example', emailVerified: false }, { email: 'invited@other.example' }]) {
      const result = await rejection(userCreate(user))
      expect(result.code).toBe('SIGNUP_RESTRICTED')
    }
  })

  // The gates are one hook for every provider (#279): a GitHub, Microsoft or Apple callback goes through the same checks as Google's
  test('user.create: a non-Google OAuth callback meets the same registration gates', async () => {
    mockBootstrapDone.mockResolvedValue(true)
    mockQueryOne.mockResolvedValue(null)
    const invitationOnly = hooksWith({ mode: 'invitation-only' })
    for (const id of ['github', 'microsoft', 'apple', 'discord']) {
      const result = await rejection(invitationOnly.userCreate({ email: 'stranger@other.example', emailVerified: true }, { path: '/callback/:id', params: { id } }))
      expect(result).toEqual({ status: 'FORBIDDEN', code: 'SIGNUP_RESTRICTED', message: 'SIGNUP_RESTRICTED' })
    }
    const domains = hooksWith(domainOpen)
    const result = await rejection(domains.userCreate({ email: 'a@other.example', emailVerified: true }, { path: '/callback/:id', params: { id: 'github' } }))
    expect(result).toEqual({ status: 'FORBIDDEN', code: 'DOMAIN_NOT_ALLOWED', message: 'DOMAIN_NOT_ALLOWED' })
  })

  test('user.create: a social sign-up from an address the provider has not verified is refused, except Google as before', async () => {
    const { userCreate } = hooksWith({ mode: 'open' })
    for (const ctx of [
      { path: '/callback/:id', params: { id: 'github' } },
      { path: '/callback/microsoft' },
      // an id token from a native app
      { path: '/sign-in/social', body: { provider: 'apple', idToken: { token: 't' } } },
    ]) {
      for (const user of [{ email: 'a@other.example', emailVerified: false }, { email: 'a@other.example' }]) {
        const result = await rejection(userCreate(user, ctx))
        expect(result.code).toBe('SOCIAL_EMAIL_UNVERIFIED')
      }
      const verified = { email: 'a@other.example', emailVerified: true }
      await expect(userCreate(verified, ctx)).resolves.toBe(verified)
    }
    expect((await rejection(userCreate({ email: 'a@other.example' }, { path: '/callback/:id', params: { id: 'github' } }))).message).toBe('SOCIAL_EMAIL_UNVERIFIED')
    // Google keeps its behaviour, and a sign-up that is not social is not concerned
    const google = { email: 'a@other.example', emailVerified: false }
    await expect(userCreate(google, { path: '/callback/:id', params: { id: 'google' } })).resolves.toBe(google)
    const password = { email: 'a@other.example', emailVerified: false }
    await expect(userCreate(password, { path: '/sign-up/email' })).resolves.toBe(password)
  })

  test('session.create: an existing user outside allowedDomains is a 403 DOMAIN_NOT_ALLOWED', async () => {
    mockQuery.mockImplementation(async (sql) =>
      ({ rows: [sql.includes('SELECT role') ? { role: 'member' } : { email: 'old@other.example' }] }))
    const { sessionCreate } = hooksWith(domainOpen)
    const result = await rejection(sessionCreate({ userId: 'u1' }))
    expect(result.status).toBe('FORBIDDEN')
    expect(result.code).toBe('DOMAIN_NOT_ALLOWED')
  })

  test('session.create: an allowed domain gets its session', async () => {
    mockQuery.mockImplementation(async (sql) =>
      ({ rows: [sql.includes('SELECT role') ? { role: 'member' } : { email: 'me@nextspark.dev' }] }))
    const { sessionCreate } = hooksWith(domainOpen)
    const session = { userId: 'u1' }
    await expect(sessionCreate(session)).resolves.toBe(session)
  })
})
