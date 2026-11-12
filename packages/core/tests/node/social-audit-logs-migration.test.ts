/**
 * social-media-publisher's audit log table on a throwaway cluster with core's migrations (#455): a database in the
 * old state (the plugin's 001 and 002, "audit_logs" with rows) gets the table renamed to "social_audit_logs" by 003,
 * with its rows, indexes, constraints, policies and grants, and running 003 again changes nothing. Then 004 gives it
 * "teamId" (backfilled from the user's only team) and "updatedAt", and team-isolation policies that apply to the
 * nextspark_app runtime role; running 004 again changes nothing.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { CORE, HAS_POSTGRES, asUser, cutoverDatabase } from './_pg-cutover'

const MIGRATIONS = path.join(CORE, '../../plugins/social-media-publisher/migrations')
const migration = (prefix: string) => {
  const file = fs.readdirSync(MIGRATIONS).find(f => f.startsWith(prefix))
  assert.ok(file, `the plugin has a ${prefix} migration`)
  return fs.readFileSync(path.join(MIGRATIONS, file), 'utf8')
}

/** The names of the table's indexes, constraints and policies, and the runtime role's grants on it. */
async function objects(owner: pg.Client, table: string) {
  const names = async (sql: string) => (await owner.query(sql, [table])).rows.map(r => r.name).sort()
  return {
    indexes: await names(`SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`),
    constraints: await names(`SELECT conname AS name FROM pg_constraint WHERE conrelid = ('public.' || quote_ident($1))::regclass`),
    policies: await names(`SELECT policyname AS name FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`),
    grants: await names(`SELECT privilege_type AS name FROM information_schema.role_table_grants WHERE grantee = 'nextspark_app' AND table_name = $1`),
  }
}

test('social-media-publisher 003 renames audit_logs to social_audit_logs with its rows and objects, and runs twice (#455)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('ua', 'a@example.test', 'A', 'member', true);
  `)
  await owner.query(migration('001_'))
  await owner.query(migration('002_'))
  await owner.query(`
    INSERT INTO audit_logs ("userId", action, details) VALUES ('ua', 'account_connected', '{"n": 1}'), ('ua', 'post_published', '{"n": 2}');
  `)

  await owner.query(migration('003_'))
  assert.equal((await owner.query(`SELECT to_regclass('public.audit_logs') AS t`)).rows[0].t, null)
  assert.deepEqual((await owner.query(`SELECT action, details->>'n' AS n FROM social_audit_logs ORDER BY 2`)).rows, [
    { action: 'account_connected', n: '1' }, { action: 'post_published', n: '2' },
  ])
  const renamed = await objects(owner, 'social_audit_logs')
  assert.deepEqual(renamed.indexes, [
    'idx_social_audit_logs_account_action', 'idx_social_audit_logs_action_created', 'idx_social_audit_logs_created_desc',
    'idx_social_audit_logs_user_created', 'social_audit_logs_pkey',
  ])
  assert.deepEqual(renamed.constraints, ['social_audit_logs_action_check', 'social_audit_logs_pkey', 'social_audit_logs_userId_fkey'])
  assert.deepEqual(renamed.policies, ['social_audit_logs_delete_admin', 'social_audit_logs_insert_system', 'social_audit_logs_select_own'])
  assert.deepEqual(renamed.grants, ['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
  // the CHECK on action still applies under its new name
  await assert.rejects(owner.query(`INSERT INTO social_audit_logs ("userId", action) VALUES ('ua', 'nope')`), /social_audit_logs_action_check/)

  // twice: nothing changes
  await owner.query(migration('003_'))
  assert.deepEqual(await objects(owner, 'social_audit_logs'), renamed)
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM social_audit_logs`)).rows[0].n, 2)

  // an "audit_logs" beside "social_audit_logs" (one with the plugin's columns) is left alone
  await owner.query(`CREATE TABLE audit_logs (LIKE social_audit_logs)`)
  await owner.query(migration('003_'))
  assert.notEqual((await owner.query(`SELECT to_regclass('public.audit_logs') AS t`)).rows[0].t, null)
  assert.deepEqual(await objects(owner, 'social_audit_logs'), renamed)
  await owner.query(`DROP TABLE audit_logs`)

  // an "audit_logs" that is not the plugin's is left alone, with or without a "social_audit_logs" beside it
  await owner.query(`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, what TEXT)`)
  await owner.query(migration('003_'))
  await owner.query(`ALTER TABLE social_audit_logs RENAME TO aside`)
  await owner.query(migration('003_'))
  assert.equal((await owner.query(`SELECT to_regclass('public.social_audit_logs') AS t`)).rows[0].t, null)
  await owner.query(`ALTER TABLE aside RENAME TO social_audit_logs`)
  assert.deepEqual((await owner.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY 1`)).rows.map(r => r.column_name), ['id', 'what'])
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM social_audit_logs`)).rows[0].n, 2)
})

