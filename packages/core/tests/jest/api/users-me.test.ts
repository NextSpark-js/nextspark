/**
 * /api/v1/users/me (#209): the signed-in user, for a session cookie, a bearer-presented API key and an
 * x-api-key. It is /api/v1/users/:id for the caller's own id, so these run the real route modules, the real
 * dual-auth and scope policy, and mock only the edges (session, key validation, database, rate limiter).
 */
const mockValidateApiKey = jest.fn()
jest.mock('@/core/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  getValidatedApiKey: () => null,
}))

const mockGetSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))

const mockQueryOne = jest.fn()
const mockQueryOneWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  apiKeyRateLimitResponse: () => null,
}))
// The next/server mock's Headers is a Map: skip the CORS header writes, keep everything else real
jest.mock('@/core/lib/api/helpers', () => ({
  ...jest.requireActual('@/core/lib/api/helpers'),
  addCorsHeaders: (response: unknown) => response,
}))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }))

import { NextRequest } from 'next/server'
import * as meRoute from '@/app/api/v1/users/me/route'
import * as idRoute from '@/app/api/v1/users/[id]/route'

type Init = { method?: string; headers?: Record<string, string>; body?: string }
const request = (path: string, init: Init = {}) => {
  const url = `http://localhost${path}`
  const req = new (NextRequest as unknown as { new (url: string, init?: Init): NextRequest })(url, init)
  ;(req as unknown as { nextUrl: URL }).nextUrl = new URL(url)
  return req
}
const json = (body: unknown) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const ROW = { id: 'u1', email: 'u1@x.test', name: 'U One', firstName: 'U', lastName: 'One', role: 'member' }
const SESSION = { cookie: 'better-auth.session_token=abc' }

const asSession = (role = 'member') => mockGetSession.mockResolvedValue({ user: { id: 'u1', email: 'u1@x.test', role, name: 'U One' }, session: { id: 's1' } })
const asKey = (scopes: string[], role = 'member') => {
  mockValidateApiKey.mockResolvedValue({ userId: 'u1', keyId: 'k1', scopes })
  mockQueryOne.mockResolvedValueOnce({ email: 'u1@x.test', role, name: 'U One' }).mockResolvedValueOnce({ teamId: 't1' })
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGetSession.mockResolvedValue(null)
  mockValidateApiKey.mockResolvedValue(null)
  mockQueryOne.mockResolvedValue(null)
  mockQueryOneWithRLS.mockResolvedValue(ROW)
  mockMutateWithRLS.mockResolvedValue({ rows: [ROW] })
})
afterEach(() => jest.restoreAllMocks())

const body = async (res: { json(): Promise<any> }) => (await res.json()) as any

describe('GET /api/v1/users/me', () => {
  it('answers the signed-in user for a session cookie', async () => {
    asSession()
    const res = await meRoute.GET(request('/api/v1/users/me', { headers: SESSION }))
    expect(res.status).toBe(200)
    expect((await body(res)).data.id).toBe('u1')
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.stringContaining('FROM "users"'), ['u1'], 'u1')
  })

  it('answers the cookie user when a junk Bearer comes with the cookie (what the mobile client used to send)', async () => {
    asSession()
    const res = await meRoute.GET(request('/api/v1/users/me', { headers: { ...SESSION, authorization: 'Bearer not-a-key' } }))
    expect(res.status).toBe(200)
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.any(String), ['u1'], 'u1')
  })

  it('answers a superadmin their own row, not the row "me"', async () => {
    asSession('superadmin')
    const res = await meRoute.GET(request('/api/v1/users/me', { headers: SESSION }))
    expect(res.status).toBe(200)
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.any(String), ['u1'], 'u1')
  })

  it.each([
    ['a bearer-presented API key', { authorization: 'Bearer nsk_test' }],
    ['an x-api-key', { 'x-api-key': 'nsk_test' }],
  ])('answers the key owner for %s with users:read', async (_name, headers) => {
    asKey(['users:read'])
    const res = await meRoute.GET(request('/api/v1/users/me', { headers }))
    expect(res.status).toBe(200)
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.any(String), ['u1'], 'u1')
  })

  it('refuses an API key without users:read', async () => {
    asKey(['tasks:read'])
    const res = await meRoute.GET(request('/api/v1/users/me', { headers: { authorization: 'Bearer nsk_test' } }))
    expect(res.status).toBe(403)
    expect((await body(res)).code).toBe('INSUFFICIENT_SCOPE')
    expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
  })

  it('answers 401 without credentials', async () => {
    const res = await meRoute.GET(request('/api/v1/users/me'))
    expect(res.status).toBe(401)
    expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
  })

  it('does not take "me" from an other user, whatever the id or email in the query', async () => {
    asSession()
    await meRoute.GET(request('/api/v1/users/me?id=u2', { headers: SESSION }))
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.any(String), ['u1'], 'u1')
  })
})

