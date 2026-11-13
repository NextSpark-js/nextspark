/**
 * teams.appRoleBypass: which app roles skip team permissions (#457).
 *
 * For each value of the setting, every server check (checkPermission, checkTeamPermission, MembershipService) and
 * the UI hook (usePermission) give the same answer for an owner, an admin, a member, a developer and a superadmin,
 * for a sensitive permission (owner-only in the registry mock) and a common one. The expected answers are written
 * out here, not derived from the code under test.
 */
import { renderHook } from '@testing-library/react'

jest.mock('server-only', () => ({}))

// One row per (userId, teamId): the team role and the app role the DB would return
let rows: Record<string, { teamRole: string | null; appRole: string }> = {}
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(async (sql: string, params: string[]) => {
    if (sql.includes('"team_members"')) {
      const row = rows[params[0]]
      return row?.teamRole ? { role: row.teamRole, appRole: row.appRole } : null
    }
    return rows[params[0]] ? { role: rows[params[0]].appRole } : null
  }),
}))
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: {
    getByTeamAndUser: async (_teamId: string, userId: string) =>
      rows[userId]?.teamRole ? { role: rows[userId].teamRole } : null,
  },
}))
jest.mock('@/core/lib/services/subscription.service', () => ({ SubscriptionService: { getActive: async () => null } }))
jest.mock('@/core/lib/services/plan.service', () => ({ PlanService: {} }))

let teamContext: { currentTeam: { id: string } | null; userTeams: unknown[]; appRole: string | null }
jest.mock('@/core/contexts/TeamContext', () => ({
  useTeamContext: () => teamContext,
  useOptionalTeamContext: () => teamContext,
}))

import { TEAMS_CONFIG } from '@/core/lib/config/config-client'
import {
  resolveAppRoleBypass,
  getAppRoleBypass,
  hasTeamPermission,
} from '@/core/lib/permissions/app-role-bypass'
import { checkPermission, getUserPermissions } from '@/core/lib/permissions/check'
import { checkTeamPermission } from '@/core/lib/teams/permissions'
import { MembershipService } from '@/core/lib/services/membership.service'
import { usePermission, useAllPermissions } from '@/core/lib/permissions/hooks'
import type { Permission } from '@/core/lib/permissions/types'

const TEAM = 'team-1'
const SENSITIVE = 'team.delete' as Permission // owner only in the registry mock
const COMMON = 'customers.read' as Permission // owner, admin, member

type Setting = 'none' | 'developer' | 'developer-and-superadmin' | undefined

function setSetting(value: unknown) {
  const teams = TEAMS_CONFIG as unknown as Record<string, unknown>
  if (value === undefined) delete teams.appRoleBypass
  else teams.appRoleBypass = value
}

const USERS = {
  owner: { teamRole: 'owner', appRole: 'member' },
  admin: { teamRole: 'admin', appRole: 'member' },
  member: { teamRole: 'member', appRole: 'member' },
  'developer (team admin)': { teamRole: 'admin', appRole: 'developer' },
  'developer (team member)': { teamRole: 'member', appRole: 'developer' },
  'superadmin (team member)': { teamRole: 'member', appRole: 'superadmin' },
  'superadmin (not a member)': { teamRole: null, appRole: 'superadmin' },
} as const
type UserKey = keyof typeof USERS

// [sensitive, common] per user, for each setting. `undefined` (no setting) must equal 'developer'.
const T = true
const F = false
const BASE: Record<UserKey, [boolean, boolean]> = {
  owner: [T, T],
  admin: [F, T],
  member: [F, T],
  'developer (team admin)': [F, T],
  'developer (team member)': [F, T],
  'superadmin (team member)': [F, T],
  'superadmin (not a member)': [F, F],
}
const EXPECTED: Record<Exclude<Setting, undefined>, Record<UserKey, [boolean, boolean]>> = {
  none: BASE,
  developer: { ...BASE, 'developer (team admin)': [T, T], 'developer (team member)': [T, T] },
  'developer-and-superadmin': {
    ...BASE,
    'developer (team admin)': [T, T],
    'developer (team member)': [T, T],
    'superadmin (team member)': [T, T],
  },
}

