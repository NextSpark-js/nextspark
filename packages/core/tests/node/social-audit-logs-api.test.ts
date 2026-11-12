/**
 * social-media-publisher's audit-logs entity through core's real generic entity routes (fixtures/audit-logs-api), on a
 * throwaway cluster with core's migrations and the plugin's (#455). On the nextspark_app cutover a team's owner lists
 * and reads the team's rows and none of another team's; the API is read-only; a role without the permission, or a key
 * without the scope, is refused. The plugin's disconnect route writes its row with the request's team, and the list
 * shows it.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const FIXTURE = path.join(CORE, 'tests/node/fixtures/audit-logs-api')
const MIGRATIONS = path.join(CORE, '../../plugins/social-media-publisher/migrations')

type Step = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; key?: string; team?: string; body?: unknown }
type Row = { id: string; action: string; teamId: string; userId: string; accountId: string | null; details: { who?: string }; userAgent: string | null }
type Result = { method: string; path: string; status: number; body: { data?: Row | Row[]; code?: string } }

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
      DATABASE_URL: appUrl,
      DATABASE_SERVICE_URL: ownerUrl,
      BETTER_AUTH_SECRET: 'audit-logs-secret-0123456789abcdef01234',
      BETTER_AUTH_URL: 'http://localhost:5173',
      NEXT_PUBLIC_APP_URL: 'http://localhost:5173',
      DISABLE_RATE_LIMITING: 'true',
      AUDIT_LOGS_STEPS: JSON.stringify(steps),
    },
  })
  const results = run.stdout.split('\n').filter(l => l.startsWith('RESULT ')).map(l => JSON.parse(l.slice(7)) as Result)
  assert.equal(results.length, steps.length, `the driver ran every step\n${run.stdout}\n${run.stderr}`)
  return results
}

/** A real API key row for `userId`; returns the key as a client presents it. */
async function apiKey(owner: pg.Client, userId: string, scopes: string[]) {
  const key = `sk_test_${randomBytes(32).toString('hex')}`
  await owner.query(
    `INSERT INTO api_key ("keyHash", "keyPrefix", name, "userId", scopes) VALUES ($1, $2, 'test', $3, $4)`,
    [createHash('sha256').update(key).digest('hex'), key.slice(0, 16), userId, scopes],
  )
  return key
}

const list = (result: Result) => {
  assert.equal(result.status, 200, JSON.stringify(result))
  return (result.body.data as Row[]).map(row => row.details.who).sort()
}

