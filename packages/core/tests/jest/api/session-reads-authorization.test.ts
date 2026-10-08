/**
 * The user routes (profile, delete-account, plan-flags) and the handlers of generateEntityAPI read the session with
 * getAuthorizationSession: from the database, past Better Auth's cookie cache, so a cookie pair copied before a
 * sign-out (or the session of an account suspended since) gets 401 and nothing is read or written.
 */
import { NextRequest } from 'next/server'

const getAuthorizationSession = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: (headers: Headers) => getAuthorizationSession(headers),
}))
const signOut = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: { api: { signOut: (...a: unknown[]) => signOut(...a) } } }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const write = jest.fn()
const dbMock = () => ({
  queryOneWithRLS: (...a: unknown[]) => write('queryOneWithRLS', ...a),
  mutateWithRLS: (...a: unknown[]) => write('mutateWithRLS', ...a),
  queryOne: (...a: unknown[]) => write('queryOne', ...a),
  queryWithRLS: (...a: unknown[]) => write('queryWithRLS', ...a),
})
jest.mock('@nextsparkjs/core/lib/db', () => dbMock())
jest.mock('@/core/lib/db', () => dbMock())
jest.mock('@nextsparkjs/core/lib/services', () => ({ UserService: { anonymize: (...a: unknown[]) => write('anonymize', ...a) } }))
jest.mock('@nextsparkjs/core/lib/user-data', () => ({
  getUserPlanAndFlags: (...a: unknown[]) => write('getUserPlanAndFlags', ...a),
  updateUserPlan: (...a: unknown[]) => write('updateUserPlan', ...a),
  updateUserFlags: (...a: unknown[]) => write('updateUserFlags', ...a),
}))
jest.mock('@/core/lib/entities/registry', () => ({
  getEntityConfig: () => ({ slug: 'notes', tableName: 'notes', fields: [], access: { api: true } }),
}))

import * as profile from '../../../src/routes/api/user/profile/route'
import * as deleteAccount from '../../../src/routes/api/user/delete-account/route'
import * as planFlags from '../../../src/routes/api/user/plan-flags/route'
import { generateEntityAPI } from '@/core/lib/entities/api-generator'

const COOKIES = { cookie: '__Secure-better-auth.session_token=t; __Secure-better-auth.session_data=d' }
const req = (method: string, path: string, body?: unknown) =>
  new NextRequest(`http://localhost${path}`, { method, headers: { ...COOKIES, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  // The database has no session for these cookies any more (signed out, or the account was suspended)
  getAuthorizationSession.mockResolvedValue(null)
})

describe('user routes', () => {
  it.each([
    ['GET /api/user/profile', () => profile.GET(req('GET', '/api/user/profile'), undefined as never)],
    ['PATCH /api/user/profile', () => profile.PATCH(req('PATCH', '/api/user/profile', { firstName: 'x' }), undefined as never)],
    ['DELETE /api/user/delete-account', () => deleteAccount.DELETE(req('DELETE', '/api/user/delete-account'), undefined as never)],
    ['GET /api/user/plan-flags', () => planFlags.GET(req('GET', '/api/user/plan-flags?userId=u1'), undefined as never)],
    ['PATCH /api/user/plan-flags', () => planFlags.PATCH(req('PATCH', '/api/user/plan-flags', { userId: 'u1', plan: 'pro' }), undefined as never)],
  ])('%s answers 401 for a session the database no longer has, and writes nothing', async (_name, call) => {
    const response = await call()
    expect(response.status).toBe(401)
    expect(getAuthorizationSession.mock.calls[0][0].get('cookie')).toBe(COOKIES.cookie)
    expect(write).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })
})

describe('generateEntityAPI handlers', () => {
  const api = generateEntityAPI('notes') as unknown as
    Record<'GET' | 'POST' | 'PATCH' | 'DELETE', (request: NextRequest, context?: unknown) => Promise<Response>>

  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)('%s answers 401 for a session the database no longer has', async method => {
    const response = await api[method](req(method, '/api/v1/notes/n1', method === 'POST' || method === 'PATCH' ? { title: 'x' } : undefined), { params: { id: 'n1' } })
    expect(response.status).toBe(401)
    expect(getAuthorizationSession).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
  })
})
