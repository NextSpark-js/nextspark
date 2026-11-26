/**
 * #574: the dashboard list page reads its first page on the server with the list API's own read
 * (listEntityRecords). For the same user, team and role it must answer what `GET /api/v1/<slug>?limit=50&includeMeta=true`
 * answers that user (the same query, the same rows, the same hidden fields), and nothing whenever the API would refuse.
 */
import { harness, makeRequest, listUrl, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import type { EntityConfig } from '@/core/lib/entities/types'

const mockSession = jest.fn()
const mockMembership = jest.fn()
// Which team roles may list: one rule for both sides (contextHasPermission applies checkPermission's rule, #571/#572)
const LISTERS = new Set(['owner', 'admin', 'member'])
jest.mock('@/core/lib/auth/request-session', () => ({
  getAuthorizationRequestSession: () => mockSession(),
  getSessionActiveTeamId: async (session: { session?: { id?: string } }) => (session.session?.id === 's-chose-team-2' ? 'team-2' : null),
  contextHasPermission: (context: { teamRole: string | null }) => LISTERS.has(context.teamRole ?? ''),
}))
jest.mock('@/core/lib/teams/dashboard-team', () => ({
  getDashboardMembership: (...args: unknown[]) => mockMembership(...args),
}))

import { handleGenericList } from '@/core/lib/api/entity/generic-handler'
import { readEntityListFirstPage } from '@/core/lib/api/entity/list-first-page'

const { mocks } = harness
type Res = { status: number; body: { data?: unknown; code?: string } }

const ENTITY = (access: Record<string, unknown> = {}) => ({
  slug: 'pets',
  tableName: 'pets',
  enabled: true,
  fields: [
    { name: 'name', type: 'text', api: { readOnly: false } },
    { name: 'secret', type: 'text', api: { readOnly: false } },
    { name: 'adoptedAt', type: 'datetime', api: { readOnly: false } },
  ],
  access: { api: true, fieldVisibility: [{ roles: ['member'], hideFields: ['secret'] }], ...access },
}) as unknown as EntityConfig

const ROWS = () => [
  { id: 'p1', name: 'Rex', secret: 's1', adoptedAt: new Date('2026-01-02T03:04:05Z'), total_count: '2' },
  { id: 'p2', name: 'Tom', secret: 's2', adoptedAt: null, total_count: '2' },
]

/** One user in one team with one role, as both sides see them. */
function given({ role, teamId = 'team-1', sessionId = 's1', entity = ENTITY() }: { role: string; teamId?: string; sessionId?: string; entity?: EntityConfig }) {
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: entity, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH('u1'))
  mocks.checkPermission.mockImplementation(async () => LISTERS.has(role))
  mocks.queryOneWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM "team_members"')) return { id: 'm1' }
    if (sql.includes('SELECT role FROM "team_members"')) return { role }
    return null
  })
  mocks.queryWithRLS.mockImplementation(async () => ROWS())
  mockSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: sessionId } })
  mockMembership.mockResolvedValue({ teamId, teamRole: role, appRole: 'member' })
}

const api = (teamId = 'team-1') =>
  handleGenericList(makeRequest({ url: listUrl({ limit: '50', includeMeta: 'true' }), headers: { 'x-team-id': teamId } })) as unknown as Promise<Res>
const listCalls = () => mocks.queryWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('FROM "pets"'))

beforeEach(() => harness.reset())

describe.each(['owner', 'admin', 'member'])('role %s: the page answers what the API answers', role => {
  test('same rows, same hidden fields, same query', async () => {
    given({ role })
    const fromApi = await api()
    const apiCalls = listCalls()
    mocks.queryWithRLS.mockClear()

    const fromPage = await readEntityListFirstPage('pets', {})
    expect(fromApi.status).toBe(200)
    expect(fromPage?.data).toEqual(JSON.parse(JSON.stringify(fromApi.body.data)))
    expect(fromPage?.teamId).toBe('team-1')
    expect(listCalls()).toEqual(apiCalls)
    if (role === 'member') expect(fromPage?.data[0]).not.toHaveProperty('secret')
    else expect(fromPage?.data[0]).toHaveProperty('secret', 's1')
  })
})