async function serverAnswers(user: UserKey, permission: Permission) {
  rows = { [user]: USERS[user] }
  const { teamRole, appRole } = USERS[user]
  const membership = await MembershipService.get(user, TEAM)
  return {
    checkPermission: await checkPermission(user, TEAM, permission),
    checkTeamPermission: checkTeamPermission(appRole as never, teamRole, permission as never),
    membership: membership.hasPermission(permission),
    getUserPermissions: (await getUserPermissions(user, TEAM)).includes(permission),
  }
}

function uiAnswers(user: UserKey, permission: Permission) {
  const { teamRole, appRole } = USERS[user]
  teamContext = {
    currentTeam: { id: TEAM },
    userTeams: teamRole ? [{ team: { id: TEAM }, role: teamRole }] : [],
    appRole,
  }
  return {
    usePermission: renderHook(() => usePermission(permission)).result.current,
    useAllPermissions: renderHook(() => useAllPermissions()).result.current.includes(permission),
  }
}

afterAll(() => setSetting(undefined))

describe.each<Setting>(['none', 'developer', 'developer-and-superadmin', undefined])(
  'teams.appRoleBypass = %s',
  (setting) => {
    beforeEach(() => setSetting(setting))
    const expected = EXPECTED[setting ?? 'developer']

    describe.each(Object.keys(USERS) as UserKey[])('%s', (user) => {
      it.each([
        ['sensitive', SENSITIVE, 0],
        ['common', COMMON, 1],
      ] as const)('%s permission: the server and the UI agree', async (_label, permission, i) => {
        const want = expected[user][i]
        const server = await serverAnswers(user, permission)
        const ui = uiAnswers(user, permission)
        expect({ ...server, ...ui }).toEqual({
          checkPermission: want,
          checkTeamPermission: want,
          membership: want,
          getUserPermissions: want,
          usePermission: want,
          useAllPermissions: want,
        })
      })
    })
  }
)

describe('the setting', () => {
  afterEach(() => setSetting(undefined))

  it('defaults to developer when not set', () => {
    setSetting(undefined)
    expect(getAppRoleBypass()).toBe('developer')
    expect(resolveAppRoleBypass(undefined)).toBe('developer')
    expect(hasTeamPermission('developer', 'member', SENSITIVE)).toBe(true)
    expect(hasTeamPermission('superadmin', 'member', SENSITIVE)).toBe(false)
  })

  it.each(['superadmin', 'all', '', null, ['developer'], true])('rejects %p with a clear error', (value) => {
    expect(() => resolveAppRoleBypass(value)).toThrow(
      /teams\.appRoleBypass in app\.config must be one of 'none', 'developer', 'developer-and-superadmin'; got /
    )
    setSetting(value)
    expect(() => hasTeamPermission('member', 'member', COMMON)).toThrow(/teams\.appRoleBypass/)
  })

  it('an invalid value makes the server check fail, not grant', async () => {
    setSetting('superadmin')
    rows = { u: { teamRole: 'member', appRole: 'superadmin' } }
    await expect(checkPermission('u', TEAM, SENSITIVE)).rejects.toThrow(/teams\.appRoleBypass/)
  })

  it('MembershipService.get carries the app role, for the role-hierarchy checks of the member routes (#458)', async () => {
    rows = { u: { teamRole: 'member', appRole: 'developer' } }
    expect((await MembershipService.get('u', TEAM)).appRole).toBe('developer')
  })

  it('an unregistered permission is not granted to a skipping app role', () => {
    setSetting('developer-and-superadmin')
    expect(hasTeamPermission('developer', 'member', 'nope.nothing' as Permission)).toBe(false)
  })
})
