/**
 * lib/permissions/role-check (#571): the roles-in-hand twin of checkPermission.
 *
 * For app role (user, developer, superadmin) x team role (owner, admin, member, viewer, none) x teams.appRoleBypass
 * (none, developer, developer-and-superadmin), the exported hasTeamPermission / teamPermissionsFor answer like
 * checkPermission, for an owner-only permission and a common one. ensureEntityPermissionsLoaded() is a no-op today
 * (deprecated); the test only checks that the exports call it, as checkPermission does.
 */
jest.mock('server-only', () => ({}))

let rows: Record<string, { teamRole: string | null; appRole: string }> = {}
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(async (_sql: string, params: string[]) => {
    const row = rows[params[0]]
    return row?.teamRole ? { role: row.teamRole, appRole: row.appRole } : null
  }),
}))

jest.mock('@/core/lib/permissions/init', () => ({
  ...jest.requireActual('@/core/lib/permissions/init'),
  ensureEntityPermissionsLoaded: jest.fn(),
}))

import { TEAMS_CONFIG } from '@/core/lib/config/config-client'
import { checkPermission } from '@/core/lib/permissions/check'
import { ensureEntityPermissionsLoaded } from '@/core/lib/permissions/init'
import {
  hasTeamPermission,
  teamPermissionsFor,
  appRoleSkipsTeamPermissions,
} from '@/core/lib/permissions/role-check'
import type { Permission } from '@/core/lib/permissions/types'
import pkg from '../../../../package.json'

const PERMS = ['team.delete', 'customers.read'] as Permission[] // owner only, and owner/admin/member in the mock registry
const APP_ROLES = ['user', 'developer', 'superadmin']
const TEAM_ROLES = ['owner', 'admin', 'member', 'viewer', null]
const SETTINGS = ['none', 'developer', 'developer-and-superadmin']
const ensure = ensureEntityPermissionsLoaded as jest.Mock

function setSetting(value: string | undefined) {
  const teams = TEAMS_CONFIG as unknown as Record<string, unknown>
  if (value === undefined) delete teams.appRoleBypass
  else teams.appRoleBypass = value
}

beforeEach(() => ensure.mockClear())
afterAll(() => setSetting(undefined))

describe.each(SETTINGS)('teams.appRoleBypass = %s', (setting) => {
  beforeEach(() => setSetting(setting))

  it.each(APP_ROLES.flatMap((a) => TEAM_ROLES.map((t) => [a, t] as const)))(
    'app role %s, team role %s: same answer as checkPermission',
    async (appRole, teamRole) => {
      rows = { u: { teamRole, appRole } }
      for (const p of PERMS) {
        const expected = await checkPermission('u', 'team-1', p)
        ensure.mockClear()
        expect(hasTeamPermission(appRole, teamRole, p)).toBe(expected)
        expect(ensure).toHaveBeenCalled()
        ensure.mockClear()
        expect(teamPermissionsFor(appRole, teamRole).includes(p)).toBe(expected)
        expect(ensure).toHaveBeenCalled()
      }
      expect(appRoleSkipsTeamPermissions(appRole)).toBe(
        setting === 'developer-and-superadmin' ? appRole !== 'user' : setting === 'developer' && appRole === 'developer'
      )
    }
  )

  it('no team role: no permission, whatever the app role', () => {
    for (const a of APP_ROLES) expect(hasTeamPermission(a, null, PERMS[1])).toBe(false)
  })
})

it('the matrix is not trivially false: the bypass grants the owner-only permission, a member does not hold it', () => {
  setSetting('developer')
  expect(hasTeamPermission('developer', 'member', PERMS[0])).toBe(true)
  expect(hasTeamPermission('user', 'member', PERMS[0])).toBe(false)
  expect(hasTeamPermission('user', 'owner', PERMS[0])).toBe(true)
})

it('is published: ./lib/permissions/role-check is in exports and points at the dist', () => {
  const entry = (pkg.exports as Record<string, Record<string, string>>)['./lib/permissions/role-check']
  expect(entry).toEqual({
    types: './dist/lib/permissions/role-check.d.ts',
    import: './dist/lib/permissions/role-check.js',
    default: './dist/lib/permissions/role-check.js',
  })
})
