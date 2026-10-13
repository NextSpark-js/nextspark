/**
 * PATCH /api/superadmin/users/:id: `suspend` sets the role 'suspended' (which check_users_role accepts since migration
 * 031), deletes the user's sessions and deactivates their API keys in one statement; `unsuspend` gives back 'member' and
 * leaves the keys deactivated. Nobody acts on their own account or on a superadmin, so the last superadmin is never
 * suspended. `change-role` offers only roles the schema accepts.
 */
import { NextRequest } from 'next/server'

const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))
const invalidateApiKeyCache = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth', () => ({ invalidateApiKeyCache: (hash: string) => invalidateApiKeyCache(hash) }))

import { GET, PATCH, DELETE } from '../../../src/routes/api/superadmin/users/[userId]/route'

const USERS: Record<string, string> = { 'sa-1': 'superadmin', 'sa-2': 'superadmin', 'dev-1': 'developer', 'dev-2': 'developer', 'mem-1': 'member', 'sus-1': 'suspended' }

function as(id: string) {
  session.mockResolvedValue({ session: { id: 's' }, user: { id, role: USERS[id] } })
}
const patch = (target: string, body: Record<string, unknown>) =>
  PATCH(new NextRequest(`http://localhost/api/superadmin/users/${target}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ userId: target }) } as never)

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  queryWithRLS.mockImplementation(async (sql: string, params: string[]) => {
    if (sql.includes('SELECT id, role, email FROM "users"')) return USERS[params[0]] ? [{ id: params[0], role: USERS[params[0]], email: `${params[0]}@x` }] : []
    if (sql.includes('SELECT id, role FROM "users"')) return USERS[params[0]] ? [{ id: params[0], role: USERS[params[0]] }] : []
    if (sql.includes('WITH suspended AS')) return [{ suspended: 1, sessions: 2, keyHashes: ['h1', 'h2'] }]
    if (sql.includes(`AND role = 'suspended' RETURNING id`)) return USERS[params[0]] === 'suspended' ? [{ id: params[0] }] : []
    return [{ id: params[params.length - 1] }]
  })
})

describe('suspend', () => {
  it('suspends a member: role, sessions and API keys in one statement, and drops the keys from the cache', async () => {
    as('sa-1')
    const response = await patch('mem-1', { action: 'suspend' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, revoked: { sessions: 2, apiKeys: 2 } })
    const [[sql, params]] = queryWithRLS.mock.calls.filter(([s]: [string]) => s.includes('WITH suspended AS'))
    expect(sql).toContain(`SET role = 'suspended'`)
    expect(sql).not.toContain('superadmin')
    expect(sql).toContain('DELETE FROM "session"')
    expect(sql).toContain(`UPDATE "api_key" SET status = 'inactive'`)
    expect(params).toEqual(['mem-1'])
    expect(invalidateApiKeyCache.mock.calls).toEqual([['h1'], ['h2']])
  })

  it('refuses the caller\'s own account, and a superadmin unless the caller is a developer', async () => {
    as('sa-1')
    expect((await patch('sa-1', { action: 'suspend' })).status).toBe(400)
    expect((await patch('sa-2', { action: 'suspend' })).status).toBe(403)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.includes('WITH suspended AS'))).toBe(false)
    as('dev-1')
    expect((await patch('dev-1', { action: 'suspend' })).status).toBe(400)
    expect((await patch('sa-1', { action: 'suspend' })).status).toBe(200)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.includes('WITH suspended AS'))).toBe(true)
  })

  it('a member cannot suspend anyone', async () => {
    as('mem-1')
    expect((await patch('dev-1', { action: 'suspend' })).status).toBe(403)
  })
})

describe('unsuspend', () => {
  it('gives a suspended user back the member role, without touching their API keys', async () => {
    as('sa-1')
    expect((await patch('sus-1', { action: 'unsuspend' })).status).toBe(200)
    const writes = queryWithRLS.mock.calls.map(([s]: [string]) => s).filter((s: string) => !s.includes('SELECT id, role'))
    expect(writes).toHaveLength(1)
    expect(writes[0]).toContain(`SET role = 'member'`)
    expect(writes[0]).not.toContain('api_key')
  })

  it('refuses a user who is not suspended (a developer is not demoted by it)', async () => {
    as('dev-2')
    expect((await patch('dev-1', { action: 'unsuspend' })).status).toBe(400)
  })
})

describe('change-role', () => {
  it('offers only roles users.role accepts', async () => {
    as('sa-1')
    for (const role of ['admin', 'colaborator', 'superadmin', 'suspended']) {
      expect((await patch('mem-1', { action: 'change-role', role })).status).toBe(400)
    }
    as('dev-2')
    expect((await patch('dev-1', { action: 'change-role', role: 'member' })).status).toBe(200)
  })

  it('a suspended user is restored only through unsuspend', async () => {
    as('sa-1')
    for (const role of ['member', 'developer']) {
      const response = await patch('sus-1', { action: 'change-role', role })
      expect(response.status).toBe(400)
      expect((await response.json()).error).toMatch(/unsuspend/)
    }
  })

  it('only a developer grants the developer role', async () => {
    as('sa-1')
    const refused = await patch('mem-1', { action: 'change-role', role: 'developer' })
    expect(refused.status).toBe(403)
    expect((await refused.json()).error).toMatch(/Only a developer/)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.includes('UPDATE "users"'))).toBe(false)
    as('dev-1')
    expect((await patch('mem-1', { action: 'change-role', role: 'developer' })).status).toBe(200)
  })
})

describe('GET', () => {
  it('reads the user and their metadata on the service connection, so a developer sees them under RLS', async () => {
    as('dev-1')
    const response = await GET(new NextRequest('http://localhost/api/superadmin/users/mem-1'), { params: Promise.resolve({ userId: 'mem-1' }) } as never)
    expect(response.status).toBe(200)
    for (const table of ['"users"', '"users_metas"']) {
      const [call] = queryWithRLS.mock.calls.filter(([s]: [string]) => s.includes(`FROM ${table}`))
      expect(call[3]).toEqual({ service: true })
    }
  })
})

// #241: the developer role has every superadmin capability. Under the nextspark_app role the users policies hide other
// users from a developer outside the System Admin Team, so the route reads and writes on the service connection after
// its role check.
describe('PATCH and DELETE on the service connection', () => {
  const del = (target: string) =>
    DELETE(new NextRequest(`http://localhost/api/superadmin/users/${target}`, { method: 'DELETE' }), { params: Promise.resolve({ userId: target }) } as never)
  const everyQueryOnService = () => {
    expect(queryWithRLS.mock.calls.length).toBeGreaterThan(0)
    for (const call of queryWithRLS.mock.calls) expect(call[3]).toEqual({ service: true })
  }

  it.each(['dev-1', 'sa-1'])('%s changes, suspends, unsuspends and verifies a user', async (actor) => {
    as(actor)
    for (const [target, body] of [
      ['mem-1', { action: 'change-role', role: 'member' }],
      ['mem-1', { action: 'verify-email' }],
      ['mem-1', { action: 'suspend' }],
      ['sus-1', { action: 'unsuspend' }],
    ] as const) {
      expect((await patch(target, body)).status).toBe(200)
    }
    everyQueryOnService()
  })

  it.each(['dev-1', 'sa-1'])('%s deletes a user', async (actor) => {
    as(actor)
    const response = await del('mem-1')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, userId: 'mem-1' })
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.includes('DELETE FROM "users"'))).toBe(true)
    everyQueryOnService()
  })

  it('a member is refused before any query', async () => {
    as('mem-1')
    expect((await patch('dev-1', { action: 'verify-email' })).status).toBe(403)
    expect((await del('dev-1')).status).toBe(403)
    expect(queryWithRLS).not.toHaveBeenCalled()
  })

  it('only a developer deletes a superadmin', async () => {
    as('sa-1')
    expect((await del('sa-2')).status).toBe(403)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.startsWith('DELETE'))).toBe(false)
    as('dev-1')
    expect((await del('sa-1')).status).toBe(200)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => s.startsWith('DELETE'))).toBe(true)
  })
})

