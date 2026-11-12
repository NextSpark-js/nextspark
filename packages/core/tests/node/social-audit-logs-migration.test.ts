/**
 * social-media-publisher's audit log table on a throwaway cluster with core's migrations (#455): a database in the
 * old state (the plugin's 001 and 002, "audit_logs" with rows) gets the table renamed to "social_audit_logs" by 003,
 * with its rows, indexes, constraints, policies and grants, and running 003 again changes nothing.
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

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
