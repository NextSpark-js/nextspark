/**
 * Migration 046 (#436): get_auth_user_id() and get_auth_user_email() are STABLE, so a comparison with them is an index
 * condition instead of a call per row; a second run changes nothing; and what a user sees does not change.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CORE, cutoverDatabase, asUser, HAS_POSTGRES } from './_pg-cutover'

test('046 makes the auth helpers STABLE, idempotently, and an index serves a comparison with get_auth_user_id()', { skip: !HAS_POSTGRES }, async (t) => {
  const { owner, app } = await cutoverDatabase(t)
  const volatility = async () =>
    (await owner.query(`SELECT proname, provolatile FROM pg_proc WHERE proname IN ('get_auth_user_id', 'get_auth_user_email') AND pronamespace = 'public'::regnamespace ORDER BY 1`)).rows
  const stable = [{ proname: 'get_auth_user_email', provolatile: 's' }, { proname: 'get_auth_user_id', provolatile: 's' }]
  assert.deepEqual(await volatility(), stable)

  await owner.query(fs.readFileSync(path.join(CORE, 'migrations/046_rls_auth_helpers_stable.sql'), 'utf8'))
  assert.deepEqual(await volatility(), stable, 'a second run changes nothing')

  // a project helper written with the bare call, over a table big enough for the planner to prefer the index
  await owner.query(`CREATE TABLE grants ("userId" text NOT NULL, "itemId" text NOT NULL, PRIMARY KEY ("userId", "itemId"))`)
  await owner.query(`INSERT INTO grants SELECT 'user-' || (g % 500), 'item-' || g FROM generate_series(1, 20000) g`)
  await owner.query(`ANALYZE grants`)
  await owner.query(`GRANT SELECT ON grants TO authenticated`)
  const as = asUser(app)
  const plan = (await as('user-7', `EXPLAIN SELECT "itemId" FROM grants WHERE "userId" = public.get_auth_user_id()`)).rows.map((r) => r['QUERY PLAN']).join('\n')
  assert.match(plan, /Index (Only )?Scan|Bitmap Index Scan/, plan)
  assert.equal((await as('user-7', `SELECT count(*)::int AS n FROM grants WHERE "userId" = public.get_auth_user_id()`)).rows[0].n, 40, 'the same rows')
})
