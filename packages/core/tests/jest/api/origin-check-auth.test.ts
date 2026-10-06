/**
 * The write-origin check together with authentication, on a real route
 * (PATCH /api/v1/users/me) through the real withRateLimitTier, dual-auth and
 * scope policy. Only the edges are mocked: session lookup, key validation,
 * database. A write from an untrusted origin that presents an API key is
 * handled by the key alone; the session cookie it carries is not used.
 */
const mockValidateApiKey = jest.fn()
jest.mock('@/core/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
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
// The next/server mock's Headers is a Map: skip the CORS header writes, keep everything else real
jest.mock('@/core/lib/api/helpers', () => ({
  ...jest.requireActual('@/core/lib/api/helpers'),
  addCorsHeaders: (response: unknown) => response,
}))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }))

import { NextRequest } from 'next/server'
import * as meRoute from '@/app/api/v1/users/me/route'

const APP = 'https://app.example.com'
const FOREIGN = 'https://other.example'
const SESSION_COOKIE = 'better-auth.session_token=abc.def'
const KEY = `sk_test_${'b'.repeat(64)}`
const ROW = { id: 'u1', email: 'u1@x.test', name: 'U One', firstName: 'U', lastName: 'One', role: 'member' }

function patchMe(headers: Record<string, string>) {
  const url = `${APP}/api/v1/users/me`
  const body = JSON.stringify({ lastName: 'Lovelace' })
  const req = new (NextRequest as unknown as { new (url: string, init?: object): NextRequest })(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
  // The mock keeps the body privately; expose it as a real request does, so a copy of the request keeps it
  ;(req as unknown as { body: string }).body = body
  return meRoute.PATCH(req)
}

/** The session cookie's user is 'cookie-user'; an API key's user is 'u1'. */
function sessionFromCookie() {
  mockGetSession.mockImplementation(async ({ headers }: { headers: { get(name: string): string | null | undefined } }) =>
    /better-auth\.session_token=/.test(headers.get('cookie') ?? '')
      ? { user: { id: 'cookie-user', email: 'v@x.test', role: 'member', name: 'V' }, session: { id: 's1' } }
      : null
  )
}

const savedEnv = { app: process.env.NEXT_PUBLIC_APP_URL, rl: process.env.DISABLE_RATE_LIMITING }
beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP
  process.env.DISABLE_RATE_LIMITING = 'true'
})
afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = savedEnv.app
  if (savedEnv.rl === undefined) delete process.env.DISABLE_RATE_LIMITING
  else process.env.DISABLE_RATE_LIMITING = savedEnv.rl
})

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  sessionFromCookie()
  mockValidateApiKey.mockResolvedValue(null)
  mockQueryOneWithRLS.mockResolvedValue(ROW)
  mockMutateWithRLS.mockResolvedValue({ rows: [ROW] })
})

describe('origin check and authentication on PATCH /api/v1/users/me', () => {
  it('refuses the cookie with a Bearer value that is not an API key, from an untrusted origin', async () => {
    const res = await patchMe({ cookie: SESSION_COOKIE, origin: FOREIGN, authorization: 'Bearer junk' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('ORIGIN_NOT_ALLOWED')
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  it('answers 401 to an API-key-format Bearer that does not validate, without using the cookie', async () => {
    const res = await patchMe({ cookie: SESSION_COOKIE, origin: FOREIGN, authorization: `Bearer ${KEY}` })
    expect(res.status).toBe(401)
    expect(mockGetSession).toHaveBeenCalled()
    expect(await mockGetSession.mock.results[0].value).toBeNull()
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })

  it.each([
    ['Authorization: Bearer', { authorization: `Bearer ${KEY}` }],
    ['x-api-key', { 'x-api-key': KEY }],
  ])('accepts a valid API key (%s) from an untrusted origin, as the key user', async (_label, keyHeader) => {
    mockValidateApiKey.mockResolvedValue({ userId: 'u1', keyId: 'k1', scopes: ['users:write'] })
    mockQueryOne.mockResolvedValueOnce({ email: 'u1@x.test', role: 'member', name: 'U One' }).mockResolvedValueOnce({ teamId: 't1' })
    const res = await patchMe({ cookie: SESSION_COOKIE, origin: FOREIGN, ...keyHeader })
    expect(res.status).toBe(200)
    const [, values, rlsUser] = mockMutateWithRLS.mock.calls[0]
    expect(values).toEqual(['Lovelace', 'u1'])
    expect(rlsUser).toBe('u1')
  })

  it('accepts the cookie from the app origin', async () => {
    const res = await patchMe({ cookie: SESSION_COOKIE, origin: APP })
    expect(res.status).toBe(200)
    expect(mockMutateWithRLS.mock.calls[0][1]).toEqual(['Lovelace', 'cookie-user'])
  })

  it('accepts the cookie with a JSON body and no Origin or Referer (native clients)', async () => {
    const res = await patchMe({ cookie: SESSION_COOKIE })
    expect(res.status).toBe(200)
    expect(mockMutateWithRLS.mock.calls[0][1]).toEqual(['Lovelace', 'cookie-user'])
  })

  it('refuses the cookie with Origin: null and a JSON body', async () => {
    const res = await patchMe({ cookie: SESSION_COOKIE, origin: 'null' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('ORIGIN_NOT_ALLOWED')
    expect(mockMutateWithRLS).not.toHaveBeenCalled()
  })
})
