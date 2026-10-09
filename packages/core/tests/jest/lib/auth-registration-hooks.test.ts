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
const mockGetGlobal = jest.fn<() => Promise<unknown>>()

jest.mock('better-auth', () => ({
  betterAuth: (...args: unknown[]) => mockBetterAuth(...(args as [])),
  APIError,
}))
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn(() => ({ id: 'email-otp' })) }))
jest.mock('better-auth/next-js', () => ({ nextCookies: jest.fn(() => ({ id: 'next-cookies' })) }))
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: mockQuery, on: jest.fn() })) }))
jest.mock('@/core/lib/db', () => ({
  queryOne: jest.fn(),
  parseSSLConfig: jest.fn(() => false),
  stripSSLParams: jest.fn((url: string) => url),
}))
jest.mock('@/core/lib/email', () => ({ EmailFactory: { create: jest.fn(() => ({ send: jest.fn() })) } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getGlobal: () => mockGetGlobal() } }))

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
    mockGetGlobal.mockReset()
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

  test('user.create: invitation-only with a team already there is a 403 SIGNUP_RESTRICTED', async () => {
    mockGetGlobal.mockResolvedValue({ id: 'team-1' })
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    const result = await rejection(userCreate({ email: 'someone@other.example' }))
    expect(result.status).toBe('FORBIDDEN')
    expect(result.code).toBe('SIGNUP_RESTRICTED')
  })

  test('user.create: invitation-only lets the first user in', async () => {
    mockGetGlobal.mockResolvedValue(null)
    const { userCreate } = hooksWith({ mode: 'invitation-only' })
    const user = { email: 'first@other.example' }
    await expect(userCreate(user)).resolves.toBe(user)
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