test('the dates are the strings of the API JSON, not the driver values', async () => {
  given({ role: 'owner' })
  expect((await readEntityListFirstPage('pets', {}))?.data[0].adoptedAt).toBe('2026-01-02T03:04:05.000Z')
})

test('a role the API refuses (403) gets nothing, and no row is read', async () => {
  given({ role: 'guest' })
  expect((await api()).status).toBe(403)
  mocks.queryWithRLS.mockClear()
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  expect(listCalls()).toHaveLength(0)
})

test('no session (signed out, revoked or suspended: the API reads the same database session) gets nothing', async () => {
  given({ role: 'owner' })
  mockSession.mockResolvedValue(null)
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  expect(listCalls()).toHaveLength(0)
})

test('a user in no team gets nothing (the API answers 400 without a team)', async () => {
  given({ role: 'owner' })
  mockMembership.mockResolvedValue(null)
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  expect(listCalls()).toHaveLength(0)
})

test('the team is the one this session chose, filtered as the API filters a request for that team', async () => {
  given({ role: 'owner', teamId: 'team-2', sessionId: 's-chose-team-2' })
  const fromPage = await readEntityListFirstPage('pets', {})
  expect(mockMembership).toHaveBeenCalledWith('u1', 'team-2')
  expect(fromPage?.teamId).toBe('team-2')
  const pageCalls = listCalls()
  mocks.queryWithRLS.mockClear()
  await api('team-2')
  expect(pageCalls).toEqual(listCalls())
  expect(pageCalls[0][1]).toContain('team-2')
  expect(pageCalls[0][1]).not.toContain('team-1')
})

test('private rows: filtered by the user, as the API filters them (access.shared off)', async () => {
  given({ role: 'member' })
  await readEntityListFirstPage('pets', {})
  const [sql, params] = listCalls()[0]
  expect(sql).toContain('t."userId" = $2')
  expect(params.slice(0, 2)).toEqual(['team-1', 'u1'])
})

test('an ownership filter with no linked record: both answer an empty list', async () => {
  const entity = ENTITY({ ownershipFilter: { roles: ['member'], field: 'clientId', linkedBy: { table: 'clients', userField: 'userId', valueField: 'id' } } })
  given({ role: 'member', entity })
  mocks.queryOneWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM "team_members"')) return { id: 'm1' }
    if (sql.includes('SELECT role FROM "team_members"')) return { role: 'member' }
    return null
  })
  const fromApi = await api()
  const fromPage = await readEntityListFirstPage('pets', {})
  expect(fromApi.body.data).toEqual([])
  expect(fromPage?.data).toEqual([])
})

test('a query with parameters (a filter, a search) is left to the client', async () => {
  given({ role: 'owner' })
  expect(await readEntityListFirstPage('pets', { status: 'open' })).toBeNull()
  expect(mockSession).not.toHaveBeenCalled()
  expect(listCalls()).toHaveLength(0)
})

test('an entity whose API read is off, or that is disabled, is left to the client (which gets the API answer)', async () => {
  given({ role: 'owner', entity: ENTITY({ api: { read: false } }) })
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  given({ role: 'owner', entity: { ...ENTITY(), enabled: false } as EntityConfig })
  mocks.validateEntityOperation.mockReturnValue(false)
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  expect(listCalls()).toHaveLength(0)
})

test('a failing query is null (the client asks the API), not an error page', async () => {
  given({ role: 'owner' })
  mocks.queryWithRLS.mockRejectedValue(new Error('db down'))
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(await readEntityListFirstPage('pets', {})).toBeNull()
  spy.mockRestore()
})

test('every read has its own key', async () => {
  given({ role: 'owner' })
  const a = await readEntityListFirstPage('pets', {})
  const b = await readEntityListFirstPage('pets', {})
  expect(a?.key).toBeTruthy()
  expect(a?.key).not.toBe(b?.key)
})
