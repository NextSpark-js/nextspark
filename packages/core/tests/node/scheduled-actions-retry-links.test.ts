/**
 * The retry links of the devtools scheduled actions list (#522), against a real PostgreSQL: a failed action points to
 * the action that retried it and back, a recurring one never does, and the retry endpoint can tell a failed action
 * was already retried.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutoverDatabase, HAS_POSTGRES } from './_pg-cutover'
import { ALREADY_RETRIED_SQL, RETRY_LINK_COLUMNS } from '../../src/lib/scheduled-actions/retry-links'

test('retry links between scheduled actions', { skip: !HAS_POSTGRES }, async (t) => {
  const { owner } = await cutoverDatabase(t)

  const insert = async (id: string, type: string, status: string, payload: object, createdAt: string, recurringInterval: string | null = null) =>
    owner.query(
      `INSERT INTO scheduled_actions (id, "actionType", status, payload, "scheduledAt", "createdAt", "recurringInterval")
       VALUES ($1, $2, $3, $4::jsonb, $5, $5, $6)`,
      [id, type, status, JSON.stringify(payload), createdAt, recurringInterval]
    )
  const links = async () => {
    const { rows } = await owner.query(`SELECT id, ${RETRY_LINK_COLUMNS} FROM "scheduled_actions" ORDER BY "createdAt"`)
    return Object.fromEntries(rows.map((r: { id: string; retriedBy: string | null; retryOf: string | null }) => [r.id, { retriedBy: r.retriedBy, retryOf: r.retryOf }]))
  }

  const A = '00000000-0000-0000-0000-00000000000a'
  const B = '00000000-0000-0000-0000-00000000000b'
  const C = '00000000-0000-0000-0000-00000000000c'
  const OTHER = '00000000-0000-0000-0000-0000000000d0'
  const REC1 = '00000000-0000-0000-0000-0000000000e1'
  const REC2 = '00000000-0000-0000-0000-0000000000e2'

  await t.test('a failed action and its retry point at each other, down a chain of retries', async () => {
    await insert(A, 'test:hook', 'failed', { url: 'x', n: 1 }, '2026-01-01T10:00:00.123456Z') // microseconds, which a JS Date cannot carry
    await insert(B, 'test:hook', 'failed', { n: 1, url: 'x' }, '2026-01-01T11:00:00Z') // same payload, key order aside
    await insert(C, 'test:hook', 'pending', { url: 'x', n: 1 }, '2026-01-01T12:00:00Z')
    await insert(OTHER, 'test:hook', 'failed', { url: 'x', n: 2 }, '2026-01-01T10:30:00Z') // another payload: unrelated
    const l = await links()
    assert.deepEqual(l[A], { retriedBy: B, retryOf: null })
    assert.deepEqual(l[B], { retriedBy: C, retryOf: A })
    assert.deepEqual(l[C], { retriedBy: null, retryOf: B }) // not failed: no retriedBy
    assert.deepEqual(l[OTHER], { retriedBy: null, retryOf: null })
  })

  await t.test('a recurring action is never the original of a retry', async () => {
    await insert(REC1, 'test:cron', 'failed', { k: 1 }, '2026-01-02T10:00:00Z', 'daily')
    await insert(REC2, 'test:cron', 'pending', { k: 1 }, '2026-01-03T10:00:00Z', 'daily')
    const l = await links()
    assert.deepEqual(l[REC1], { retriedBy: null, retryOf: null })
    assert.deepEqual(l[REC2], { retriedBy: null, retryOf: null })
  })

  await t.test('the retry endpoint can tell a failed action was already retried', async () => {
    const asked = async (id: string, type: string, payload: object) =>
      (await owner.query(ALREADY_RETRIED_SQL, [type, JSON.stringify(payload), id])).rows.map((r: { id: string }) => r.id)
    assert.deepEqual(await asked(A, 'test:hook', { url: 'x', n: 1 }), [B])
    assert.deepEqual(await asked(C, 'test:hook', { url: 'x', n: 1 }), [], 'the last of a chain is not its own retry')
    assert.deepEqual(await asked(OTHER, 'test:hook', { url: 'x', n: 2 }), [])
  })
})
