/**
 * suspendUser keeps the role it replaces and unsuspendUser gives it back (#486), against a real PostgreSQL with core's
 * migrations: a suspended superadmin or developer is not demoted to member, only a developer brings either back, a user
 * suspended before migration 047 (no stored role) comes back as a member, and the new column opens no way to a role.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'

test('the role before suspension comes back, for those allowed to bring it back', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const db = await cutoverDatabase(t)
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const { suspendUser, unsuspendUser, restoreSuspendedUser, UNSUSPEND_FORBIDDEN } = await import('../../src/lib/auth/suspension')
  t.after(() => core.pool.end())

  for (const [id, role] of [['sa', 'superadmin'], ['sa2', 'superadmin'], ['dev', 'developer'], ['dev2', 'developer'], ['mem', 'member'], ['old', 'suspended']]) {
    await db.owner.query(`INSERT INTO "users" (id, email, role, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())`, [id, `${id}@example.com`, role])
  }
  const row = async (id: string) => (await db.owner.query(`SELECT role, "roleBeforeSuspension" AS before FROM "users" WHERE id = $1`, [id])).rows[0]

  // round trip of a superadmin and of a developer, by a developer
  for (const [id, role] of [['sa', 'superadmin'], ['dev2', 'developer']]) {
    assert.ok(await suspendUser(id, 'dev'))
    assert.deepEqual(await row(id), { role: 'suspended', before: role })
    assert.deepEqual(await unsuspendUser(id, 'dev', 'developer'), { id, role })
    assert.deepEqual(await row(id), { role, before: null })
  }

  // suspending a suspended user keeps the stored role instead of storing 'suspended'
  await suspendUser('sa2', 'dev')
  await suspendUser('sa2', 'dev')
  assert.deepEqual(await row('sa2'), { role: 'suspended', before: 'superadmin' })

  // a superadmin brings back neither a superadmin nor a developer; nothing is written
  await suspendUser('dev', 'dev2')
  for (const id of ['sa2', 'dev']) {
    const before = await row(id)
    assert.equal(await unsuspendUser(id, 'sa', 'superadmin'), UNSUSPEND_FORBIDDEN, id)
    assert.deepEqual(await row(id), before, id)
  }
  assert.deepEqual(await unsuspendUser('dev', 'dev2', 'developer'), { id: 'dev', role: 'developer' })

  // a member comes back as a member, for a superadmin too
  await suspendUser('mem', 'sa')
  assert.deepEqual(await unsuspendUser('mem', 'sa', 'superadmin'), { id: 'mem', role: 'member' })

  // suspended before migration 047: no stored role, back as a member (as it was)
  assert.deepEqual(await row('old'), { role: 'suspended', before: null })
  assert.deepEqual(await unsuspendUser('old', 'sa', 'superadmin'), { id: 'old', role: 'member' })

  // the stored role changed between the read and the write: the write of a stale role writes nothing
  await suspendUser('sa', 'dev')
  assert.equal(await restoreSuspendedUser('sa', 'dev', 'member'), null)
  assert.equal(await restoreSuspendedUser('sa', 'dev', 'developer'), null)
  assert.deepEqual(await row('sa'), { role: 'suspended', before: 'superadmin' })
  assert.deepEqual(await restoreSuspendedUser('sa', 'dev', 'superadmin'), { id: 'sa', role: 'superadmin' })
  // and a user who is not suspended is never written
  assert.equal(await restoreSuspendedUser('sa', 'dev', 'superadmin'), null)

  // not suspended, or unknown: nothing to do
  assert.equal(await unsuspendUser('mem', 'sa', 'superadmin'), null)
  assert.equal(await unsuspendUser('nobody', 'sa', 'superadmin'), null)
})

test('the stored role opens no way to a role: the guard and the CHECK', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('dev', 'dev@example.test', 'Dev', 'developer', true),
      ('mem', 'mem@example.test', 'Mem', 'member', true),
      ('oth', 'oth@example.test', 'Oth', 'member', true)`)
  const as = asUser(app)
  const refused = /cannot change here/

  // a user cannot write it into their own row, nor into another's, to be "restored" to a role they never had
  await assert.rejects(as('mem', `UPDATE users SET "roleBeforeSuspension" = 'developer' WHERE id = 'mem'`), refused)
  assert.equal((await as('mem', `UPDATE users SET "roleBeforeSuspension" = 'developer' WHERE id = 'oth'`)).rowCount, 0)
  // a developer, not on their own row
  await assert.rejects(as('dev', `UPDATE users SET "roleBeforeSuspension" = 'member' WHERE id = 'dev'`), refused)
  assert.equal((await as('dev', `UPDATE users SET "roleBeforeSuspension" = 'member' WHERE id = 'oth'`)).rowCount, 1)
  // other columns of their own row are still theirs, and the role guard of 037 still holds
  assert.equal((await as('mem', `UPDATE users SET "firstName" = 'M' WHERE id = 'mem'`)).rowCount, 1)
  await assert.rejects(as('mem', `UPDATE users SET role = 'developer' WHERE id = 'mem'`), refused)
  // the stored role is never 'suspended'
  await assert.rejects(owner.query(`UPDATE users SET "roleBeforeSuspension" = 'suspended' WHERE id = 'oth'`), /check_users_role_before_suspension/)

  // the migration runs twice
  const migration = fs.readFileSync(path.join(CORE, 'migrations/047_users_role_before_suspension.sql'), 'utf8')
  await owner.query(migration)
  await owner.query(migration)
})
