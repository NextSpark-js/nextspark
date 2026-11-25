/**
 * lib/permissions/role-check (#571): the roles-in-hand twin of checkPermission.
 *
 * For app role (user, developer, superadmin) x team role (owner, admin, member, viewer, none) x teams.appRoleBypass
 * (none, developer, developer-and-superadmin), the exported hasTeamPermission / teamPermissionsFor answer like
 * checkPermission, for a permission that only exists once ensureEntityPermissionsLoaded() has run. The mock of that
 * function registers it, so a decision made without calling it is a failure.
 */
jest.mock('server-only', () => ({}))

let rows: Record<string, { teamRole: string | null; appRole: string }> = {}
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(async (_sql: string, params: string[]) => {
    const row = rows[params[0]]
    return row?.teamRole ? { role: row.teamRole, appRole: row.appRole } : null
  }),
}))

const LAZY = 'lazyentity.read'
jest.mock('@/core/lib/permissions/init', () => {
  const registry = jest.requireActual('@nextsparkjs/registries/permissions-registry')
  return {
    ...jest.requireActual('@/core/lib/permissions/init'),
    ensureEntityPermissionsLoaded: jest.fn(() => {
      // A lazily registered permission: admin (and owner) hold it, member and viewer do not
      if (!registry.ALL_PERMISSIONS_SET.has('lazyentity.read')) {
        registry.ALL_PERMISSIONS.push('lazyentity.read')
        registry.ALL_PERMISSIONS_SET.add('lazyentity.read')
        registry.PERMISSIONS_BY_ROLE.admin.add('lazyentity.read')
        registry.ROLE_PERMISSIONS_ARRAY.admin.push('lazyentity.read')
      }
    }),
  }
})

import { TEAMS_CONFIG } from '@/core/lib/config/config-client'
import { checkPermission } from '@/core/lib/permissions/check'
import { ensureEntityPermissionsLoaded } from '@/core/lib/permissions/init'
import {
  hasTeamPermission,
  teamPermissionsFor,
  appRoleSkipsTeamPermissions,
} from '@/core/lib/permissions/role-check'
import type { Permission } from '@/core/lib/permissions/types'
import * as registry from '@nextsparkjs/registries/permissions-registry'
import pkg from '../../../../package.json'

const P = LAZY as Permission
const APP_ROLES = ['user', 'developer', 'superadmin']
const TEAM_ROLES = ['owner', 'admin', 'member', 'viewer', null]
const SETTINGS = ['none', 'developer', 'developer-and-superadmin']
const ensure = ensureEntityPermissionsLoaded as jest.Mock

function setSetting(value: string | undefined) {
  const teams = TEAMS_CONFIG as unknown as Record<string, unknown>
  if (value === undefined) delete teams.appRoleBypass
  else teams.appRoleBypass = value
}

/** Back to "entities not loaded yet", and forget the calls so far. */
function reset() {
  if (registry.ALL_PERMISSIONS_SET.has(LAZY)) {
    registry.ALL_PERMISSIONS.splice(registry.ALL_PERMISSIONS.indexOf(LAZY), 1)
    registry.ALL_PERMISSIONS_SET.delete(LAZY)
    registry.PERMISSIONS_BY_ROLE.admin.delete(LAZY)
    registry.ROLE_PERMISSIONS_ARRAY.admin = registry.ROLE_PERMISSIONS_ARRAY.admin.filter((p: string) => p !== LAZY)
  }
  ensure.mockClear()
}

beforeEach(reset)
afterAll(() => setSetting(undefined))

describe.each(SETTINGS)('teams.appRoleBypass = %s', (setting) => {
  beforeEach(() => setSetting(setting))

  it.each(APP_ROLES.flatMap((a) => TEAM_ROLES.map((t) => [a, t] as const)))(
    'app role %s, team role %s: same answer as checkPermission',
    async (appRole, teamRole) => {
      rows = { u: { teamRole, appRole } }
      const expected = await checkPermission('u', 'team-1', P)

      reset()
      expect(hasTeamPermission(appRole, teamRole, P)).toBe(expected)
      expect(ensure).toHaveBeenCalled()

      reset()
      expect(teamPermissionsFor(appRole, teamRole).includes(P)).toBe(expected)
      expect(ensure).toHaveBeenCalled()

      expect(appRoleSkipsTeamPermissions(appRole)).toBe(
        setting === 'developer-and-superadmin' ? appRole !== 'user' : setting === 'developer' && appRole === 'developer'
      )
    }
  )

  it('no team role: no permission, whatever the app role', () => {
    for (const a of APP_ROLES) expect(hasTeamPermission(a, null, P)).toBe(false)
  })
})

it('the matrix is not trivially false: an admin holds the lazy permission, a member does not', () => {
  setSetting('none')
  expect(hasTeamPermission('user', 'admin', P)).toBe(true)
  expect(hasTeamPermission('user', 'member', P)).toBe(false)
})

it('is published: ./lib/permissions/role-check is in exports and points at the dist', () => {
  const entry = (pkg.exports as Record<string, Record<string, string>>)['./lib/permissions/role-check']
  expect(entry).toEqual({
    types: './dist/lib/permissions/role-check.d.ts',
    import: './dist/lib/permissions/role-check.js',
    default: './dist/lib/permissions/role-check.js',
  })
})
