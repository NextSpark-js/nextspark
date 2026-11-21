/**
 * GET /api/superadmin/users: the status filter tells the account (active, suspended) from the email (unverified), the
 * role filter matches the role a suspended user comes back with (#515), and the totals are of all users, whatever the
 * search and filters (#516).
 */
import { NextRequest } from 'next/server'

const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryWithRLS: (...args: unknown[]) => queryWithRLS(...args),
}))

import { GET } from '../../../src/routes/api/superadmin/users/route'

const call = (search: string) => GET(new NextRequest(`http://localhost/api/superadmin/users?${search}`), undefined as never)
/** The SQL and params of the statement that lists the regular users */
const listQuery = () => queryWithRLS.mock.calls.find(([sql]) => /LIMIT/.test(sql as string) && /role != \$1/.test(sql as string)) as [string, unknown[]]

beforeEach(() => {
  jest.clearAllMocks()
  session.mockResolvedValue({ session: { id: 's' }, user: { id: 'sa', role: 'superadmin' } })
  queryWithRLS.mockImplementation(async (sql: string) => {
    if (/FILTER \(WHERE role = 'superadmin'\)/.test(sql)) return [{ total: 85, superadmins: 2, verified: 80, unverified: 5, suspended: 3, active: 82 }]
    if (/GROUP BY 1/.test(sql)) return [{ role: 'member', count: 70 }, { role: 'developer', count: 13 }]
    if (/FROM "teams"/.test(sql) && !/team_members/.test(sql)) return [{ total: 7, workTeams: 6 }]
    if (/LIMIT/.test(sql) && /role != \$1/.test(sql)) return [{ id: 'u1', email: 'u1@x', firstName: 'U', lastName: 'One', role: 'member', roleBeforeSuspension: null, emailVerified: true, createdAt: 'x', updatedAt: 'x', teamCount: 5, teams: [{ id: 't1', name: 'Acme' }] }]
    if (/COUNT\(\*\)::int as total\s+FROM "users"/.test(sql)) return [{ total: 1 }]
    return []
  })
})

describe('status filter', () => {
  it('suspended lists the suspended accounts, whatever their email', async () => {
    await call('status=suspended')
    expect(listQuery()[0]).toContain(`role = 'suspended'`)
  })

  it('active leaves the suspended accounts out', async () => {
    await call('status=active')
    expect(listQuery()[0]).toContain(`role != 'suspended'`)
  })

  it('unverified is still the email, and verified is kept for the callers that sent it', async () => {
    await call('status=unverified')
    expect(listQuery()[0]).toContain('"emailVerified" IS NULL')
    queryWithRLS.mockClear()
    await call('status=verified')
    expect(listQuery()[0]).toContain('"emailVerified" = $')
  })
})

describe('role filter', () => {
  it('matches a suspended user by the role they come back with', async () => {
    await call('role=developer')
    const [sql, params] = listQuery()
    expect(sql).toContain(`COALESCE("roleBeforeSuspension", 'member')`)
    expect(params).toContain('developer')
  })

  it('role=suspended keeps listing the suspended accounts', async () => {
    await call('role=suspended')
    const [sql, params] = listQuery()
    expect(sql).not.toContain('COALESCE("roleBeforeSuspension"')
    expect(params).toContain('suspended')
  })
})

describe('counts', () => {
  it('the totals are of all users, apart from what the search leaves', async () => {
    const body = await (await call('search=zzz&status=suspended')).json()
    expect(body.counts).toMatchObject({
      total: 85,
      regularUsers: 83,
      superadmins: 2,
      matching: { regularUsers: 1 },
      byRole: { member: 70, developer: 13 },
      statusDistribution: { active: 82, suspended: 3, verified: 80, unverified: 5 },
    })
  })

  it('Work Teams is the real count of the teams but the system admin one', async () => {
    const body = await (await call('')).json()
    expect(body.counts.workTeams).toBe(6)
    expect(body.counts.teams).toBe(7)
  })
})

describe('teams of each user (#521)', () => {
  it('asks for the count and the first three teams of each user and returns them', async () => {
    const body = await (await call('')).json()
    const [sql] = listQuery()
    expect(sql).toContain('"teamCount"')
    expect(sql).toMatch(/LIMIT 3/)
    expect(body.regularUsers[0]).toMatchObject({ teamCount: 5, teams: [{ id: 't1', name: 'Acme' }] })
  })
})
