/**
 * Migration 036: can_bypass_rls() (and is_superadmin(), its alias) is true for a developer as for a superadmin,
 * without a System Admin Team. On the nextspark_app cutover a developer sees and writes what a superadmin does in
 * every table whose policies use the predicate.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'

const MIGRATION_036 = path.join(CORE, 'migrations/036_developer_rls_bypass.sql')

test('a developer bypasses RLS as a superadmin does, with no System Admin Team', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('super', 'super@example.test', 'Super', 'superadmin', true),
      ('dev', 'dev@example.test', 'Dev', 'developer', true),
      ('mem', 'mem@example.test', 'Mem', 'member', true),
      ('owna', 'owna@example.test', 'Owner A', 'member', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'owna'), ('team-m', 'Team M', 'team-m', 'mem');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'owna', 'owner'), ('team-m', 'mem', 'owner');
    INSERT INTO users_metas ("userId", "metaKey", "metaValue") VALUES ('owna', 'k', '"v"'), ('mem', 'k', '"v"');
  `)
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM teams WHERE (metadata->>'systemAdmin')::boolean`)).rows[0].n, 0)
  const as = asUser(app)

  for (const who of ['dev', 'super']) {
    const { rows: [flags] } = await as(who, 'SELECT public.can_bypass_rls() AS bypass, public.is_superadmin() AS alias')
    assert.deepEqual(flags, { bypass: true, alias: true }, who)
  }
  // false, not null, for a member and for an unknown or empty user id
  for (const who of ['mem', 'owna', 'nobody', '']) {
    assert.equal((await as(who, 'SELECT public.can_bypass_rls() AS b')).rows[0].b, false, who)
  }

  // every table whose policies use the predicate: the developer sees the superadmin's rows
  const { rows: tables } = await owner.query(`
    SELECT DISTINCT tablename FROM pg_policies
    WHERE coalesce(qual, '') || coalesce(with_check, '') ~* '(can_bypass_rls|is_superadmin)' ORDER BY tablename`)
  assert.ok(tables.length >= 19, `${tables.length} tables`)
  for (const { tablename } of tables) {
    const count = async (who: string) => (await as(who, `SELECT count(*)::int AS n FROM public."${tablename}"`)).rows[0].n
    assert.equal(await count('dev'), await count('super'), tablename)
  }
  assert.equal((await as('dev', 'SELECT count(*)::int AS n FROM users')).rows[0].n, 4)
  assert.equal((await as('mem', 'SELECT count(*)::int AS n FROM users')).rows[0].n, 1)

  // writes: another user's row, and a team's owner (035's trigger lets only is_superadmin() move it through RLS)
  assert.equal((await as('dev', `UPDATE users SET "firstName" = 'X' WHERE id = 'owna'`)).rowCount, 1)
  assert.equal((await as('mem', `UPDATE users SET "firstName" = 'Y' WHERE id = 'owna'`)).rowCount, 0)
  assert.equal((await as('dev', `UPDATE teams SET "ownerId" = 'mem' WHERE id = 'team-a'`)).rowCount, 1)
  await assert.rejects(as('owna', `UPDATE teams SET "ownerId" = 'owna' WHERE id = 'team-m'`).then(r => { if (r.rowCount === 0) throw new Error('row-level security') }), /row-level security|cannot change/)

  // 027's enrollment trigger still works once a deployment flags a team
  await owner.query(`INSERT INTO teams (id, name, slug, "ownerId", metadata) VALUES ('sys', 'System', 'sys', 'super', '{"systemAdmin": true}')`)
  await owner.query(`UPDATE users SET role = 'developer' WHERE id = 'mem'`)
  assert.equal((await owner.query(`SELECT role FROM team_members WHERE "teamId" = 'sys' AND "userId" = 'mem'`)).rows[0]?.role, 'admin')
  await owner.query(`UPDATE users SET role = 'member' WHERE id = 'mem'`)
  assert.equal((await owner.query(`SELECT count(*)::int AS n FROM team_members WHERE "teamId" = 'sys' AND "userId" = 'mem'`)).rows[0].n, 0)
  assert.equal((await as('mem', 'SELECT public.can_bypass_rls() AS b')).rows[0].b, false)

  // 036 runs again on a database that has it: idempotent
  await owner.query(fs.readFileSync(MIGRATION_036, 'utf8'))
  assert.equal((await as('dev', 'SELECT public.can_bypass_rls() AS b')).rows[0].b, true)
})
