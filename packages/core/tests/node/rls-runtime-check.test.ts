/**
 * scripts/db/check-rls-runtime.mjs and lib/rls-runtime.ts against a real cluster: the owner skips RLS, the
 * documented nextspark_app login does not, FORCE ROW LEVEL SECURITY makes a non-superuser owner subject to it, and
 * the exit codes `nextspark doctor` reads.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'
import { rlsRuntime, rlsRuntimeVerdict } from '../../scripts/db/check-rls-runtime.mjs'
import { logRlsBypassAtStartup, readRlsRuntime, rlsRuntimeVerdict as tsVerdict } from '../../src/lib/rls-runtime'

const SCRIPT = path.join(CORE, 'scripts/db/check-rls-runtime.mjs')
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const check = (DATABASE_URL: string) => {
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, DATABASE_URL }, encoding: 'utf8', timeout: 30000 })
  return { status: result.status, output: result.stdout.trim() }
}
const eachRlsTable = (action: string) => `DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.oid::regclass AS t FROM pg_class c WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND c.relnamespace = 'public'::regnamespace LOOP
    EXECUTE format('ALTER TABLE %s ${action}', r.t);
  END LOOP; END $$`

test('the owner skips RLS, nextspark_app does not; the script and the startup warning agree', { skip, timeout: 240000 }, async t => {
  const { owner, app, ownerUrl, appUrl } = await cutoverDatabase(t)

  const ownerRow = await rlsRuntime(owner)
  assert.equal(ownerRow.role, 'owner')
  assert.equal(ownerRow.superuser, true)
  assert.ok(ownerRow.ownedTables > 0 && ownerRow.rlsTables >= ownerRow.ownedTables)
  assert.equal(rlsRuntimeVerdict(ownerRow), 'bypassed')
  assert.deepEqual(await readRlsRuntime(q => owner.query(q)), ownerRow)

  const appRow = await rlsRuntime(app)
  assert.deepEqual({ ...appRow, rlsTables: 0 }, { role: 'app_login', superuser: false, bypassRls: false, ownedTables: 0, rlsTables: 0 })
  assert.equal(rlsRuntimeVerdict(appRow), 'enforced')
  assert.equal(tsVerdict(appRow), 'enforced')

  const bad = check(ownerUrl)
  assert.equal(bad.status, 1)
  assert.match(bad.output, /^Row-level security is NOT applied .*superuser=true/)
  const good = check(appUrl)
  assert.equal(good.status, 0)
  assert.match(good.output, /^Row-level security applies .*owns 0 of \d+ tables/)
  assert.equal(check('').status, 2)
  const unreachable = check('postgresql://nobody:secret-pw@127.0.0.1:1/x?sslmode=disable')
  assert.equal(unreachable.status, 2)
  assert.doesNotMatch(unreachable.output, /secret-pw/)

  // the startup warning: none for the runtime role, one line for the owner
  const lines: string[] = []
  const warn = console.warn
  console.warn = (...a: unknown[]) => { lines.push(a.join(' ')) }
  try {
    const env = { NODE_ENV: 'production', DATABASE_URL: 'x' } as NodeJS.ProcessEnv
    const reset = () => delete (globalThis as Record<symbol, unknown>)[Symbol.for('nextspark.rlsBypassWarned')]
    reset()
    await logRlsBypassAtStartup(q => app.query(q), env)
    assert.deepEqual(lines, [])
    reset()
    await logRlsBypassAtStartup(q => owner.query(q), env)
    assert.equal(lines.length, 1)
  } finally {
    console.warn = warn
  }
})

test('a non-superuser owner is bypassed, and FORCE ROW LEVEL SECURITY makes it subject to RLS', { skip, timeout: 240000 }, async t => {
  const { owner, ownerUrl } = await cutoverDatabase(t)
  await owner.query('CREATE ROLE plain_owner LOGIN NOSUPERUSER NOBYPASSRLS')
  await owner.query(eachRlsTable('OWNER TO plain_owner'))
  const url = ownerUrl.replace('owner@', 'plain_owner@')
  assert.equal(check(url).status, 1)
  await owner.query(eachRlsTable('FORCE ROW LEVEL SECURITY'))
  assert.equal(check(url).status, 0)
})
