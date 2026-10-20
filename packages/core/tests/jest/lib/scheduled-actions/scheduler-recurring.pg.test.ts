/**
 * Recurring registration against a real PostgreSQL (#348): concurrent cold starts leave one row.
 *
 * Runs only when TEST_PG_URL points to a DISPOSABLE database (it works in its own schema, dropped at the end):
 *   TEST_PG_URL=postgres://postgres@127.0.0.1:55914/postgres pnpm exec jest tests/jest/lib/scheduled-actions/scheduler-recurring.pg.test.ts
 */
import { Pool, type PoolClient } from 'pg'

const url = process.env.TEST_PG_URL
let pool: Pool

jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: async (text: string, params: unknown[]) => {
    const result = await pool.query(text, params)
    return { rows: result.rows, rowCount: result.rowCount ?? 0 }
  },
  // Same shape as the real transaction client; each call takes its own connection, so calls really run concurrently
  getTransactionClient: async () => {
    const client: PoolClient = await pool.connect()
    await client.query('BEGIN')
    const end = async (sql: string) => {
      try {
        await client.query(sql)
      } finally {
        client.release()
      }
    }
    return {
      query: (text: string, params: unknown[] = []) => client.query(text, params).then(r => r.rows),
      commit: () => end('COMMIT'),
      rollback: () => end('ROLLBACK'),
    }
  },
}))
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: { scheduledActions: { deduplication: { windowSeconds: 5 } } } }))

import { scheduleAction, scheduleRecurringAction } from '@/core/lib/scheduled-actions/scheduler'

const describePg = url ? describe : describe.skip

describePg('scheduleRecurringAction (real PostgreSQL)', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 20, options: '-c search_path=t348,public' })
    await pool.query('DROP SCHEMA IF EXISTS t348 CASCADE')
    await pool.query('CREATE SCHEMA t348')
    await pool.query(`CREATE TABLE t348.scheduled_actions (
      id text PRIMARY KEY, "teamId" text, "actionType" text NOT NULL, status text NOT NULL DEFAULT 'pending',
      payload jsonb DEFAULT '{}'::jsonb, "scheduledAt" timestamptz NOT NULL, "recurringInterval" text,
      "recurrenceType" text, "lockGroup" text, "maxRetries" int NOT NULL DEFAULT 3,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`)
  })
  afterAll(async () => {
    await pool.query('DROP SCHEMA IF EXISTS t348 CASCADE')
    await pool.end()
  })
  beforeEach(async () => {
    await pool.query('TRUNCATE t348.scheduled_actions')
  })

  const count = async (where = 'true') =>
    Number((await pool.query(`SELECT count(*) FROM t348.scheduled_actions WHERE ${where}`)).rows[0].count)

  test('30 concurrent registrations leave exactly one row and return the same id', async () => {
    const ids = await Promise.all(Array.from({ length: 30 }, () => scheduleRecurringAction('sweep', { k: 1, a: [1, 2] }, 'daily')))
    expect(await count()).toBe(1)
    expect(new Set(ids).size).toBe(1)
  })

  test('a repeated registration is a no-op; another payload or team is another row', async () => {
    await scheduleRecurringAction('sweep', { a: 1, b: 2 }, 'daily')
    await scheduleRecurringAction('sweep', { b: 2, a: 1 }, 'daily') // same jsonb, other key order
    expect(await count()).toBe(1)
    await scheduleRecurringAction('sweep', { a: 2 }, 'daily')
    await scheduleRecurringAction('sweep', { a: 1, b: 2 }, 'daily', { teamId: 'team-1' })
    expect(await count()).toBe(3)
  })

  test('a running row blocks the registration; a completed one does not', async () => {
    await scheduleRecurringAction('sweep', {}, 'daily')
    await pool.query(`UPDATE t348.scheduled_actions SET status = 'running'`)
    await scheduleRecurringAction('sweep', {}, 'daily')
    expect(await count()).toBe(1)
    await pool.query(`UPDATE t348.scheduled_actions SET status = 'completed'`)
    await scheduleRecurringAction('sweep', {}, 'daily')
    expect(await count()).toBe(2)
  })

  test('the processor flow (completed, then rescheduled) creates the next one, once even if registration races it', async () => {
    await scheduleRecurringAction('sweep', {}, 'daily')
    await pool.query(`UPDATE t348.scheduled_actions SET status = 'completed'`)
    // the next occurrence, as rescheduleRecurringAction sends it, racing three cold-start registrations
    await Promise.all([
      scheduleAction('sweep', {}, { recurringInterval: 'daily', recurrenceType: 'fixed', scheduledAt: new Date(Date.now() + 86400000) }),
      scheduleRecurringAction('sweep', {}, 'daily'),
      scheduleRecurringAction('sweep', {}, 'daily'),
      scheduleRecurringAction('sweep', {}, 'daily'),
    ])
    expect(await count(`status = 'pending'`)).toBe(1)
  })

  test('non-recurring actions are untouched: identical ones all insert', async () => {
    await Promise.all(Array.from({ length: 5 }, () => scheduleAction('once', { x: 1 })))
    expect(await count(`"actionType" = 'once'`)).toBe(5)
  })
})
