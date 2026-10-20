/**
 * #324: the user.create `after` hook fails the sign-up when the team cannot be created, and removes the user it
 * just created, instead of leaving an account without a team.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

const { APIError } = jest.requireActual<{ APIError: new (...args: any[]) => Error & { status: string; body?: { code?: string } } }>('better-auth')
const mockBetterAuth = jest.fn(() => ({ api: { getSession: jest.fn() }, $Infer: {} }))
const mockQuery = jest.fn<(sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>()
const mockQueryOne = jest.fn<(sql: string, params: unknown[]) => Promise<unknown>>()
const mockCreate = jest.fn<(userId: string, name?: string) => Promise<{ id: string }>>()
const mockGetGlobal = jest.fn<() => Promise<unknown>>()
const mockAddToGlobal = jest.fn<(userId: string) => Promise<unknown>>()

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
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    isBootstrapDone: jest.fn(),
    create: (userId: string, name?: string) => mockCreate(userId, name),
    getGlobal: () => mockGetGlobal(),
  },
}))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { addToGlobal: (id: string) => mockAddToGlobal(id) } }))

type AfterHook = (user: Record<string, unknown>) => Promise<void>

function afterHook(mode: string) {
  mockBetterAuth.mockClear()
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/config/config-sync', () => {
      const actual = jest.requireActual<Record<string, any>>('@/core/lib/config/config-sync')
      return { ...actual, TEAMS_CONFIG: { ...actual.TEAMS_CONFIG, mode } }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/core/lib/auth')
  })
  const options = (mockBetterAuth.mock.calls[0] as unknown[])[0] as Record<string, any>
  return options.databaseHooks.user.create.after as AfterHook
}

const user = { id: 'user-1', email: 'new@example.test', name: 'New' }
const deletes = () => mockQuery.mock.calls.filter(([sql]) => sql.includes('DELETE FROM "users"'))

describe('lib/auth.ts user.create after hook (#324)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockQuery.mockReset().mockResolvedValue({ rows: [] })
    mockQueryOne.mockReset().mockResolvedValue(null)
    mockCreate.mockReset()
    mockGetGlobal.mockReset()
    mockAddToGlobal.mockReset()
  })

  test.each(['single-user', 'multi-tenant'])('%s: a failed team creation fails the sign-up and removes the user', async mode => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const error = await afterHook(mode)(user).then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(APIError)
    expect((error as InstanceType<typeof APIError>).body?.code).toBe('TEAM_CREATION_FAILED')
    expect(deletes()).toHaveLength(1)
    expect(deletes()[0][1]).toEqual(['user-1'])
    // the delete leaves a user that already has a team
    expect(deletes()[0][0]).toContain('NOT EXISTS (SELECT 1 FROM "team_members"')
    expect(deletes()[0][0]).toContain('NOT EXISTS (SELECT 1 FROM "teams" WHERE "ownerId"')
  })

  test('single-tenant: a failed join of the global team fails the sign-up too', async () => {
    mockGetGlobal.mockResolvedValue({ id: 'global' })
    mockAddToGlobal.mockRejectedValue(new Error('boom'))
    await expect(afterHook('single-tenant')(user)).rejects.toBeInstanceOf(APIError)
    expect(deletes()).toHaveLength(1)
  })

  test('the sign-up still fails when the compensating delete fails as well', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    mockQuery.mockRejectedValue(new Error('db down'))
    await expect(afterHook('multi-tenant')(user)).rejects.toBeInstanceOf(APIError)
  })

  test('a team created: the user stays', async () => {
    mockCreate.mockResolvedValue({ id: 'team-1' })
    await expect(afterHook('multi-tenant')(user)).resolves.toBeUndefined()
    expect(deletes()).toHaveLength(0)
  })

  test('an invitation flow (pending invitation) creates no team and keeps the user', async () => {
    mockQueryOne.mockResolvedValue({ id: 'inv-1' })
    await expect(afterHook('multi-tenant')(user)).resolves.toBeUndefined()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(deletes()).toHaveLength(0)
  })
})
