/**
 * DELETE /api/v1/teams/:teamId/members/me (#459): the signed-in user leaves a team. An admin, a member and a viewer
 * leave (their row goes); the owner is refused until they transfer ownership; someone outside the team gets 404; a
 * user id in the request changes nothing about who leaves; outside multi-tenant mode leaving is refused.
 *
 * The database is a small in-memory team_members table behind the harness's mocks; the policy itself is checked on the
 * nextspark_app cutover (tests/node/team-members-cutover.test.ts).
 */
import { routeHarness, makeReq, asJson, idParams, sessionAs } from './input-validation/__helpers__/route-harness'
import { APP_CONFIG_MERGED } from '@/core/lib/config/config-sync'
import { DELETE } from '@/app/api/v1/teams/[teamId]/members/me/route'

const { mocks } = routeHarness
const TEAM = 'team-1'

type Row = { id: string; teamId: string; userId: string; role: string }
let rows: Row[] = []

function seed() {
  rows = [
    { id: 'm-owner', teamId: TEAM, userId: 'owner', role: 'owner' },
    { id: 'm-admin', teamId: TEAM, userId: 'admin', role: 'admin' },
    { id: 'm-member', teamId: TEAM, userId: 'member', role: 'member' },
    { id: 'm-viewer', teamId: TEAM, userId: 'viewer', role: 'viewer' },
    { id: 'm-other', teamId: 'team-2', userId: 'member', role: 'member' },
  ]
}

const find = (teamId: unknown, userId: unknown) => rows.find(r => r.teamId === teamId && r.userId === userId)

function leave(actor: string, { path = `/api/v1/teams/${TEAM}/members/me`, body }: { path?: string; body?: unknown } = {}) {
  mocks.authenticateRequest.mockResolvedValue(sessionAs({ id: actor, email: `${actor}@example.test`, role: 'member' }))
  return DELETE(makeReq('DELETE', path, body === undefined ? undefined : asJson(body)), idParams({ teamId: TEAM }))
}

describe('DELETE /api/v1/teams/:teamId/members/me', () => {
  const teams = APP_CONFIG_MERGED.teams as { mode: string }
  const mode = teams.mode

  beforeEach(() => {
    routeHarness.reset()
    seed()
    teams.mode = 'multi-tenant'
    mocks.queryOneWithRLS.mockImplementation(async (sql: string, [teamId, userId]: unknown[]) =>
      sql.includes('FROM "team_members"') ? find(teamId, userId) ?? null : null
    )
    // The statement's own filter: the user's row in the team, never an owner's
    mocks.mutateWithRLS.mockImplementation(async (sql: string, [teamId, userId]: unknown[]) => {
      const row = sql.startsWith('DELETE FROM "team_members"') ? find(teamId, userId) : undefined
      if (!row || (sql.includes(`role <> 'owner'`) && row.role === 'owner')) return { rows: [], rowCount: 0 }
      rows = rows.filter(r => r !== row)
      return { rows: [{ id: row.id }], rowCount: 1 }
    })
  })
  afterAll(() => {
    teams.mode = mode
  })

  it.each(['admin', 'member', 'viewer'])('a %s leaves: their row in this team goes, nothing else', async actor => {
    const response = await leave(actor)

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ deleted: true, id: `m-${actor}`, teamId: TEAM })
    expect(find(TEAM, actor)).toBeUndefined()
    expect(rows).toHaveLength(4)
    // on the RLS connection, as the session user (no service option)
    expect(mocks.mutateWithRLS).toHaveBeenCalledTimes(1)
    expect(mocks.mutateWithRLS.mock.calls[0][2]).toBe(actor)
    expect(mocks.mutateWithRLS.mock.calls[0][3]).toBeUndefined()
  })

  it('the owner is refused and stays', async () => {
    const response = await leave('owner')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'OWNER_CANNOT_LEAVE', error: 'Team owners cannot leave. Transfer ownership first.' })
    expect(find(TEAM, 'owner')?.role).toBe('owner')
  })

  it('someone outside the team gets 404 and nothing is written', async () => {
    const response = await leave('stranger')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'MEMBER_NOT_FOUND' })
    expect(mocks.mutateWithRLS).not.toHaveBeenCalled()
    expect(rows).toHaveLength(5)
  })

  it('a user id in the request does not choose who leaves: the session user does', async () => {
    const response = await leave('viewer', { path: `/api/v1/teams/${TEAM}/members/me?userId=member`, body: { userId: 'member' } })

    expect(response.status).toBe(200)
    expect(find(TEAM, 'viewer')).toBeUndefined()
    expect(find(TEAM, 'member')).toBeDefined()
  })

  it.each(['single-user', 'single-tenant'])('in %s mode leaving is refused', async value => {
    teams.mode = value

    const response = await leave('member')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'TEAM_LEAVE_DISABLED' })
    expect(find(TEAM, 'member')).toBeDefined()
    expect(mocks.mutateWithRLS).not.toHaveBeenCalled()
  })
})
