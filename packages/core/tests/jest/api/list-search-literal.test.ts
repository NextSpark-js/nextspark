/**
 * #464: the users, teams, members, media and superadmin lists search the term literally, like the entities API (#463):
 * `%`, `_` and the backslash are escaped in the bound pattern, every LIKE says ESCAPE, and a term over the cap is a
 * 400 SEARCH_TERM_TOO_LONG that never reaches the database.
 */
import { NextRequest } from 'next/server'

const authenticateRequest = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/api/auth/dual-auth'),
  authenticateRequest: (...args: unknown[]) => authenticateRequest(...args),
  resolveTeamContext: async () => 'team-1',
}))
const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: async () => true }))
jest.mock('@nextsparkjs/core/lib/media/storage/display', () => ({ withDisplayUrls: async (rows: unknown) => rows }))
jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({ getBillingGatewayOrNull: async () => null }))
const queryWithRLS = jest.fn()
const queryRows = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryWithRLS: (...args: unknown[]) => queryWithRLS(...args),
  queryRows: (...args: unknown[]) => queryRows(...args),
  query: (...args: unknown[]) => queryRows(...args),
  queryOneWithRLS: async () => ({ count: '0', total: '0' }),
}))

import { MAX_SEARCH_TERM_LENGTH } from '../../../src/lib/utils/like-pattern'
import { GET as users } from '../../../src/routes/api/v1/users/route'
import { GET as teams } from '../../../src/routes/api/v1/teams/route'
import { GET as members } from '../../../src/routes/api/v1/teams/[teamId]/members/route'
import { GET as media } from '../../../src/routes/api/v1/media/route'
import { GET as saUsers } from '../../../src/routes/api/superadmin/users/route'
import { GET as saTeams } from '../../../src/routes/api/superadmin/teams/route'
import { GET as saSubscriptions } from '../../../src/routes/api/superadmin/subscriptions/route'
import { TeamMemberService } from '../../../src/lib/services/team-member.service'

const url = (path: string, search: string) => new NextRequest(`http://localhost${path}?search=${encodeURIComponent(search)}`)
const ROUTES: Array<[string, (search: string) => Promise<Response>]> = [
  ['GET /api/v1/users', s => users(url('/api/v1/users', s), undefined as never)],
  ['GET /api/v1/teams', s => teams(url('/api/v1/teams', s), undefined as never)],
  ['GET /api/v1/teams/:teamId/members', s => members(url('/api/v1/teams/t-1/members', s), { params: Promise.resolve({ teamId: 't-1' }) } as never)],
  ['GET /api/v1/media', s => media(url('/api/v1/media', s), undefined as never)],
  ['GET /api/superadmin/users', s => saUsers(url('/api/superadmin/users', s), undefined as never)],
  ['GET /api/superadmin/teams', s => saTeams(url('/api/superadmin/teams', s), undefined as never)],
  ['GET /api/superadmin/subscriptions', s => saSubscriptions(url('/api/superadmin/subscriptions', s), undefined as never)],
]

/** Every bound-parameter list and SQL text the route sent to the database. */
const sent = () => [...queryWithRLS.mock.calls, ...queryRows.mock.calls] as Array<[string, unknown[]]>

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'sa', email: 'sa@x.test', role: 'superadmin' } })
  session.mockResolvedValue({ session: { id: 's' }, user: { id: 'sa', role: 'superadmin' } })
  queryWithRLS.mockResolvedValue([])
  queryRows.mockResolvedValue([])
})

describe.each(ROUTES)('%s — search (#464)', (_name, call) => {
  it('escapes %, _ and the backslash in the bound term and writes ESCAPE after every LIKE', async () => {
    const response = await call('50%_a\\b')

    expect(response.status).toBe(200)
    const searched = sent().filter(([sql]) => /I?LIKE \$\d+/.test(sql))
    expect(searched.length).toBeGreaterThan(0)
    for (const [sql, params] of searched) {
      const likes = sql.match(/I?LIKE \$\d+/g) ?? []
      expect(sql.match(/I?LIKE \$\d+ ESCAPE '\\'/g)).toHaveLength(likes.length)
      expect(params.some(p => typeof p === 'string' && p.includes('50\\%\\_a\\\\b'))).toBe(true)
      expect(params).not.toContain('%50%_a\\b%')
    }
  })

  it(`accepts ${MAX_SEARCH_TERM_LENGTH} characters and refuses one more with 400 SEARCH_TERM_TOO_LONG, never querying`, async () => {
    expect((await call('a'.repeat(MAX_SEARCH_TERM_LENGTH))).status).toBe(200)

    queryWithRLS.mockClear()
    queryRows.mockClear()
    const response = await call('a'.repeat(MAX_SEARCH_TERM_LENGTH + 1))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('SEARCH_TERM_TOO_LONG')
    expect(body.details).toEqual({ maxLength: MAX_SEARCH_TERM_LENGTH })
    expect(sent()).toHaveLength(0)
  })
})

describe('TeamMemberService.search (#464)', () => {
  it('escapes the term and writes ESCAPE after both comparisons', async () => {
    await TeamMemberService.search('t-1', '50%_A', 'u-1')

    const [sql, params] = queryWithRLS.mock.calls[0] as [string, unknown[]]
    expect(sql.match(/LIKE \$2 ESCAPE '\\'/g)).toHaveLength(2)
    expect(params[1]).toBe('%50\\%\\_a%')
  })
})