describe('PATCH /api/v1/users/me', () => {
  it('updates the caller with the /users/:id allowlist, for a session', async () => {
    asSession()
    const res = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', headers: { ...SESSION, ...json({}).headers }, body: json({ firstName: 'Ada' }).body }))
    expect(res.status).toBe(200)
    const [sql, values, rlsUser] = mockMutateWithRLS.mock.calls[0]
    expect(sql).toContain('UPDATE "users"')
    expect(values).toEqual(['Ada', 'u1'])
    expect(rlsUser).toBe('u1')
  })

  it('needs users:write on an API key', async () => {
    asKey(['users:read'])
    const res = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', headers: { authorization: 'Bearer nsk_test', ...json({}).headers }, body: json({ firstName: 'Ada' }).body }))
    expect(res.status).toBe(403)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()

    jest.clearAllMocks()
    mockQueryOneWithRLS.mockResolvedValue(ROW)
    mockMutateWithRLS.mockResolvedValue({ rows: [ROW] })
    asKey(['users:write'])
    const ok = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', headers: { 'x-api-key': 'nsk_test', ...json({}).headers }, body: json({ lastName: 'Lovelace' }).body }))
    expect(ok.status).toBe(200)
    expect(mockMutateWithRLS.mock.calls[0][1]).toEqual(['Lovelace', 'u1'])
  })

  it('refuses a role change from a member, through /me as through /users/:id', async () => {
    asSession()
    const res = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', headers: { ...SESSION, ...json({}).headers }, body: json({ role: 'superadmin' }).body }))
    expect(res.status).toBe(403)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  it('ignores fields outside the allowlist (email, name, image): nothing to update', async () => {
    asSession()
    const res = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', headers: { ...SESSION, ...json({}).headers }, body: json({ email: 'x@y.z', name: 'N', image: 'i.png', id: 'u2' }).body }))
    expect(res.status).toBe(400)
    expect((await body(res)).code).toBe('NO_FIELDS')
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  it('answers 401 without credentials', async () => {
    const res = await meRoute.PATCH(request('/api/v1/users/me', { method: 'PATCH', ...json({ firstName: 'Ada' }) }))
    expect(res.status).toBe(401)
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })
})

describe('the routes around /me', () => {
  it('/users/<another id> is still 403 for a member (session and key), and nothing is read', async () => {
    asSession()
    const res = await idRoute.GET(request('/api/v1/users/u2', { headers: SESSION }), { params: Promise.resolve({ id: 'u2' }) })
    expect(res.status).toBe(403)
    asKey(['users:read', 'users:write'])
    const key = await idRoute.PATCH(
      request('/api/v1/users/u2', { method: 'PATCH', headers: { authorization: 'Bearer nsk_test', ...json({}).headers }, body: json({ firstName: 'x' }).body }),
      { params: Promise.resolve({ id: 'u2' }) }
    )
    expect(key.status).toBe(403)
    expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  it('a superadmin still reads another user by id', async () => {
    asSession('superadmin')
    const res = await idRoute.GET(request('/api/v1/users/u2', { headers: SESSION }), { params: Promise.resolve({ id: 'u2' }) })
    expect(res.status).toBe(200)
    expect(mockQueryOneWithRLS).toHaveBeenCalledWith(expect.any(String), ['u2'], 'u1')
  })

  it('/me has no DELETE (deleting an account stays /users/:id, superadmin only)', () => {
    expect(Object.keys(meRoute).sort()).toEqual(['GET', 'OPTIONS', 'PATCH'])
  })
})
