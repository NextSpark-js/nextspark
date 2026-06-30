/**
 * Tests for the declarative team-role model at the build layer.
 *
 * Model: `teams.roles` (app.config) is the AUTHORITATIVE, declarative set of NON-OWNER
 * roles. When present it REPLACES the defaults; when absent the set is base roles +
 * theme custom roles (permissions.config). 'owner' is ALWAYS force-included.
 *
 * Covers the real production code paths:
 *  - computeTeamRoleConfig() : the pure build-time role-set computation
 *  - parseTeamRolesFromAppConfig() : the app.config.ts teams.roles parser
 *  - generatePermissionsRegistry() : asserts the EMITTED literals
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/team-roles.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { computeTeamRoleConfig, generatePermissionsRegistry } from '../generators/permissions-registry.mjs'
import { parseTeamRolesFromAppConfig } from '../discovery/permissions.mjs'

// ---------------------------------------------------------------------------
// computeTeamRoleConfig — the pure build-time computation
// ---------------------------------------------------------------------------

test('no config → default = base non-owner roles + owner (no regression)', () => {
  const r = computeTeamRoleConfig({})
  assert.deepEqual(r.availableRoles, ['owner', 'admin', 'member', 'viewer'])
  assert.equal(r.defaultTeamRole, 'member')
  assert.equal(r.customRolesCount, 0)
  assert.deepEqual(r.coreTeamRoles, ['owner'])
  assert.equal(r.hierarchy.owner, 100)
})

test('no teamRoles override → base + permissions.config custom roles (default theme shape)', () => {
  const r = computeTeamRoleConfig({
    rolesConfig: { additionalRoles: ['editor'], hierarchy: { editor: 40 } },
  })
  assert.deepEqual(r.availableRoles, ['owner', 'admin', 'member', 'viewer', 'editor'])
  assert.equal(r.hierarchy.editor, 40)
  assert.equal(r.customRolesCount, 1)
  assert.equal(r.defaultTeamRole, 'member')
})

test('teamRoles REPLACES the whole set (owner forced, everything else dropped)', () => {
  const r = computeTeamRoleConfig({
    rolesConfig: { additionalRoles: ['editor'] }, // defined but NOT selected → excluded
    teamRolesConfig: { teamRoles: ['test1', 'test2'] },
  })
  assert.deepEqual(r.availableRoles, ['owner', 'test1', 'test2'])
  assert.equal(r.availableRoles.includes('admin'), false)
  assert.equal(r.availableRoles.includes('member'), false)
  assert.equal(r.availableRoles.includes('viewer'), false)
  assert.equal(r.availableRoles.includes('editor'), false)
  // default falls back to first non-owner since 'member' is not in the set
  assert.equal(r.defaultTeamRole, 'test1')
})

test("'owner' is ALWAYS present and force-deduped", () => {
  assert.deepEqual(computeTeamRoleConfig({ teamRolesConfig: { teamRoles: ['admin'] } }).availableRoles, ['owner', 'admin'])
  assert.deepEqual(computeTeamRoleConfig({ teamRolesConfig: { teamRoles: ['owner', 'admin'] } }).availableRoles, ['owner', 'admin'])
})

test('empty teamRoles → owner-only team', () => {
  const r = computeTeamRoleConfig({ teamRolesConfig: { teamRoles: [] } })
  assert.deepEqual(r.availableRoles, ['owner'])
  assert.equal(r.defaultTeamRole, 'owner')
})

test('selected custom role keeps its permissions.config metadata', () => {
  const r = computeTeamRoleConfig({
    rolesConfig: { additionalRoles: ['editor'], hierarchy: { editor: 40 }, displayNames: { editor: 'common.teamRoles.editor' } },
    teamRolesConfig: { teamRoles: ['admin', 'editor'] },
  })
  assert.deepEqual(r.availableRoles, ['owner', 'admin', 'editor'])
  assert.equal(r.hierarchy.editor, 40)
  assert.equal(r.displayNames.editor, 'common.teamRoles.editor')
})

test('Campus-style: select admin + teacher + coach (drop member/viewer)', () => {
  const r = computeTeamRoleConfig({
    rolesConfig: { additionalRoles: ['teacher', 'coach'], hierarchy: { teacher: 30, coach: 20 } },
    teamRolesConfig: { teamRoles: ['admin', 'teacher', 'coach'], defaultTeamRole: 'coach' },
  })
  assert.deepEqual(r.availableRoles, ['owner', 'admin', 'teacher', 'coach'])
  assert.equal(r.defaultTeamRole, 'coach')
  assert.equal(r.hierarchy.teacher, 30)
})

test('explicit defaultTeamRole outside the set falls back to a valid role', () => {
  const r = computeTeamRoleConfig({ teamRolesConfig: { teamRoles: ['admin', 'lead'], defaultTeamRole: 'ghost' } })
  assert.equal(r.availableRoles.includes('ghost'), false)
  assert.ok(r.availableRoles.includes(r.defaultTeamRole))
})

test('non-owner hierarchy is capped below 100; owner pinned at 100', () => {
  const r = computeTeamRoleConfig({
    rolesConfig: { additionalRoles: ['big'], hierarchy: { big: 250 } },
    teamRolesConfig: { teamRoles: ['big'] },
  })
  assert.equal(r.hierarchy.big, 99)
  assert.equal(r.hierarchy.owner, 100)
})

// ---------------------------------------------------------------------------
// parseTeamRolesFromAppConfig — the app.config.ts parser
// ---------------------------------------------------------------------------

test('teams.roles array form → authoritative teamRoles set', () => {
  const parsed = parseTeamRolesFromAppConfig(`teams: { mode: 'multi-tenant', roles: ['admin', 'editor'] }`)
  assert.deepEqual(parsed, { teamRoles: ['admin', 'editor'] })
})

test('teams.roles array form strips owner (always forced by the generator)', () => {
  const parsed = parseTeamRolesFromAppConfig(`teams: { roles: ['owner', 'admin'] }`)
  assert.deepEqual(parsed, { teamRoles: ['admin'] })
})

test('teams.roles array form + sibling defaultTeamRole (Campus shape, options nested)', () => {
  const content = `
  teams: {
    mode: 'multi-tenant' as const,
    options: {
      maxMembersPerTeam: 100000,
      allowLeaveTeam: false,
      allowCreateTeams: false,
    },
    roles: ['admin', 'teacher', 'coach', 'student'],
    defaultTeamRole: 'student',
  },`
  const parsed = parseTeamRolesFromAppConfig(content)
  assert.deepEqual(parsed.teamRoles, ['admin', 'teacher', 'coach', 'student'])
  assert.equal(parsed.defaultTeamRole, 'student')
})

test('teams without a roles key → null (generator uses the default set)', () => {
  const content = `
  teams: {
    mode: 'multi-tenant' as const,
    options: { maxMembersPerTeam: 50 },
  },`
  assert.equal(parseTeamRolesFromAppConfig(content), null)
})

test('a teams.availableTeamRoles sibling (not teams.roles) does NOT match (case-sensitive)', () => {
  const content = `
  teams: {
    mode: 'multi-tenant',
    availableTeamRoles: ['owner', 'admin', 'teacher'],
  },`
  assert.equal(parseTeamRolesFromAppConfig(content), null)
})

test('teams.roles object form parses the set + defaultTeamRole', () => {
  const content = `
  teams: {
    mode: 'multi-tenant',
    roles: {
      availableTeamRoles: ['admin', 'editor'],
      defaultTeamRole: 'editor',
    },
  },`
  const parsed = parseTeamRolesFromAppConfig(content)
  assert.deepEqual(parsed.teamRoles, ['admin', 'editor'])
  assert.equal(parsed.defaultTeamRole, 'editor')
})

// ---------------------------------------------------------------------------
// generatePermissionsRegistry — assert the EMITTED literals (the real output)
// ---------------------------------------------------------------------------

const readRoles = (out) => JSON.parse(out.match(/export const AVAILABLE_ROLES: readonly string\[\] = (\[[^\]]*\])/)[1])

test('generated registry: teamRoles REPLACES the set', async () => {
  const out = await generatePermissionsRegistry(
    { themeName: 'test', importPath: 'x', entities: {}, teams: [], features: [],
      roles: { additionalRoles: ['editor'] }, teamRoles: { teamRoles: ['test1', 'test2'] } },
    [], { outputDir: '/tmp/nextspark-test', isNpmMode: false },
  )
  assert.deepEqual(readRoles(out), ['owner', 'test1', 'test2'])
  assert.match(out, /export const DEFAULT_TEAM_ROLE: string = "test1"/)
})

test('generated registry: no teamRoles → base + custom (no regression)', async () => {
  const out = await generatePermissionsRegistry(
    { themeName: 'test', importPath: 'x', entities: {}, teams: [], features: [],
      roles: { additionalRoles: ['editor'] }, teamRoles: null },
    [], { outputDir: '/tmp/nextspark-test', isNpmMode: false },
  )
  assert.deepEqual(readRoles(out), ['owner', 'admin', 'member', 'viewer', 'editor'])
  assert.match(out, /export const DEFAULT_TEAM_ROLE: string = "member"/)
})
