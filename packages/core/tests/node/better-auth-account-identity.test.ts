/**
 * Migration 038: the auth tables Better Auth 1.6 and 1.7 both accept. On core's own schema it only sets the default
 * of users.name; on a schema Better Auth 1.7.0-1.7.2 wrote (account.issuer NOT NULL, unique with "accountId") it
 * relaxes the column and drops the index; on an account table Better Auth created first it adds the unique
 * ("providerId", "accountId") index, or stops when rows share a key; a users row without a name gets one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

const MIGRATION_038 = fs.readFileSync(path.join(CORE, 'migrations/038_better_auth_account_identity.sql'), 'utf8')
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

const uniqueIndexes = `
  SELECT i.indexrelid::regclass::text AS name,
    (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM pg_attribute a
      WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)) AS columns
  FROM pg_index i WHERE i.indrelid = '"account"'::regclass AND i.indisunique AND NOT i.indisprimary ORDER BY 1`

test('038 on core\'s schema: one unique key, users.name defaults to \'\', idempotent', { skip, timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  const before = (await owner.query(uniqueIndexes)).rows
  assert.deepEqual(before.map(r => r.columns), [['accountId', 'providerId']])

  await owner.query(MIGRATION_038)
  assert.deepEqual((await owner.query(uniqueIndexes)).rows, before)
  const { rows: [name] } = await owner.query(`
    SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name'`)
  assert.deepEqual(name, { column_default: "''::text", is_nullable: 'YES' })

  // the insert of POST /api/v1/users, without a name: 002's trigger fills it, never NULL
  await owner.query(`INSERT INTO users (id, email, "firstName", "lastName") VALUES ('u1', 'u1@example.test', 'Ada', NULL), ('u2', 'u2@example.test', NULL, NULL)`)
  assert.deepEqual((await owner.query(`SELECT id, name FROM users ORDER BY id`)).rows, [{ id: 'u1', name: 'Ada' }, { id: 'u2', name: '' }])
})

test('038 relaxes the account.issuer Better Auth 1.7.0-1.7.2 wrote and keeps its values', { skip, timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email) VALUES ('u1', 'u1@example.test');
    INSERT INTO account (id, "accountId", "providerId", "userId") VALUES ('a1', 'u1', 'credential', 'u1');
    ALTER TABLE account ADD COLUMN issuer TEXT;
    UPDATE account SET issuer = 'credential';
    ALTER TABLE account ALTER COLUMN issuer SET NOT NULL;
    CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON account (issuer, "accountId");
    ALTER TABLE account ADD CONSTRAINT account_issuer_key UNIQUE (issuer, "providerId", "accountId");
  `)
  // what 1.6 does without the migration: the account insert fails
  await assert.rejects(owner.query(`INSERT INTO account (id, "accountId", "providerId", "userId") VALUES ('a2', 'g-1', 'google', 'u1')`), /issuer/)

  for (let run = 0; run < 2; run++) await owner.query(MIGRATION_038)
  assert.deepEqual((await owner.query(uniqueIndexes)).rows.map(r => r.columns), [['accountId', 'providerId']])
  const { rows: [issuer] } = await owner.query(`
    SELECT is_nullable FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'issuer'`)
  assert.equal(issuer.is_nullable, 'YES')
  await owner.query(`INSERT INTO account (id, "accountId", "providerId", "userId") VALUES ('a2', 'g-1', 'google', 'u1')`)
  assert.deepEqual((await owner.query(`SELECT id, issuer FROM account ORDER BY id`)).rows, [{ id: 'a1', issuer: 'credential' }, { id: 'a2', issuer: null }])
})

test('038 adds the unique ("providerId", "accountId") an account table Better Auth created lacks, and stops on duplicates', { skip, timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  const constraint = (await owner.query(`
    SELECT conname FROM pg_constraint WHERE conrelid = '"account"'::regclass AND contype = 'u'`)).rows[0].conname
  await owner.query(`
    ALTER TABLE account DROP CONSTRAINT "${constraint}";
    INSERT INTO users (id, email) VALUES ('u1', 'u1@example.test'), ('u2', 'u2@example.test');
    INSERT INTO account (id, "accountId", "providerId", "userId") VALUES ('a1', 'g-1', 'google', 'u1'), ('a2', 'g-1', 'google', 'u2');
  `)
  await assert.rejects(owner.query(MIGRATION_038), (error: Error & { hint?: string }) => {
    assert.match(error.message, /1 \("providerId", "accountId"\) key\(s\) shared/)
    assert.match(error.hint ?? '', /GROUP BY 1, 2 HAVING count\(\*\) > 1.*upgrade guide/s)
    return true
  })
  assert.deepEqual((await owner.query(uniqueIndexes)).rows, [])

  await owner.query(`DELETE FROM account WHERE id = 'a2'`)
  await owner.query(MIGRATION_038)
  assert.deepEqual((await owner.query(uniqueIndexes)).rows, [{ name: '"account_providerId_accountId_uidx"', columns: ['accountId', 'providerId'] }])
  await owner.query(MIGRATION_038)
  assert.equal((await owner.query(uniqueIndexes)).rows.length, 1)
})

test('038 gives a users row without a name its first and last names, or \'\'', { skip, timeout: 240000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  // rows written while 002's trigger was missing (a schema Better Auth created first)
  await owner.query(`
    ALTER TABLE users DISABLE TRIGGER trigger_sync_user_name;
    INSERT INTO users (id, email, name, "firstName", "lastName") VALUES
      ('u1', 'u1@example.test', NULL, 'Ada', 'Lovelace'), ('u2', 'u2@example.test', NULL, NULL, 'Hopper'),
      ('u3', 'u3@example.test', NULL, NULL, NULL), ('u4', 'u4@example.test', 'Kept', 'X', 'Y');
    ALTER TABLE users ENABLE TRIGGER trigger_sync_user_name;
  `)
  await owner.query(MIGRATION_038)
  assert.deepEqual((await owner.query(`SELECT id, name FROM users ORDER BY id`)).rows, [
    { id: 'u1', name: 'Ada Lovelace' }, { id: 'u2', name: 'Hopper' }, { id: 'u3', name: '' }, { id: 'u4', name: 'Kept' },
  ])
})
