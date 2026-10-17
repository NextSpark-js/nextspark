/**
 * 040 adds billing_webhook_events (#266), where the billing webhooks claim each event once. db:migrate applies it on a
 * fresh database and on one at 039, and running it again changes nothing. RLS is on with no policy: on the
 * nextspark_app cutover a signed-in user neither reads nor writes it; the service connection does.
 * 041 adds 'polar' to subscriptions."paymentProvider" (#282).
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { CORE, HAS_POSTGRES, cutoverDatabase, asUser } from './_pg-cutover'

const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const MIGRATION = '040_billing_webhook_events.sql'

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-events-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  const client = new pg.Client({ connectionString: url })
  // the cluster stops under it at the end of the test
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  return { url, client }
}

/** db:migrate from a minimal project with no entities of its own: it applies core's migrations. */
function migrate(t: TestContext, url: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-events-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const result = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

async function uniqueKey(client: pg.Client) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.billing_webhook_events'::regclass AND contype = 'u'`,
  )
  return rows.map(r => r.def)
}

async function claimTwice(client: pg.Client) {
  const claim = `INSERT INTO billing_webhook_events (gateway, "eventId") VALUES ('stripe', 'evt_1')
                 ON CONFLICT (gateway, "eventId") DO NOTHING RETURNING id`
  return [(await client.query(claim)).rowCount, (await client.query(claim)).rowCount]
}

test('db:migrate creates billing_webhook_events on a fresh database', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(t, url)
  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /Successfully executed 040_billing_webhook_events\.sql/)
  assert.deepEqual(await uniqueKey(client), ['UNIQUE (gateway, "eventId")'])
  assert.deepEqual(await claimTwice(client), [1, 0])
})

test('db:migrate applies 040 on a database at 039, and applying it again changes nothing', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  // a database an earlier db:migrate brought to 039
  await client.query(`CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  const before = fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f < MIGRATION && f !== '090_sample_data.sql').sort()
  assert.equal(before.at(-1), '039_team_members_admin_insert.sql')
  for (const file of before) {
    await client.query(fs.readFileSync(path.join(CORE, 'migrations', file), 'utf8'))
    await client.query('INSERT INTO "_migrations" (filename) VALUES ($1)', [file])
  }
  assert.equal((await client.query(`SELECT to_regclass('public.billing_webhook_events') AS t`)).rows[0].t, null)

  const run = migrate(t, url)
  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /Running 040_billing_webhook_events\.sql/)
  assert.doesNotMatch(run.output, /Running 039_/)
  assert.deepEqual(await claimTwice(client), [1, 0])

  await client.query(fs.readFileSync(path.join(CORE, 'migrations', MIGRATION), 'utf8'))
  assert.deepEqual(await uniqueKey(client), ['UNIQUE (gateway, "eventId")'])
  assert.equal((await client.query('SELECT count(*)::int AS n FROM billing_webhook_events')).rows[0].n, 1)
})

test('on the nextspark_app cutover a signed-in user neither reads nor writes billing_webhook_events', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app } = await cutoverDatabase(t)
  const as = asUser(app)
  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('u1', 'u1@example.test', 'U1', 'superadmin', true);
    INSERT INTO billing_webhook_events (gateway, "eventId") VALUES ('stripe', 'evt_1');
  `)

  assert.equal((await as('u1', 'SELECT * FROM billing_webhook_events')).rowCount, 0)
  await assert.rejects(
    as('u1', `INSERT INTO billing_webhook_events (gateway, "eventId") VALUES ('stripe', 'evt_2')`),
    /row-level security/,
  )
  assert.equal((await as('u1', `DELETE FROM billing_webhook_events WHERE "eventId" = 'evt_1'`)).rowCount, 0)
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM billing_webhook_events')).rows[0].n, 1)
})

async function providerCheck(client: pg.Client) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.subscriptions'::regclass AND conname = 'subscriptions_paymentProvider_check'`,
  )
  return rows.map(r => r.def)
}

test('041 adds polar to subscriptions."paymentProvider", keeps a provider a project added, and is idempotent (#282)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const run = migrate(t, url)
  assert.equal(run.status, 0, run.output)
  assert.match(run.output, /Successfully executed 041_subscriptions_payment_provider_polar\.sql/)
  const accepted = `CHECK (("paymentProvider" = ANY (ARRAY['stripe'::text, 'paddle'::text, 'lemonsqueezy'::text, 'polar'::text])))`
  assert.deepEqual(await providerCheck(client), [accepted])

  const migration041 = fs.readFileSync(path.join(CORE, 'migrations/041_subscriptions_payment_provider_polar.sql'), 'utf8')
  await client.query(migration041)
  assert.deepEqual(await providerCheck(client), [accepted])

  // a project that had added its own provider to 013's list
  await client.query(`ALTER TABLE subscriptions DROP CONSTRAINT "subscriptions_paymentProvider_check";
    ALTER TABLE subscriptions ADD CONSTRAINT "subscriptions_paymentProvider_check" CHECK ("paymentProvider" IN ('stripe', 'mercadopago'))`)
  await client.query(migration041)
  assert.deepEqual(await providerCheck(client), [`CHECK (("paymentProvider" = ANY (ARRAY['stripe'::text, 'mercadopago'::text, 'polar'::text])))`])
})
