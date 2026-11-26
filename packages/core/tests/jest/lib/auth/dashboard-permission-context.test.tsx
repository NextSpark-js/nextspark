/**
 * The dashboard's entity layouts decide with the roles the team lookup returned (#572): one query, no second
 * membership read. The answers are the ones checkPermission gives for the same user, team and setting
 * (teams.appRoleBypass: roles x setting x team deleted / not a member), written out here and compared with
 * checkPermission, not derived from the code under test.
 */
jest.mock('server-only', () => ({}))

type Row = { teamRole: string; appRole: string } | null
let row: Row = null
const queryOne = jest.fn(async (_sql: string, _params: unknown[]) =>
  row ? { teamId: 'team-1', teamRole: row.teamRole, appRole: row.appRole } : null
)
const queryOneWithRLS = jest.fn(async (_sql: string, _params: unknown[]) =>
  row ? { role: row.teamRole, appRole: row.appRole } : null
)
jest.mock('@/core/lib/db', () => ({
  queryOne: (sql: string, params: unknown[]) => queryOne(sql, params),
  queryOneWithRLS: (sql: string, params: unknown[]) => queryOneWithRLS(sql, params),
}))
jest.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
jest.mock('@nextsparkjs/core/lib/auth', () => ({ getTypedSession: async () => ({ session: { id: 's' }, user: { id: 'u1' } }) }))
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }))

import { TEAMS_CONFIG } from '@/core/lib/config/config-client'
import { checkPermission } from '@/core/lib/permissions/check'
import { getDashboardPermissionContext, contextHasPermission } from '@/core/lib/auth/request-session'
import type { Permission } from '@/core/lib/permissions/types'

const SENSITIVE = 'team.delete' as Permission // owner only in the registry mock
const COMMON = 'customers.read' as Permission // owner, admin, member

type Setting = 'none' | 'developer' | 'developer-and-superadmin' | undefined
const setSetting = (value: Setting) => {
  const teams = TEAMS_CONFIG as unknown as Record<string, unknown>
  if (value === undefined) delete teams.appRoleBypass
  else teams.appRoleBypass = value
}

// user, its row, and the expected [sensitive, common] under each setting
const CASES: Array<[string, Row, Record<'none' | 'developer' | 'developer-and-superadmin', [boolean, boolean]>]> = [
  ['owner', { teamRole: 'owner', appRole: 'member' }, { none: [true, true], developer: [true, true], 'developer-and-superadmin': [true, true] }],
  ['admin', { teamRole: 'admin', appRole: 'member' }, { none: [false, true], developer: [false, true], 'developer-and-superadmin': [false, true] }],
  ['member', { teamRole: 'member', appRole: 'member' }, { none: [false, true], developer: [false, true], 'developer-and-superadmin': [false, true] }],
  ['developer, team member', { teamRole: 'member', appRole: 'developer' }, { none: [false, true], developer: [true, true], 'developer-and-superadmin': [true, true] }],
  ['superadmin, team member', { teamRole: 'member', appRole: 'superadmin' }, { none: [false, true], developer: [false, true], 'developer-and-superadmin': [true, true] }],
  // Not a member, or the team is deleted: the lookup finds no membership, and a developer is no exception
  ['developer, not a member', null, { none: [false, false], developer: [false, false], 'developer-and-superadmin': [false, false] }],
  ['superadmin, team deleted', null, { none: [false, false], developer: [false, false], 'developer-and-superadmin': [false, false] }],
]

afterEach(() => setSetting(undefined))

describe.each(CASES)('%s', (_name, userRow, expected) => {
  it.each(['none', 'developer', 'developer-and-superadmin'] as const)('teams.appRoleBypass = %s: same answers as checkPermission, from one membership query', async setting => {
    setSetting(setting)
    row = userRow
    queryOne.mockClear()
    queryOneWithRLS.mockClear()

    const context = await getDashboardPermissionContext()
    const got = [contextHasPermission(context, SENSITIVE), contextHasPermission(context, COMMON)]
    expect(got).toEqual(expected[setting])
    // A user with no membership resolves no team: the layouts skip the check, as before
    expect(context.teamId).toBe(userRow ? 'team-1' : null)
    // Deciding read nothing more: the team lookup is the only query so far
    expect(queryOne).toHaveBeenCalledTimes(1)
    expect(queryOneWithRLS).not.toHaveBeenCalled()

    const old = [await checkPermission('u1', 'team-1', SENSITIVE), await checkPermission('u1', 'team-1', COMMON)]
    expect(got).toEqual(old)
  })
})

it('the platform role is read from users.role in the same query, not from the session', async () => {
  row = { teamRole: 'member', appRole: 'developer' }
  queryOne.mockClear()
  await getDashboardPermissionContext()
  expect(queryOne.mock.calls[0][0]).toMatch(/u\.role AS "appRole"/)
  expect(queryOne.mock.calls[0][0]).toMatch(/LEFT JOIN "users" u ON u\.id = tm\."userId"/)
})

it('default setting is developer: a developer skips team permissions, a superadmin does not', async () => {
  setSetting(undefined)
  row = { teamRole: 'member', appRole: 'developer' }
  expect(contextHasPermission(await getDashboardPermissionContext(), SENSITIVE)).toBe(true)
  row = { teamRole: 'member', appRole: 'superadmin' }
  expect(contextHasPermission(await getDashboardPermissionContext(), SENSITIVE)).toBe(false)
})