test('social-media-publisher 004 adds teamId and updatedAt, backfills teamId, and isolates teams on the cutover; it runs twice (#455)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('ua', 'a@example.test', 'A', 'member', true),
      ('ub', 'b@example.test', 'B', 'member', true),
      ('um', 'm@example.test', 'M', 'member', true),
      ('super', 's@example.test', 'S', 'superadmin', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'ua'), ('team-b', 'Team B', 'team-b', 'ub');
    INSERT INTO team_members ("teamId", "userId", role) VALUES
      ('team-a', 'ua', 'owner'), ('team-b', 'ub', 'owner'), ('team-a', 'um', 'admin'), ('team-b', 'um', 'admin');
  `)
  // the old state, with rows of a one-team user in each team and of a user in both
  await owner.query(migration('001_'))
  await owner.query(migration('002_'))
  await owner.query(`
    INSERT INTO audit_logs ("userId", action, details, "createdAt") VALUES
      ('ua', 'account_connected', '{"who": "a"}', '2026-01-01T00:00:00Z'),
      ('ub', 'post_published', '{"who": "b"}', '2026-01-02T00:00:00Z'),
      ('um', 'post_failed', '{"who": "m"}', '2026-01-03T00:00:00Z');
  `)
  await owner.query(migration('003_'))
  await owner.query(migration('004_'))

  const rows = async () => (await owner.query(`SELECT details->>'who' AS who, "teamId", "updatedAt" = "createdAt" AS same FROM social_audit_logs ORDER BY 1`)).rows
  const backfilled = [
    { who: 'a', teamId: 'team-a', same: true },
    { who: 'b', teamId: 'team-b', same: true },
    // in two teams: left without a team rather than shown to one it may not belong to
    { who: 'm', teamId: null, same: true },
  ]
  assert.deepEqual(await rows(), backfilled)
  const after = await objects(owner, 'social_audit_logs')
  assert.deepEqual(after.policies, ['social_audit_logs_delete_superadmin', 'social_audit_logs_insert_team', 'social_audit_logs_select_team'])

  // the runtime role (nextspark_app) reads its teams' rows only; a superadmin reads every row
  const as = asUser(app)
  const seen = async (who: string) => (await as(who, `SELECT details->>'who' AS who FROM social_audit_logs ORDER BY 1`)).rows.map(r => r.who)
  assert.deepEqual(await seen('ua'), ['a'])
  assert.deepEqual(await seen('ub'), ['b'])
  assert.deepEqual(await seen('um'), ['a', 'b'])
  assert.deepEqual(await seen('super'), ['a', 'b', 'm'])
  assert.deepEqual(await seen('nobody'), [])

  // writes: a user inserts rows of their own in one of their teams; no one updates; only a superadmin deletes
  const insert = (who: string, userId: string, teamId: string) =>
    as(who, `INSERT INTO social_audit_logs ("userId", "teamId", action, details) VALUES ($1, $2, 'account_connected', '{"who": "new"}')`, [userId, teamId])
  await insert('ua', 'ua', 'team-a')
  await assert.rejects(insert('ua', 'ua', 'team-b'), /row-level security/)
  await assert.rejects(insert('ua', 'ub', 'team-a'), /row-level security/)
  assert.equal((await as('ua', `UPDATE social_audit_logs SET action = 'post_failed'`)).rowCount, 0)
  assert.equal((await as('ua', `DELETE FROM social_audit_logs`)).rowCount, 0)
  assert.equal((await as('super', `DELETE FROM social_audit_logs WHERE details->>'who' = 'new'`)).rowCount, 1)
  // a new row gets updatedAt from the default
  await owner.query(`INSERT INTO social_audit_logs ("userId", "teamId", action) VALUES ('ua', 'team-a', 'post_published')`)
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM social_audit_logs WHERE "updatedAt" IS NULL`)).rows[0].n, 0)
  await owner.query(`DELETE FROM social_audit_logs WHERE details = '{}'::jsonb`)

  // twice: nothing changes
  await owner.query(migration('004_'))
  assert.deepEqual(await rows(), backfilled)
  assert.deepEqual(await objects(owner, 'social_audit_logs'), after)
  assert.deepEqual(await seen('ua'), ['a'])
})