test('audit-logs: the generic API lists and reads a team its own rows only, read-only, and the plugin writes the team (#455)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner, appUrl, ownerUrl } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('ua', 'a@example.test', 'A', 'member', true),
      ('ub', 'b@example.test', 'B', 'member', true),
      ('uv', 'v@example.test', 'V', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner'), ('team-a', 'uv', 'viewer');
  `)
  for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    await owner.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
  }
  const { rows: [a1, , b1] } = await owner.query<{ id: string }>(`
    INSERT INTO social_audit_logs ("userId", "teamId", action, details, "createdAt") VALUES
      ('ua', 'team-a', 'account_connected', '{"who": "a1"}', '2026-01-01T00:00:00Z'),
      ('uv', 'team-a', 'post_published', '{"who": "a2"}', '2026-01-02T00:00:00Z'),
      ('ub', 'team-b', 'post_failed', '{"who": "b1 team B secret"}', '2026-01-03T00:00:00Z')
    RETURNING id`)
  const { rows: [account] } = await owner.query<{ id: string }>(`
    INSERT INTO social_accounts ("userId", platform, "platformAccountId", username, "accessToken", "tokenExpiresAt")
    VALUES ('ua', 'facebook_page', 'page-1', 'Page One', 'encrypted:x:y', now() + interval '30 days') RETURNING id`)

  const keyA = await apiKey(owner, 'ua', ['audit-logs:read', 'social:write'])
  const keyB = await apiKey(owner, 'ub', ['audit-logs:read'])
  const keyViewer = await apiKey(owner, 'uv', ['audit-logs:read'])
  const keyNoScope = await apiKey(owner, 'ua', ['social:write'])
  const a = { key: keyA, team: 'team-a' }

  // 1. On the cutover (row-level security evaluated as the caller)
  const [listA, readA, readOther, otherTeam, listB, viewer, noScope, create, update, remove] = runSteps(appUrl, ownerUrl, [
    { method: 'GET', path: '/api/v1/audit-logs', ...a },
    { method: 'GET', path: `/api/v1/audit-logs/${a1.id}`, ...a },
    { method: 'GET', path: `/api/v1/audit-logs/${b1.id}`, ...a },
    { method: 'GET', path: '/api/v1/audit-logs', key: keyA, team: 'team-b' },
    { method: 'GET', path: '/api/v1/audit-logs', key: keyB, team: 'team-b' },
    { method: 'GET', path: '/api/v1/audit-logs', key: keyViewer, team: 'team-a' },
    { method: 'GET', path: '/api/v1/audit-logs', key: keyNoScope, team: 'team-a' },
    { method: 'POST', path: '/api/v1/audit-logs', ...a, body: { action: 'post_published' } },
    { method: 'PATCH', path: `/api/v1/audit-logs/${a1.id}`, ...a, body: { action: 'post_failed' } },
    { method: 'DELETE', path: `/api/v1/audit-logs/${a1.id}`, ...a },
  ])
  for (const result of [listA, readA, readOther, otherTeam, viewer, noScope, create, update, remove]) {
    assert.doesNotMatch(JSON.stringify(result.body), /team B secret/, `team B's row came back: ${JSON.stringify(result)}`)
  }
  // the team's rows, every member's (the entity is shared within the team)
  assert.deepEqual(list(listA), ['a1', 'a2'])
  assert.equal(readA.status, 200, JSON.stringify(readA))
  const row = readA.body.data as Row
  assert.equal(row.id, a1.id)
  assert.equal(row.action, 'account_connected')
  assert.equal(row.teamId, 'team-a')
  assert.ok('accountId' in row && 'ipAddress' in row && 'userAgent' in row && 'updatedAt' in row, JSON.stringify(row))
  assert.equal(readOther.status, 404, JSON.stringify(readOther))
  assert.equal(otherTeam.status, 403, JSON.stringify(otherTeam))
  assert.deepEqual(list(listB), ['b1 team B secret'])
  assert.equal(viewer.status, 403, JSON.stringify(viewer))
  assert.equal(viewer.body.code, 'PERMISSION_DENIED')
  assert.equal(noScope.status, 403, JSON.stringify(noScope))
  for (const write of [create, update, remove]) assert.equal(write.status, 405, JSON.stringify(write))
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM social_audit_logs`)).rows[0].n, 3)

  // 2. The plugin's disconnect route records the action in the request's team. It runs on the owner role: the
  //    plugin's social_accounts policies (001) read a setting the app never sets, so on the cutover the route does
  //    not find the account.
  const [disconnect] = runSteps(ownerUrl, ownerUrl, [
    { method: 'POST', path: '/api/plugins/social-media-publisher/social/disconnect', ...a, body: { accountId: account.id } },
  ])
  assert.equal(disconnect.status, 200, JSON.stringify(disconnect))
  const { rows: written } = await owner.query(`SELECT "userId", "teamId", "accountId", action, "userAgent" FROM social_audit_logs WHERE action = 'account_disconnected'`)
  assert.deepEqual(written, [{ userId: 'ua', teamId: 'team-a', accountId: account.id, action: 'account_disconnected', userAgent: 'audit-logs-test' }])
  const [listAfter, listBAfter] = runSteps(appUrl, ownerUrl, [
    { method: 'GET', path: '/api/v1/audit-logs', ...a },
    { method: 'GET', path: '/api/v1/audit-logs', key: keyB, team: 'team-b' },
  ])
  assert.equal((listAfter.body.data as Row[]).length, 3)
  assert.ok((listAfter.body.data as Row[]).some(r => r.action === 'account_disconnected' && r.accountId === account.id))
  assert.deepEqual(list(listBAfter), ['b1 team B secret'])

  // 3. The team publish, assign and the OAuth callback record their row in, on the cutover: the adapter's team when
  //    the user is in it; an adapter team the user is not in (team B for A) is not used, so the row is not refused
  //    by row-level security after the action (a 500 with the post already published), it goes to the request's team
  const [foreign, own, foreignNoHeader] = runSteps(appUrl, ownerUrl, [
    { method: 'POST', path: '/audit-team', ...a, body: { entityTeamId: 'team-b' } },
    { method: 'POST', path: '/audit-team', key: keyA, body: { entityTeamId: 'team-a' } },
    { method: 'POST', path: '/audit-team', key: keyA, body: { entityTeamId: 'team-b' } },
  ])
  assert.deepEqual([foreign.status, foreign.body], [200, { teamId: 'team-a' }], JSON.stringify(foreign))
  assert.deepEqual([own.status, own.body], [200, { teamId: 'team-a' }], JSON.stringify(own))
  // no header: the user's default team
  assert.deepEqual([foreignNoHeader.status, foreignNoHeader.body], [200, { teamId: 'team-a' }], JSON.stringify(foreignNoHeader))
  const { rows: recorded } = await owner.query(`SELECT "teamId", details->>'who' AS who FROM social_audit_logs WHERE details->>'who' LIKE 'adapter %' ORDER BY "createdAt"`)
  assert.deepEqual(recorded, [
    { teamId: 'team-a', who: 'adapter team-b' }, { teamId: 'team-a', who: 'adapter team-a' }, { teamId: 'team-a', who: 'adapter team-b' },
  ])
})
