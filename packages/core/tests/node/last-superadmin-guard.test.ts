/**
 * guardLastSuperadmin against a real PostgreSQL with core's migrations (#433): the last superadmin is never demoted,
 * and two concurrent demotions of the last two superadmins leave one, not zero.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutoverDatabase, HAS_POSTGRES } from './_pg-cutover'

test('the last superadmin is kept, also against two concurrent demotions', { skip: !HAS_POSTGRES }, async (t) => {
  const db = await cutoverDatabase(t)
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const { guardLastSuperadmin, LAST_SUPERADMIN } = await import('../../src/lib/auth/last-superadmin')
  t.after(() => core.pool.end())

  const insert = (id: string, role: string) =>
    db.owner.query(`INSERT INTO "users" (id, email, role, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())`, [id, `${id}@example.com`, role])
  await insert('sa-1', 'superadmin')
  await insert('sa-2', 'superadmin')
  await insert('dev-1', 'developer')
  const demote = (id: string, holdMs = 0) => guardLastSuperadmin(id, 'dev-1', async () => {
    // hold the transaction open, so the other request has to wait for it
    if (holdMs) await new Promise((resolve) => setTimeout(resolve, holdMs))
    return core.queryWithRLS<{ id: string }>(`UPDATE "users" SET role = 'member' WHERE id = $1 RETURNING id`, [id], 'dev-1', { service: true })
  })
  const superadmins = async () => (await db.owner.query(`SELECT id FROM "users" WHERE role = 'superadmin' ORDER BY id`)).rows.map((r) => r.id)

  const results = await Promise.all([demote('sa-1', 300), demote('sa-2')])
  assert.equal(results.filter((r) => r === LAST_SUPERADMIN).length, 1, `one of the two is refused: ${JSON.stringify(results)}`)
  assert.equal((await superadmins()).length, 1, 'one superadmin is left')

  const [last] = await superadmins()
  assert.equal(await demote(last), LAST_SUPERADMIN, 'the last one is refused on its own too')
  assert.deepEqual(await superadmins(), [last])
  assert.equal(await guardLastSuperadmin('dev-1', 'dev-1', async () => 'written'), 'written', 'an account that is not a superadmin goes through')
})
