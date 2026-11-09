/**
 * `db:demo-reset` against a real PostgreSQL with core's migrations and sample data: what it restores, what it clears,
 * and every refusal, which must leave the database as it was. Needs core's dist/ (the script loads the demo mode from it).
 *
 * Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'
import { sampleDataPolicy } from '../../scripts/db/sample-data.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT = path.join(CORE, 'scripts/db/demo-reset.mjs')
const UPLOAD = `1730000000000_${'a'.repeat(32)}.png`
const SECRET = 're_notarealkeynotarealkey'

function project(t: { after: (fn: () => void) => void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-reset-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core'), { recursive: true })
  fs.symlinkSync(path.join(CORE, 'migrations'), path.join(root, 'packages/core/migrations'))
  fs.mkdirSync(path.join(root, 'config'))
  fs.mkdirSync(path.join(root, 'uploads'))
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  return root
}

function runner(root: string, url: string) {
  const base: Record<string, string | undefined> = {
    PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url, NODE_ENV: 'production',
    NEXTSPARK_DEMO_MODE: 'true', STORAGE_DRIVER: 'local', UPLOADS_DIR: path.join(root, 'uploads'),
  }
  return (overrides: Record<string, string | undefined> = {}, args: string[] = []) => {
    const env = Object.fromEntries(Object.entries({ ...base, ...overrides }).filter(([, value]) => value !== undefined)) as NodeJS.ProcessEnv
    const run = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
    return { status: run.status, output: `${run.stdout}${run.stderr}` }
  }
}

async function connect(t: { after: (fn: () => Promise<void>) => void }, url: string) {
  const client = new pg.Client({ connectionString: url })
  client.on('error', () => {})
  await client.connect()
  t.after(async () => { await client.end() })
  return client
}

test('every refusal leaves a database that is not a demo as it was', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { port, stop } = await startCluster('demo-reset-refuse')
  t.after(stop)
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const root = project(t)
  const run = runner(root, url)
  const client = await connect(t, url)
  await client.query(`CREATE TABLE customers (id int); INSERT INTO customers VALUES (1)`)
  fs.writeFileSync(path.join(root, 'uploads', UPLOAD), 'real')

  const refused: Array<[string, Record<string, string | undefined>, RegExp]> = [
    ['the variable is missing', { NEXTSPARK_DEMO_MODE: undefined }, /only runs with NEXTSPARK_DEMO_MODE=true/],
    ['the variable is not exactly true', { NEXTSPARK_DEMO_MODE: '1' }, /only runs with NEXTSPARK_DEMO_MODE=true/],
    ['an email credential is set', { RESEND_API_KEY: SECRET }, /RESEND_API_KEY is set/],
    ['a payment credential is set', { STRIPE_SECRET_KEY: SECRET }, /STRIPE_SECRET_KEY is set/],
    ['uploads go to a real service', { STORAGE_DRIVER: 's3' }, /STORAGE_DRIVER is not local/],
    ['the database has tables and no mark', {}, /was not created by db:demo-reset/],
  ]
  for (const [why, overrides, message] of refused) {
    const result = run(overrides)
    assert.equal(result.status, 1, `${why}: ${result.output}`)
    assert.match(result.output, message, why)
    assert.match(result.output, /Nothing was changed/, why)
    assert.ok(!result.output.includes(SECRET), `${why}: a value was printed`)
  }
  const typo = run({ NEXTSPARK_DEMO_MODE: 'true' }, ['--stauts'])
  assert.equal(typo.status, 1, typo.output)
  assert.match(typo.output, /Unknown argument/)
  assert.deepEqual((await client.query('SELECT id FROM customers')).rows, [{ id: 1 }])
  assert.ok(fs.existsSync(path.join(root, 'uploads', UPLOAD)), 'the file is still there')
})

test('a table or view in any schema counts as data', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { port, stop } = await startCluster('demo-reset-relations')
  t.after(stop)
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const run = runner(project(t), url)
  const client = await connect(t, url)
  await client.query(`CREATE SCHEMA other; CREATE FOREIGN DATA WRAPPER demo_fdw; CREATE SERVER demo_server FOREIGN DATA WRAPPER demo_fdw`)

  const relations: Array<[string, string, string]> = [
    ['a table in another schema', 'CREATE TABLE other.r (id int)', 'DROP TABLE other.r'],
    ['a partitioned table', 'CREATE TABLE other.p (id int) PARTITION BY RANGE (id)', 'DROP TABLE other.p'],
    ['a view', 'CREATE VIEW public.v AS SELECT 1 AS x', 'DROP VIEW public.v'],
    ['a materialized view', 'CREATE MATERIALIZED VIEW other.m AS SELECT 1 AS x', 'DROP MATERIALIZED VIEW other.m'],
    ['a foreign table', 'CREATE FOREIGN TABLE other.f (id int) SERVER demo_server', 'DROP FOREIGN TABLE other.f'],
  ]
  for (const [what, create, drop] of relations) {
    await client.query(create)
    const result = run()
    assert.equal(result.status, 1, `${what}: ${result.output}`)
    assert.match(result.output, /was not created by db:demo-reset/, what)
    await client.query(drop)
  }

  // the column lives elsewhere, the type it needs in public
  await client.query(`CREATE EXTENSION citext SCHEMA public; CREATE TABLE other.customers (email public.citext); INSERT INTO other.customers VALUES ('a@example.test')`)
  assert.equal(run().status, 1)
  assert.deepEqual((await client.query('SELECT email FROM other.customers')).rows, [{ email: 'a@example.test' }])
})

test('a failed reset leaves an empty database, marked unfinished, and can be run again', { skip: !HAS_POSTGRES, timeout: 300000 }, async t => {
  const { port, stop } = await startCluster('demo-reset-fail')
  t.after(stop)
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const root = project(t)
  const run = runner(root, url)
  const after = path.join(root, 'migrations/900_after_the_sample_data.sql')
  fs.mkdirSync(path.dirname(after))
  fs.writeFileSync(after, 'SELECT 1 / 0;')

  assert.equal(run().status, 1)
  const client = await connect(t, url)
  assert.equal((await client.query(`SELECT to_regclass('public.users') AS users`)).rows[0].users, null, 'no sample account stays behind')
  assert.equal((await client.query('SELECT last_reset_at FROM _nextspark_demo')).rows[0].last_reset_at, null)
  assert.match(run({}, ['--status']).output, /Last reset: unfinished/)

  fs.rmSync(after)
  const again = run()
  assert.equal(again.status, 0, again.output)
})

test('a reset restores the sample data, locks the sample accounts and empties the uploads', { skip: !HAS_POSTGRES, timeout: 300000 }, async t => {
  const { port, stop } = await startCluster('demo-reset-run')
  t.after(stop)
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const root = project(t)
  const run = runner(root, url)
  const uploads = path.join(root, 'uploads')

  assert.match(run({}, ['--status']).output, /Last reset: never/)

  const first = run()
  assert.equal(first.status, 0, first.output)
  const client = await connect(t, url)

  const lastReset = async () => (await client.query('SELECT last_reset_at FROM _nextspark_demo')).rows[0].last_reset_at as Date
  const firstReset = await lastReset()
  assert.ok(firstReset instanceof Date)
  assert.match(run({}, ['--status']).output, new RegExp(`Last reset: ${firstReset.toISOString().slice(0, 16)}`))
  assert.equal(run({}, ['--stauts']).status, 1)
  assert.equal((await lastReset()).getTime(), firstReset.getTime(), 'a mistyped flag resets nothing')

  const accounts = (await client.query(`SELECT u.email, u.role, a.password IS NOT NULL AS "hasPassword", count(tm.*)::int AS teams FROM users u JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential' LEFT JOIN team_members tm ON tm."userId" = u.id GROUP BY 1, 2, 3 ORDER BY 1`)).rows
  assert.deepEqual(accounts.map(a => a.email), ['developer@nextspark.dev', 'superadmin@nextspark.dev'])
  for (const account of accounts) {
    assert.equal(account.role, 'member', `${account.email} keeps no global role`)
    assert.equal(account.hasPassword, true, `${account.email} can sign in`)
    assert.ok(account.teams > 0, `${account.email} still has a team`)
  }
  assert.equal((await client.query('SELECT count(*)::int AS n FROM session')).rows[0].n, 0)
  // the recreated schema keeps what 022 grants the application role
  assert.equal((await client.query(`SELECT has_schema_privilege('nextspark_app', 'public', 'USAGE') AND has_table_privilege('nextspark_app', 'public.users', 'SELECT') AS ok`)).rows[0].ok, true)
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM api_key WHERE status IS DISTINCT FROM 'inactive'`)).rows[0].n, 0)

  // what a visitor leaves behind
  await client.query(`INSERT INTO users (id, email, name, "firstName", "lastName", role, "emailVerified", language, country, timezone, "createdAt", "updatedAt")
    VALUES ('visitor', 'visitor@example.test', 'V', 'V', 'V', 'member', true, 'en', 'US', 'UTC', now(), now())`)
  fs.writeFileSync(path.join(uploads, UPLOAD), 'visitor file')
  fs.writeFileSync(path.join(uploads, 'keep.txt'), 'not an upload')

  const second = run()
  assert.equal(second.status, 0, second.output)
  assert.match(second.output, /1 upload\(s\) removed/)
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM users WHERE email = 'visitor@example.test'`)).rows[0].n, 0)
  assert.equal(fs.existsSync(path.join(uploads, UPLOAD)), false, 'the upload is gone')
  assert.equal(fs.existsSync(path.join(uploads, 'keep.txt')), true, 'a file the server did not name is left')
  assert.ok((await lastReset()) > firstReset, 'the time moved')
})

test('the sample-data policy opens production only for a demo reset', () => {
  const production = { NODE_ENV: 'production' }
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'], env: production }).apply, false)
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'], env: { ...production, NEXTSPARK_DEMO_MODE: 'true' } }).apply, false, 'demo mode alone is not enough')
  assert.equal(sampleDataPolicy({ argv: ['--demo-reset'], env: production }).apply, false, 'the flag alone is not enough')
  assert.equal(sampleDataPolicy({ argv: ['--demo-reset'], env: { ...production, NEXTSPARK_DEMO_MODE: 'true' } }).apply, true)
})
