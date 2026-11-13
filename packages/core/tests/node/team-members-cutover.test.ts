/**
 * #458 on the nextspark_app cutover: the member and invitation routes, through core's real route modules
 * (fixtures/team-members/driver.mts), against a throwaway cluster with core's migrations.
 *
 * The RLS policies of team_members (auth_can_manage_member) and team_invitations know team roles only, not
 * teams.appRoleBypass. A developer who is a `member` of a team skips team permissions by default, so the routes allow
 * them to change a role, remove a member and cancel an invitation: each write must change its one row (the routes run
 * it on the service connection after their checks). A plain `member` is still refused with 403 and changes nothing.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const FIXTURE = path.join(CORE, 'tests/node/fixtures/team-members')

type Step =
  | { method: 'PATCH' | 'DELETE'; path: string; key: string; body?: unknown }
  | { method: 'CALL'; path: 'remove' | 'updateRole'; args: string[]; service: boolean }
type Result = { method: string; path: string; status: number; body: { data?: unknown; code?: string; error?: string } }

function runSteps(appUrl: string, ownerUrl: string, steps: Step[]): Result[] {
  const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(FIXTURE, 'driver.mts')], {
    cwd: CORE,
    encoding: 'utf8',
    timeout: 120000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TSX_TSCONFIG_PATH: path.join(FIXTURE, 'tsconfig.json'),
      // the routes run on the app pool (RLS evaluated); auth and the post-check writes use the service pool
      DATABASE_URL: appUrl,
      DATABASE_SERVICE_URL: ownerUrl,
      BETTER_AUTH_SECRET: 'team-members-secret-0123456789abcdef0123',
      BETTER_AUTH_URL: 'http://localhost:5173',
      NEXT_PUBLIC_APP_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      TEAM_MEMBERS_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

async function apiKey(owner: pg.Client, userId: string) {
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', $3, $4)`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16), userId, ['teams:read', 'teams:write']],
  )
  return key
}

test('#458 cutover: a developer member manages members and invitations, a plain member cannot', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)

  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('uo', 'o@example.test', 'Owner', 'member', true),
      ('ud', 'd@example.test', 'Developer', 'developer', true),
      ('um', 'm@example.test', 'Member', 'member', true),
      ('ta', 'ta@example.test', 'Target admin', 'member', true),
      ('tm', 'tm@example.test', 'Target member', 'member', true),
      ('tr', 'tr@example.test', 'Target removed', 'member', true),
      ('tx', 'tx@example.test', 'Target kept', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'Team', 'team-1', 'uo');
    INSERT INTO team_members (id, "teamId", "userId", role) VALUES
      ('m-uo', 'team-1', 'uo', 'owner'),
      ('m-ud', 'team-1', 'ud', 'member'),
      ('m-um', 'team-1', 'um', 'member'),
      ('m-ta', 'team-1', 'ta', 'admin'),
      ('m-tm', 'team-1', 'tm', 'member'),
      ('m-tr', 'team-1', 'tr', 'member'),
      ('m-tx', 'team-1', 'tx', 'admin');
    INSERT INTO team_invitations (id, "teamId", email, role, "invitedBy") VALUES
      ('inv-1', 'team-1', 'new1@example.test', 'member', 'uo'),
      ('inv-2', 'team-1', 'new2@example.test', 'member', 'uo');
  `)
  const developer = await apiKey(owner, 'ud')
  const member = await apiKey(owner, 'um')
  const roleOf = async (id: string) => (await owner.query(`SELECT role FROM team_members WHERE id = $1`, [id])).rows[0]?.role ?? null
  const invitation = async (id: string) => (await owner.query(`SELECT id FROM team_invitations WHERE id = $1`, [id])).rowCount

  // A plain member first: refused, nothing changes
  const memberResults = runSteps(appUrl, ownerUrl, [
    { method: 'PATCH', path: '/api/v1/teams/team-1/members/m-tx', key: member, body: { role: 'member' } },
    { method: 'PATCH', path: '/api/v1/teams/team-1/members/m-tm', key: member, body: { role: 'viewer' } },
    { method: 'DELETE', path: '/api/v1/teams/team-1/members/m-tr', key: member },
    { method: 'DELETE', path: '/api/v1/teams/team-1/invitations?id=inv-2', key: member },
  ])
  for (const result of memberResults) assert.equal(result.status, 403, JSON.stringify(result))
  assert.equal(await roleOf('m-tx'), 'admin')
  assert.equal(await roleOf('m-tm'), 'member')
  assert.equal(await roleOf('m-tr'), 'member')
  assert.equal(await invitation('inv-2'), 1)

  // The developer member (teams.appRoleBypass defaults to 'developer'): every write changes its row
  const [demote, toViewer, remove, cancel] = runSteps(appUrl, ownerUrl, [
    { method: 'PATCH', path: '/api/v1/teams/team-1/members/m-ta', key: developer, body: { role: 'member' } },
    { method: 'PATCH', path: '/api/v1/teams/team-1/members/m-tm', key: developer, body: { role: 'viewer' } },
    { method: 'DELETE', path: '/api/v1/teams/team-1/members/m-tr', key: developer },
    { method: 'DELETE', path: '/api/v1/teams/team-1/invitations?id=inv-1', key: developer },
  ])
  for (const result of [demote, toViewer, remove, cancel]) assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(await roleOf('m-ta'), 'member')
  assert.equal(await roleOf('m-tm'), 'viewer')
  assert.equal(await roleOf('m-tr'), null)
  assert.equal(await invitation('inv-1'), 0)

  // The hierarchy still holds for them: never the owner
  const [removeOwner] = runSteps(appUrl, ownerUrl, [{ method: 'DELETE', path: '/api/v1/teams/team-1/members/m-uo', key: developer }])
  assert.equal(removeOwner.status, 403, JSON.stringify(removeOwner))
  assert.equal(await roleOf('m-uo'), 'owner')
})

test('#458 cutover: TeamMemberService.remove and updateRole (the actions\' writes) report a write RLS refused, and the service connection makes it', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('uo', 'o@example.test', 'Owner', 'member', true),
      ('ud', 'd@example.test', 'Developer', 'developer', true),
      ('ta', 'ta@example.test', 'Target admin', 'member', true),
      ('tr', 'tr@example.test', 'Target removed', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'Team', 'team-1', 'uo');
    INSERT INTO team_members (id, "teamId", "userId", role) VALUES
      ('m-uo', 'team-1', 'uo', 'owner'), ('m-ud', 'team-1', 'ud', 'member'),
      ('m-ta', 'team-1', 'ta', 'admin'), ('m-tr', 'team-1', 'tr', 'member');
  `)
  const roleOf = async (id: string) => (await owner.query(`SELECT role FROM team_members WHERE id = $1`, [id])).rows[0]?.role ?? null

  const [rlsRemove, rlsUpdate, serviceRemove, serviceUpdate] = runSteps(appUrl, ownerUrl, [
    { method: 'CALL', path: 'remove', args: ['team-1', 'tr', 'ud'], service: false },
    { method: 'CALL', path: 'updateRole', args: ['team-1', 'ta', 'member', 'ud'], service: false },
    { method: 'CALL', path: 'remove', args: ['team-1', 'tr', 'ud'], service: true },
    { method: 'CALL', path: 'updateRole', args: ['team-1', 'ta', 'member', 'ud'], service: true },
  ])
  // RLS (team roles only) refuses the member developer: zero rows is an error, not a silent success
  assert.deepEqual([rlsRemove.status, rlsRemove.body.error], [500, 'Team member not found'])
  assert.deepEqual([rlsUpdate.status, rlsUpdate.body.error], [500, 'Team member not found'])
  // After the actions' checks, on the service connection: one row each
  assert.equal(serviceRemove.status, 200, JSON.stringify(serviceRemove))
  assert.equal(serviceUpdate.status, 200, JSON.stringify(serviceUpdate))
  assert.equal(await roleOf('m-tr'), null)
  assert.equal(await roleOf('m-ta'), 'member')
})
