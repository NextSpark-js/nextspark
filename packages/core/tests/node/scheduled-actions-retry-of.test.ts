/**
 * scheduled_actions."retryOf" (migration 048, #522) against a real PostgreSQL: a retry points at the failed action it
 * retries, an action is retried once (the unique index, atomic under two requests at once), a chain of retries works,
 * two teams with the same payload do not cross, the migration runs twice, the app role cannot write it, deleting the
 * original unlinks the retry, and a database that has not run the migration still schedules everything else.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as nodeModule from 'node:module'
import { pathToFileURL } from 'node:url'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'

// config-sync needs a generated project; the scheduler only reads the dedupe window from it
const HAS_HOOKS = typeof (nodeModule as { registerHooks?: unknown }).registerHooks === 'function'
if (HAS_HOOKS) {
  (nodeModule as unknown as { registerHooks: (h: { resolve: (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown }) => void }).registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('config/config-sync')) {
        return { url: pathToFileURL(new URL('./_config-sync-stub.ts', import.meta.url).pathname).href, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
  })
}

test('scheduled action retries', { skip: (!HAS_POSTGRES || !HAS_HOOKS) && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async (t) => {
  const db = await cutoverDatabase(t)
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const scheduler = await import('../../src/lib/scheduled-actions/scheduler')
  const { findPendingTwin, listScheduledActions } = await import('../../src/lib/scheduled-actions/devtools-list')
  t.after(() => core.pool.end())
  t.mock.method(console, 'log', () => {})

  await db.owner.query(`INSERT INTO users (id, email, role, "emailVerified", "createdAt", "updatedAt") VALUES ('own', 'own@example.com', 'member', true, now(), now())`)
  await db.owner.query(`INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'own'), ('team-b', 'Team B', 'team-b', 'own')`)

  const fail = (id: string) => db.owner.query(`UPDATE scheduled_actions SET status = 'failed', "errorMessage" = 'boom' WHERE id = $1`, [id])
  const row = async (id: string) => (await listScheduledActions({ limit: 100, offset: 0 })).actions.find((a) => a.id === id)

  const A = await scheduler.scheduleAction('test:hook', { url: 'x' })
  await fail(A)

  await t.test('a retry points at the action it retries, and the list shows both ways', { timeout: 30000 }, async () => {
    const B = await scheduler.scheduleAction('test:hook', { url: 'x' }, { retryOf: A })
    assert.equal((await row(A))?.retriedBy, B)
    assert.equal((await row(A))?.retryOf, null)
    assert.equal((await row(B))?.retryOf, A)
    assert.equal((await row(B))?.retriedBy, null)
  })

  await t.test('an action is retried once: the second retry is a unique violation', { timeout: 30000 }, async () => {
    await assert.rejects(scheduler.scheduleAction('test:hook', { url: 'x' }, { retryOf: A }), (e: { code?: string }) => e.code === '23505')
    assert.equal((await db.owner.query(`SELECT count(*)::int AS n FROM scheduled_actions WHERE "retryOf" = $1`, [A])).rows[0].n, 1)
  })

  await t.test('a retry is not deduplicated into a pending action, even with an entityId', { timeout: 30000 }, async () => {
    const D = await scheduler.scheduleAction('test:hook', { entityId: 'e1', entityType: 'task' })
    await fail(D)
    const pending = await scheduler.scheduleAction('test:hook', { entityId: 'e1', entityType: 'task' }) // an unrelated pending one
    const retry = await scheduler.scheduleAction('test:hook', { entityId: 'e1', entityType: 'task' }, { retryOf: D })
    assert.notEqual(retry, pending)
    assert.equal((await row(retry))?.retryOf, D)
  })

  await t.test('two retries of the same action at once: exactly one wins', { timeout: 30000 }, async () => {
    const E = await scheduler.scheduleAction('test:race', { n: 1 })
    await fail(E)
    const results = await Promise.allSettled([
      scheduler.scheduleAction('test:race', { n: 1 }, { retryOf: E }),
      scheduler.scheduleAction('test:race', { n: 1 }, { retryOf: E }),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal((await db.owner.query(`SELECT count(*)::int AS n FROM scheduled_actions WHERE "retryOf" = $1`, [E])).rows[0].n, 1)
  })

  await t.test('a chain: A fails, its retry fails, and that one is retried', { timeout: 30000 }, async () => {
    const [chainA] = [await scheduler.scheduleAction('test:chain', { c: 1 })]
    await fail(chainA)
    const chainB = await scheduler.scheduleAction('test:chain', { c: 1 }, { retryOf: chainA })
    await fail(chainB)
    const chainC = await scheduler.scheduleAction('test:chain', { c: 1 }, { retryOf: chainB })
    assert.equal((await row(chainA))?.retriedBy, chainB)
    assert.equal((await row(chainB))?.retriedBy, chainC)
    assert.equal((await row(chainB))?.retryOf, chainA)
    assert.equal((await row(chainC))?.retryOf, chainB)
    // A cannot be retried again, B cannot either: only the end of the chain can
    await assert.rejects(scheduler.scheduleAction('test:chain', { c: 1 }, { retryOf: chainA }), (e: { code?: string }) => e.code === '23505')
    await assert.rejects(scheduler.scheduleAction('test:chain', { c: 1 }, { retryOf: chainB }), (e: { code?: string }) => e.code === '23505')
  })

  await t.test('two teams with the same type and payload do not cross', { timeout: 30000 }, async () => {
    const a = await scheduler.scheduleAction('test:teams', { same: true }, { teamId: 'team-a' })
    const b = await scheduler.scheduleAction('test:teams', { same: true }, { teamId: 'team-b' })
    await fail(a)
    await fail(b)
    const retryA = await scheduler.scheduleAction('test:teams', { same: true }, { teamId: 'team-a', retryOf: a })
    assert.equal((await row(a))?.retriedBy, retryA)
    assert.equal((await row(b))?.retriedBy, null, "team B's failed action is not retried by team A's retry")
    assert.equal((await row(b))?.retryOf, null)
    assert.equal((await row(retryA))?.teamName, 'Team A')
  })

  await t.test('the filters and the page size still apply to the list', { timeout: 30000 }, async () => {
    const page = await listScheduledActions({ actionType: 'test:chain', status: 'failed', limit: 1, offset: 0 })
    assert.equal(page.total, 2)
    assert.equal(page.actions.length, 1)
  })

  await t.test('the app role cannot write or read the column: the policy still decides', { timeout: 30000 }, async () => {
    await db.app.query('BEGIN')
    await assert.rejects(
      db.app.query(`INSERT INTO scheduled_actions (id, "actionType", status, payload, "scheduledAt", "retryOf") VALUES ('x1', 'test:app', 'pending', '{}', now(), $1)`, [A]),
      (e: { code?: string }) => e.code === '42501'
    )
    await db.app.query('ROLLBACK')
    assert.equal((await db.app.query(`SELECT "retryOf" FROM scheduled_actions`)).rows.length, 0)
  })

  await t.test('deleting the original unlinks its retry instead of deleting it', { timeout: 30000 }, async () => {
    const F = await scheduler.scheduleAction('test:del', { d: 1 })
    await fail(F)
    const G = await scheduler.scheduleAction('test:del', { d: 1 }, { retryOf: F })
    await db.owner.query(`DELETE FROM scheduled_actions WHERE id = $1`, [F])
    assert.equal((await row(G))?.retryOf, null)
  })

  await t.test('the migration runs twice without failing and leaves one column and one index', { timeout: 30000 }, async () => {
    const sql = fs.readFileSync(path.join(CORE, 'migrations', '048_scheduled_actions_retry_of.sql'), 'utf8')
    await db.owner.query(sql)
    await db.owner.query(sql)
    assert.equal((await db.owner.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'scheduled_actions' AND column_name = 'retryOf'`)).rows[0].n, 1)
    assert.equal((await db.owner.query(`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'idx_scheduled_actions_retry_of'`)).rows[0].n, 1)
  })

  await t.test('a pending twin of the same type, payload and team is found; another team\'s is not', { timeout: 30000 }, async () => {
    const failedA = await scheduler.scheduleAction('test:twin', { k: 1 }, { teamId: 'team-a' })
    await fail(failedA)
    const failedRow = { actionType: 'test:twin', payload: { k: 1 }, teamId: 'team-a' }
    assert.deepEqual(await findPendingTwin(failedRow), [], 'nothing pending yet')

    await scheduler.scheduleAction('test:twin', { k: 1 }, { teamId: 'team-b' }) // another team, same payload
    assert.deepEqual(await findPendingTwin(failedRow), [], "team B's pending action is not a twin of team A's")

    const twin = await scheduler.scheduleAction('test:twin', { k: 1 }, { teamId: 'team-a' })
    assert.deepEqual((await findPendingTwin({ ...failedRow, payload: { k: 1 } })).map((r) => r.id), [twin])
    assert.deepEqual((await findPendingTwin({ ...failedRow, teamId: 'team-b' })).length, 1, 'team B has its own twin')
    assert.deepEqual(await findPendingTwin({ ...failedRow, payload: { k: 2 } }), [], 'another payload is not a twin')
    assert.deepEqual(await findPendingTwin({ ...failedRow, actionType: 'test:other' }), [], 'another type is not a twin')
  })

  await t.test('containment must hold both ways: a pending action whose payload is a superset or a subset is not a twin (#544)', { timeout: 30000 }, async () => {
    const failed = { actionType: 'test:twin-both', payload: { k: 1, extra: 2 }, teamId: 'team-a' }
    const superset = await scheduler.scheduleAction('test:twin-both', { k: 1, extra: 2, more: 3 }, { teamId: 'team-a' })
    assert.deepEqual(await findPendingTwin(failed), [], 'a pending payload that contains the failed one is not a twin')
    await scheduler.scheduleAction('test:twin-both', { k: 1 }, { teamId: 'team-a' })
    assert.deepEqual(await findPendingTwin(failed), [], 'a pending payload that the failed one contains is not a twin')
    const exact = await scheduler.scheduleAction('test:twin-both', { extra: 2, k: 1 }, { teamId: 'team-a' }) // key order is ignored
    const found = await findPendingTwin(failed)
    assert.equal(found.length, 1)
    assert.notEqual(found[0].id, superset)
    assert.equal(found[0].id, exact)
  })

  await t.test('a global action (no team) matches only global twins',{ timeout: 30000 }, async () => {
    await scheduler.scheduleAction('test:global-twin', {})
    assert.equal((await findPendingTwin({ actionType: 'test:global-twin', payload: {}, teamId: null })).length, 1)
    assert.equal((await findPendingTwin({ actionType: 'test:global-twin', payload: {}, teamId: 'team-a' })).length, 0)
  })

  await t.test('before the migration, scheduling an action that is not a retry still works', { timeout: 30000 }, async () => {
    await db.owner.query(`ALTER TABLE scheduled_actions DROP COLUMN "retryOf"`)
    const id = await scheduler.scheduleAction('test:old-db', { o: 1 })
    assert.ok(id)
    const tx = await core.getServiceTransactionClient() // the caller's-transaction path inserts with its own statement
    try {
      assert.ok(await scheduler.scheduleAction('test:old-db-tx', { o: 2 }, { tx }))
      await tx.commit()
    } catch (error) {
      // a statement that failed leaves the connection checked out: give it back, or pool.end() waits for it forever
      await tx.rollback().catch(() => {})
      throw error
    }
  })
})
