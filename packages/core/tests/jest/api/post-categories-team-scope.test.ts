/**
 * /api/v1/post-categories: categories belong to the caller's team (x-team-id) and are written under the posts
 * entity's team-role permissions (posts.create / update / delete). Rows without a team stay readable; only a
 * superadmin changes or deletes them. Another team's category answers 404.
 */
import { NextRequest } from 'next/server'

const auth = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => auth(...args),
  createAuthFailureResponse: () => new Response(JSON.stringify({ success: false }), { status: 401 }),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))

// Team A: owner owna, member mema. Team B: owner ownb, member memb. The member role has posts.create/update, not delete.
const ROLES: Record<string, Record<string, string>> = { 'team-a': { owna: 'owner', mema: 'member' }, 'team-b': { ownb: 'owner', memb: 'member' } }
const GRANTS: Record<string, string[]> = { owner: ['posts.list', 'posts.create', 'posts.update', 'posts.delete'], member: ['posts.list', 'posts.create', 'posts.update'] }
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({
  checkPermission: async (userId: string, teamId: string, permission: string) =>
    (GRANTS[ROLES[teamId]?.[userId]] ?? []).includes(permission),
}))

// Stored categories: one of team A, one without a team (created by an earlier release).
const ROWS = [{ id: 'cat-a', teamId: 'team-a' as string | null }, { id: 'cat-global', teamId: null as string | null }]
const query = jest.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith('SELECT "teamId" FROM taxonomies')) {
    const [id, team] = params
    return { rows: ROWS.filter(r => r.id === id && (r.teamId === null || r.teamId === team)), rowCount: 1 }
  }
  if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }], rowCount: 1 }
  if (sql.startsWith('INSERT') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return { rows: [{ id: params[0] }], rowCount: 1 }
  return { rows: [], rowCount: 0 }
})
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (sql: string, params?: unknown[]) => query(sql, params) }))

import { GET as list, POST } from '../../../src/routes/api/v1/post-categories/route'
import { PUT, DELETE } from '../../../src/routes/api/v1/post-categories/[id]/route'

type Who = 'anon' | 'owna' | 'mema' | 'ownb' | 'memb' | 'super'
function as(who: Who, team?: string) {
  auth.mockResolvedValue(who === 'anon'
    ? { success: false, type: 'none', user: null }
    : { success: true, type: 'session', user: { id: who, role: who === 'super' ? 'superadmin' : 'member' } })
  return team ? { 'x-team-id': team } : {}
}
const req = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
  new NextRequest(`http://localhost/api/v1/post-categories${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const sqlOf = (prefix: string) => query.mock.calls.filter(([sql]) => sql.startsWith(prefix))

beforeEach(() => query.mockClear())

describe('create', () => {
  it('a member creates a category in their own team', async () => {
    const response = await POST(req('POST', '', as('mema', 'team-a'), { name: 'News' }), undefined as never)
    expect(response.status).toBe(201)
    const [[, values]] = sqlOf('INSERT')
    expect(values.at(-1)).toBe('team-a')
    expect(values.at(-2)).toBe('mema')
  })

  it('needs a team, and posts.create in it', async () => {
    expect((await POST(req('POST', '', as('mema'), { name: 'x' }), undefined as never)).status).toBe(400)
    expect((await POST(req('POST', '', as('memb', 'team-a'), { name: 'x' }), undefined as never)).status).toBe(403)
    expect((await POST(req('POST', '', as('super'), { name: 'x' }), undefined as never)).status).toBe(400)
    expect((await POST(req('POST', '', as('anon', 'team-a'), { name: 'x' }), undefined as never)).status).toBe(401)
    expect(sqlOf('INSERT')).toHaveLength(0)
  })
})

describe('update and delete', () => {
  it('the owner of another team gets 404 for a team A category, and nothing is written', async () => {
    expect((await PUT(req('PUT', '/cat-a', as('ownb', 'team-b'), { name: 'x' }), params('cat-a'))).status).toBe(404)
    expect((await DELETE(req('DELETE', '/cat-a', as('ownb', 'team-b')), params('cat-a'))).status).toBe(404)
    expect([...sqlOf('UPDATE'), ...sqlOf('DELETE')]).toHaveLength(0)
  })

  it('a member of another team gets 403 (no posts.delete) and cannot name team A to get in', async () => {
    expect((await DELETE(req('DELETE', '/cat-a', as('memb', 'team-b')), params('cat-a'))).status).toBe(403)
    expect((await DELETE(req('DELETE', '/cat-a', as('memb', 'team-a')), params('cat-a'))).status).toBe(403)
    expect(sqlOf('DELETE')).toHaveLength(0)
  })

  it('in its team: a member updates but cannot delete; the owner deletes', async () => {
    expect((await PUT(req('PUT', '/cat-a', as('mema', 'team-a'), { name: 'Renamed' }), params('cat-a'))).status).toBe(200)
    expect((await DELETE(req('DELETE', '/cat-a', as('mema', 'team-a')), params('cat-a'))).status).toBe(403)
    expect((await DELETE(req('DELETE', '/cat-a', as('owna', 'team-a')), params('cat-a'))).status).toBe(200)
    const [[sql, values]] = sqlOf('DELETE')
    expect(sql).toContain('"teamId" IS NOT DISTINCT FROM $2')
    expect(values).toEqual(['cat-a', 'team-a'])
  })

  it('a category without a team: 403 for a team owner, changed by a superadmin', async () => {
    expect((await PUT(req('PUT', '/cat-global', as('owna', 'team-a'), { name: 'x' }), params('cat-global'))).status).toBe(403)
    expect((await DELETE(req('DELETE', '/cat-global', as('owna', 'team-a')), params('cat-global'))).status).toBe(403)
    expect(sqlOf('UPDATE')).toHaveLength(0)
    expect((await PUT(req('PUT', '/cat-global', as('super'), { name: 'Renamed' }), params('cat-global'))).status).toBe(200)
    expect((await DELETE(req('DELETE', '/cat-global', as('super')), params('cat-global'))).status).toBe(200)
  })
})

describe('read', () => {
  it('a visitor sees only the categories without a team', async () => {
    as('anon')
    expect((await list(req('GET', '', {}), undefined as never)).status).toBe(200)
    expect(query.mock.calls[0][1]).toEqual([null])
  })

  it('a member sees their team\'s and the ones without a team; another team\'s id gets 403', async () => {
    expect((await list(req('GET', '', as('mema', 'team-a')), undefined as never)).status).toBe(200)
    expect(query.mock.calls[0][1]).toEqual(['team-a'])
    expect((await list(req('GET', '', as('memb', 'team-a')), undefined as never)).status).toBe(403)
  })
})
