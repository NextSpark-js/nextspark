/**
 * The superadmin users and teams lists sort on the server by a whitelisted column, newest first by default (#538).
 */
import { NextRequest } from 'next/server'
import { parseSort } from '../../../src/lib/api/list-sort'

const session = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: () => session() }))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({
  ...jest.requireActual('@nextsparkjs/core/lib/db'),
  queryWithRLS: (...args: unknown[]) => queryWithRLS(...args),
}))

import { GET as users } from '../../../src/routes/api/superadmin/users/route'
import { GET as teams } from '../../../src/routes/api/superadmin/teams/route'

const req = (path: string, search: string) => new NextRequest(`http://localhost${path}?${search}`)
const listSql = (match: RegExp) => (queryWithRLS.mock.calls.find(([sql]) => match.test(sql as string)) as [string])[0]
const orderBy = (sql: string) => sql.match(/ORDER BY ((?:LOWER|COUNT|t\.|")[^\n]*)\n/)?.[1]

beforeEach(() => {
  jest.clearAllMocks()
  session.mockResolvedValue({ session: { id: 's' }, user: { id: 'sa', role: 'superadmin' } })
  queryWithRLS.mockResolvedValue([])
})

describe('parseSort', () => {
  const columns = { name: 'LOWER(name)', createdAt: '"createdAt"' }
  const sort = (search: string) => parseSort(new NextRequest(`http://localhost/x?${search}`), columns, { key: 'createdAt', order: 'desc' })

  it('uses the fallback when nothing is asked', () => {
    expect(sort('')).toEqual({ key: 'createdAt', order: 'desc', orderBy: '"createdAt" DESC, id' })
  })

  it('takes a known column and its direction', () => {
    expect(sort('sort=name&order=asc').orderBy).toBe('LOWER(name) ASC, id')
    expect(sort('sort=name&order=desc').orderBy).toBe('LOWER(name) DESC, id')
  })

  it('a column that is not whitelisted never reaches the SQL (it is the fallback), whatever the direction says', () => {
    expect(sort('sort=%22createdAt%22%3B%20DROP%20TABLE%20users&order=asc')).toEqual({ key: 'createdAt', order: 'desc', orderBy: '"createdAt" DESC, id' })
    expect(sort('sort=constructor').orderBy).toBe('"createdAt" DESC, id')
    expect(sort('sort=name&order=sideways').orderBy).toBe('LOWER(name) DESC, id')
  })
})

describe('GET /api/superadmin/users', () => {
  it('sorts by the name, falling back to the email for a user with no name', async () => {
    await users(req('/api/superadmin/users', 'sort=name&order=asc'), undefined as never)
    const sql = listSql(/LIMIT \$/)
    expect(sql).toContain(`LOWER(COALESCE(NULLIF(TRIM(CONCAT("firstName", ' ', "lastName")), ''), email)) ASC, id`)
  })

  it('is newest first by default and says which sort it applied', async () => {
    const body = await (await users(req('/api/superadmin/users', ''), undefined as never)).json()
    expect(orderBy(listSql(/LIMIT \$/))).toBe('"createdAt" DESC, id')
    expect(body.sort).toEqual({ key: 'createdAt', order: 'desc' })
  })
})

describe('GET /api/superadmin/teams', () => {
  const teamsList = () => listSql(/GROUP BY t\.id/)

  it('sorts by the member count', async () => {
    await teams(req('/api/superadmin/teams', 'sort=members&order=desc'), undefined as never)
    expect(teamsList()).toContain('ORDER BY COUNT(tm.id) DESC, t.id')
  })

  it('sorts by the name and ignores a column it does not have', async () => {
    await teams(req('/api/superadmin/teams', 'sort=name&order=asc'), undefined as never)
    expect(teamsList()).toContain('ORDER BY LOWER(t.name) ASC, t.id')
    queryWithRLS.mockClear()
    await teams(req('/api/superadmin/teams', 'sort=owner'), undefined as never)
    expect(teamsList()).toContain('ORDER BY t."createdAt" DESC, t.id')
  })
})