// The developer role ranks above superadmin: only a developer changes, suspends or deletes a developer.
describe('developer targets', () => {
  const del = (target: string) =>
    DELETE(new NextRequest(`http://localhost/api/superadmin/users/${target}`, { method: 'DELETE' }), { params: Promise.resolve({ userId: target }) } as never)

  it('a superadmin neither changes, suspends, verifies nor deletes a developer', async () => {
    as('sa-1')
    for (const body of [{ action: 'change-role', role: 'member' }, { action: 'suspend' }, { action: 'verify-email' }]) {
      const response = await patch('dev-1', body)
      expect(response.status).toBe(403)
      expect((await response.json()).error).toMatch(/developer/)
    }
    expect((await del('dev-1')).status).toBe(403)
    expect(queryWithRLS.mock.calls.some(([s]: [string]) => /^\s*(UPDATE|DELETE)|WITH suspended/.test(s))).toBe(false)
  })

  it('a superadmin neither changes, suspends, verifies nor deletes another superadmin; a developer does all of it', async () => {
    as('sa-1')
    for (const body of [{ action: 'change-role', role: 'member' }, { action: 'suspend' }, { action: 'verify-email' }]) {
      expect((await patch('sa-2', body)).status).toBe(403)
    }
    expect((await del('sa-2')).status).toBe(403)
    queryWithRLS.mockClear()
    as('dev-1')
    expect((await patch('sa-2', { action: 'change-role', role: 'member' })).status).toBe(200)
    expect((await patch('sa-2', { action: 'suspend' })).status).toBe(200)
    expect((await patch('sa-2', { action: 'verify-email' })).status).toBe(200)
    expect((await del('sa-2')).status).toBe(200)
  })

  it('another developer does', async () => {
    as('dev-2')
    expect((await patch('dev-1', { action: 'verify-email' })).status).toBe(200)
    expect((await patch('dev-1', { action: 'change-role', role: 'member' })).status).toBe(200)
    expect((await patch('dev-1', { action: 'suspend' })).status).toBe(200)
    expect((await del('dev-1')).status).toBe(200)
  })
})
