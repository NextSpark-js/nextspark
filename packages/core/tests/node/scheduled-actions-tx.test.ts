/**
 * scheduleAction({ tx }) against a real PostgreSQL with core's migrations and RLS (#378): the action is enqueued in the
 * caller's transaction, so it is invisible to other connections until the caller commits and gone after a rollback.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import type pg from 'pg'
import { cutoverDatabase, HAS_POSTGRES } from './_pg-cutover'

// config-sync needs a generated project; the scheduler only reads the dedupe window from it
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('config/config-sync')) {
      return { url: pathToFileURL(new URL('./_config-sync-stub.ts', import.meta.url).pathname).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

async function setup(t: Parameters<typeof cutoverDatabase>[0]) {
  const db = await cutoverDatabase(t)
  process.env.DATABASE_URL = db.ownerUrl
  delete process.env.DATABASE_SERVICE_URL
  const core = await import('../../src/lib/db')
  const scheduler = await import('../../src/lib/scheduled-actions/scheduler')
  t.after(() => core.pool.end())
  const seen = async (where = 'true') =>
    (await db.owner.query(`SELECT count(*)::int AS n FROM scheduled_actions WHERE ${where}`)).rows[0].n as number
  return { ...db, core, scheduler, seen }
}

// each shape of scheduleAction: dedupe off (no entityId), dedupe on (entityId), recurring
const shapes = [
  ['without entityId', { x: 1 }, {}],
  ['with entityId (deduplicated)', { entityId: 'e-1', entityType: 'task' }, {}],
  ['recurring', { x: 1 }, { recurringInterval: 'daily' }],
] as const

// one cluster and one load of lib/db for the file: the module keeps its pools for the life of the process
test('scheduleAction with tx against a real PostgreSQL', { skip: !HAS_POSTGRES }, async (t) => {
  const { app, core, scheduler, seen } = await setup(t)
  t.mock.method(console, 'log', () => {})

  for (const [name, payload, extra] of shapes) {
    await t.test(`tx ${name}: invisible before the caller commits, there after commit, gone after rollback`, async () => {
      const tx = await core.getServiceTransactionClient()
      let committed = false
      try {
        const id = await scheduler.scheduleAction(`test:tx:${name}`, payload, { ...extra, tx })
        assert.equal(await seen(`id = '${id}'`), 0, 'not visible from another connection before the commit')
        assert.equal((await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM scheduled_actions WHERE id = $1`, [id]))[0].n, 1, 'visible inside the transaction')
        await tx.commit()
        committed = true
        assert.equal(await seen(`id = '${id}'`), 1, 'visible after the commit')
      } finally {
        if (!committed) await tx.rollback() // a failed assertion must not leave the connection checked out
      }

      const rolled = await core.getServiceTransactionClient()
      const other = 'entityId' in payload ? { ...payload, entityId: 'e-2' } : { ...payload, y: 2 }
      const gone = await scheduler.scheduleAction(`test:tx-rollback:${name}`, other, { ...extra, tx: rolled }).finally(() => rolled.rollback())
      assert.equal(await seen(`id = '${gone}'`), 0, 'gone after the rollback')
    })
  }

  await t.test('without tx the action is committed on return, as before', async () => {
    const a = await scheduler.scheduleAction('test:plain', { x: 1 })
    const b = await scheduler.scheduleAction('test:plain-dedupe', { entityId: 'e-9', entityType: 'task' })
    const c = await scheduler.scheduleAction('test:plain-recurring', { x: 1 }, { recurringInterval: 'daily' })
    for (const id of [a, b, c]) assert.equal(await seen(`id = '${id}'`), 1)
  })

  await t.test('a tx on the app role fails with an error that says to use the service connection', async () => {
    const appTx = { query: async <T,>(text: string, params: unknown[] = []) => (await (app as pg.Client).query(text, params)).rows as T[] }
    await app.query('BEGIN')
    await assert.rejects(
      scheduler.scheduleAction('test:app', { x: 1 }, { tx: appTx }),
      /row-level security[\s\S]*service connection/
    )
    await app.query('ROLLBACK')
    assert.equal(await seen(`"actionType" = 'test:app'`), 0)
  })
})
