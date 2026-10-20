/**
 * TeamService.purgeDeleted against a real PostgreSQL (#314): the retention bound of
 * make_interval(secs => $1::float8 * 86400), checked below and above.
 *
 * Runs only when TEST_PG_URL points to a DISPOSABLE database (it creates a TEMP table, nothing persists):
 *   TEST_PG_URL=postgres://postgres@127.0.0.1:55914/postgres pnpm exec jest tests/jest/lib/services/team-purge.pg.test.ts
 */
import { Client } from 'pg'

const url = process.env.TEST_PG_URL
let client: Client

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  getServiceTransactionClient: jest.fn(),
  mutateWithRLS: async (text: string, params: unknown[]) => {
    const result = await client.query(text, params)
    return { rows: result.rows, rowCount: result.rowCount ?? 0 }
  },
}))
jest.mock('@/core/lib/config', () => ({ TEAMS_CONFIG: {} }))
jest.mock('@/core/lib/scheduled-actions/scheduler', () => ({ scheduleAction: jest.fn() }))

import { TeamService } from '@/core/lib/services/team.service'

const describePg = url ? describe : describe.skip

describePg('TeamService.purgeDeleted (real PostgreSQL)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
  })
  beforeEach(async () => {
    await client.query('DROP TABLE IF EXISTS pg_temp.teams')
    await client.query('CREATE TEMP TABLE teams (id text PRIMARY KEY, "deletedAt" timestamptz)')
    await client.query(`INSERT INTO teams (id, "deletedAt") VALUES
      ('active', NULL),
      ('just-inside-7d', now() - interval '7 days' + interval '1 minute'),
      ('just-past-7d', now() - interval '7 days' - interval '1 minute'),
      ('old', now() - interval '40 days'),
      ('recent', now() - interval '1 hour')`)
  })

  const remaining = async () => (await client.query('SELECT id FROM teams ORDER BY id')).rows.map(r => r.id)

  test('with 7 days, removes only what is past it: a minute inside stays, a minute past goes', async () => {
    expect(await TeamService.purgeDeleted(7)).toBe(2)
    expect(await remaining()).toEqual(['active', 'just-inside-7d', 'recent'])
  })

  test('never removes an active team, whatever the retention', async () => {
    await TeamService.purgeDeleted(0)
    expect(await remaining()).toEqual(['active'])
  })

  test('a fractional retention is exact: 0.5 days keeps the last hour only', async () => {
    expect(await TeamService.purgeDeleted(0.5)).toBe(3)
    expect(await remaining()).toEqual(['active', 'recent'])
  })

  test('the default retention is 30 days', async () => {
    expect(await TeamService.purgeDeleted()).toBe(1)
    expect(await remaining()).toEqual(['active', 'just-inside-7d', 'just-past-7d', 'recent'])
  })
})
