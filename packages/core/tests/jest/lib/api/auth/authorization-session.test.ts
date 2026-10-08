/**
 * Authorization reads skip Better Auth's cookie cache. With the cache, `getSession` answers from the signed
 * `session_data` cookie for up to 5 minutes, so the cookie pair copied before a sign-out kept working and a role
 * changed by an administrator kept its old value. dual-auth (every API route) and getAuthorizationSession (the
 * superadmin and devtools routes and area checks) ask with `disableCookieCache`, so the database answers: no
 * session row, no session.
 */

const mockGetSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))
jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn() }))
const mockQueryOne = jest.fn()
jest.mock('@/core/lib/db', () => ({ queryOne: (...args: unknown[]) => mockQueryOne(...args) }))
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }))

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { getAuthorizationSession } from '@/core/lib/auth/authorization-session'

const COOKIES = { cookie: '__Secure-better-auth.session_token=t; __Secure-better-auth.session_data=d' }
const request = () => new NextRequest('http://localhost/api/v1/users/me', { headers: COOKIES })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockQueryOne.mockResolvedValue({ teamId: 'team-1' })
})

describe('authenticateRequest (session)', () => {
  it('asks Better Auth with the cookie cache disabled', async () => {
    mockGetSession.mockResolvedValue({ session: { id: 's1' }, user: { id: 'u1', email: 'u@x', role: 'member' } })
    const result = await authenticateRequest(request(), { requiredScope: 'users:read' })
    expect(result.success).toBe(true)
    expect(mockGetSession).toHaveBeenCalledWith(expect.objectContaining({ query: { disableCookieCache: true } }))
  })

  it('a suspended account\'s session is not authenticated', async () => {
    mockGetSession.mockResolvedValue({ session: { id: 's1' }, user: { id: 'u1', email: 'u@x', role: 'suspended' } })
    expect((await authenticateRequest(request(), { requiredScope: 'users:read' })).success).toBe(false)
  })

  it('a signed-out session (no row any more) is not authenticated, whatever the cookies still carry', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await authenticateRequest(request(), { requiredScope: 'users:read' })
    expect(result.success).toBe(false)
  })
})

describe('getAuthorizationSession', () => {
  it('a suspended account\'s session is no session', async () => {
    mockGetSession.mockResolvedValue({ session: { id: 's1' }, user: { id: 'u1', role: 'suspended' } })
    expect(await getAuthorizationSession(new Headers(COOKIES))).toBeNull()
  })

  it('passes the request headers and disables the cookie cache', async () => {
    mockGetSession.mockResolvedValue(null)
    const headers = new Headers(COOKIES)
    expect(await getAuthorizationSession(headers)).toBeNull()
    expect(mockGetSession).toHaveBeenCalledWith({ headers, query: { disableCookieCache: true } })
  })
})
