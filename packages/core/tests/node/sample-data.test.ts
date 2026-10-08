/**
 * Sample data and db:migrate against a real PostgreSQL, with core's real
 * migrations: sample data is applied only on a development opt-in and never
 * when NODE_ENV is production, and 029_sample_accounts_outside_development.sql
 * disables the sample accounts a database already holds without changing
 * anything else.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and
 * is skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { isSampleDataMigration, sampleDataPolicy } from '../../scripts/db/sample-data.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const DISABLING = '029_sample_accounts_outside_development.sql'
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

test('the sample-data switch applies only outside production', () => {
  assert.equal(sampleDataPolicy({}).apply, false)
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'] }).apply, true)
  assert.equal(sampleDataPolicy({ env: { NEXTSPARK_SEED_SAMPLE_DATA: '1' } }).apply, true)
  assert.equal(sampleDataPolicy({ fileEnv: { NEXTSPARK_SEED_SAMPLE_DATA: '1', NODE_ENV: 'development' } }).apply, true)
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'], env: { NODE_ENV: 'production' } }).apply, false)
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'], fileEnv: { NODE_ENV: 'production' } }).apply, false)
  // production however a .env or a shell writes it
  for (const NODE_ENV of ['Production', 'PRODUCTION', ' production ', 'production # live', '"production" # live', 'production\r']) {
    assert.equal(sampleDataPolicy({ argv: ['--sample-data'], fileEnv: { NODE_ENV } }).apply, false, NODE_ENV)
    assert.equal(sampleDataPolicy({ argv: ['--sample-data'], env: { NODE_ENV } }).apply, false, NODE_ENV)
  }
  assert.equal(sampleDataPolicy({ argv: ['--sample-data'], env: { NODE_ENV: 'productionish' } }).apply, true)
  assert.equal(sampleDataPolicy({ fileEnv: { NEXTSPARK_SEED_SAMPLE_DATA: '1 # local' } }).apply, true)
  assert.equal(sampleDataPolicy({ fileEnv: { NEXTSPARK_SEED_SAMPLE_DATA: '0' } }).apply, false)
  assert.match(sampleDataPolicy({ argv: ['--sample-data'], env: { NODE_ENV: 'production' } }).notice, /NODE_ENV is production/)
  assert.equal(isSampleDataMigration('090_sample_data.sql'), true)
  assert.equal(isSampleDataMigration('090_demo_users.sql', '-- Migration\n-- nextspark:sample-data\nINSERT 1;'), true)
  assert.equal(isSampleDataMigration('001_table.sql', 'CREATE TABLE t ();'), false)
})

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster with one database, stopped and removed after the test. */
async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sample-data-pg-'))
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

/**
 * A project in monorepo layout with core's real migrations (without 029 when
 * `withDisabling` is false: core as published before it) and a project
 * sample-data file and a marked one.
 */
function project(t: TestContext, { withDisabling = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sample-data-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const coreMigrations = path.join(root, 'packages/core/migrations')
  fs.mkdirSync(coreMigrations, { recursive: true })
  for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql'))) {
    if (withDisabling || file !== DISABLING) fs.copyFileSync(path.join(CORE, 'migrations', file), path.join(coreMigrations, file))
  }
  fs.mkdirSync(path.join(root, 'migrations'), { recursive: true })
  fs.writeFileSync(path.join(root, 'migrations/010_widgets.sql'), 'CREATE TABLE widgets (id int PRIMARY KEY);')
  fs.writeFileSync(path.join(root, 'migrations/020_demo_widgets.sql'), '-- nextspark:sample-data\nINSERT INTO widgets VALUES (1);')
  fs.writeFileSync(path.join(root, 'migrations/999_theme_sample_data.sql'), 'INSERT INTO widgets VALUES (2);')
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.6' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  return {
    root,
    addDisabling: () => fs.copyFileSync(path.join(CORE, 'migrations', DISABLING), path.join(coreMigrations, DISABLING)),
  }
}

function migrate(root: string, url: string, { args = [] as string[], env = {} as Record<string, string>, envFile = false } = {}) {
  const childEnv: Record<string, string | undefined> = { ...process.env, DATABASE_URL: url, NODE_ENV: 'development' }
  delete childEnv.MIGRATE_DATABASE_URL
  delete childEnv.MIGRATION_TIMEOUT_SECONDS
  delete childEnv.NEXTSPARK_SEED_SAMPLE_DATA
  // with the project .env, NODE_ENV comes from it
  if (envFile) delete childEnv.NODE_ENV
  Object.assign(childEnv, env)
  const result = spawnSync(process.execPath, [RUNNER, ...(envFile ? [] : ['--no-env-file']), ...args], { cwd: root, env: childEnv as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 120000 })
  const output = `${result.stdout}${result.stderr}`
  assert.equal(result.status, 0, output)
  return output
}

async function value(client: pg.Client, sql: string, params: unknown[] = []) {
  return (await client.query({ text: sql, values: params, rowMode: 'array' })).rows[0]?.[0]
}

const SAMPLE_USERS = ['test-superadmin-001', 'test-developer-001']

test('without the opt-in, or in production, db:migrate applies no sample data and records none', { skip: !HAS_POSTGRES, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const { root } = project(t)

  const plain = migrate(root, url)
  assert.match(plain, /Sample data is not applied\. For a local development database, run `pnpm db:seed`/)
  assert.match(plain, /Skipping 090_sample_data\.sql \(sample data\)/)

  // production wins over the switch, from the environment or from the project .env
  const production = migrate(root, url, { args: ['--sample-data'], env: { NODE_ENV: 'production', NEXTSPARK_SEED_SAMPLE_DATA: '1' } })
  assert.match(production, /Sample data is not applied: NODE_ENV is production, which the sample-data switch does not override/)
  fs.writeFileSync(path.join(root, '.env'), `DATABASE_URL=${url}\nNODE_ENV="production"\nNEXTSPARK_SEED_SAMPLE_DATA=1\n`)
  assert.match(migrate(root, url, { args: ['--sample-data'], envFile: true }), /NODE_ENV is production/)
  fs.writeFileSync(path.join(root, '.env'), `DATABASE_URL=${url}\nexport NODE_ENV=Production # live\n`)
  assert.match(migrate(root, url, { args: ['--sample-data'], envFile: true }), /NODE_ENV is production/)
  fs.rmSync(path.join(root, '.env'))

  assert.equal(await value(client, 'SELECT count(*)::int FROM users'), 0)
  assert.equal(await value(client, 'SELECT count(*)::int FROM widgets'), 0)
  assert.equal(await value(client, `SELECT count(*)::int FROM "_migrations" WHERE filename = '090_sample_data.sql'`), 0)
  assert.equal(await value(client, `SELECT count(*)::int FROM "_content_migrations" WHERE filename IN ('020_demo_widgets.sql', '999_theme_sample_data.sql')`), 0)

  // run outside an opted-in runner session (a tool applying every core file in order), 090 refuses
  await assert.rejects(client.query(fs.readFileSync(path.join(CORE, 'migrations/090_sample_data.sql'), 'utf8')), /Sample data is applied only by `pnpm db:seed`/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM users'), 0)

  // a development opt-in later still applies all of it, and keeps the sample accounts usable
  const seeded = migrate(root, url, { args: ['--sample-data'] })
  assert.match(seeded, /Sample data is applied \(development\)/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM widgets'), 2)
  assert.equal(await value(client, `SELECT count(*)::int FROM account WHERE "userId" = ANY($1) AND password IS NOT NULL`, [SAMPLE_USERS]), 2)
  assert.equal(await value(client, `SELECT role FROM users WHERE id = 'test-superadmin-001'`), 'superadmin')
})

test('a database seeded before the upgrade: 029 disables the sample accounts once and changes nothing else', { skip: !HAS_POSTGRES, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const { root, addDisabling } = project(t, { withDisabling: false })
  // core as published before: the sample data was applied by a plain db:migrate
  migrate(root, url, { args: ['--sample-data'] })

  // data of the project's own, and the sample accounts used since
  await client.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('real-owner', 'owner@example.test', 'Owner', 'superadmin', true);
    INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
      VALUES ('real-account', 'real-owner', 'owner@example.test', 'credential', 'aaaa:bbbb', now(), now());
    INSERT INTO session (id, "userId", "expiresAt", token, "createdAt", "updatedAt") VALUES
      ('real-session', 'real-owner', now() + interval '1 day', 'real-token', now(), now()),
      ('later-session', 'test-developer-001', now() + interval '1 day', 'later-token', now(), now());
    INSERT INTO api_key (id, "keyHash", "keyPrefix", name, "userId") VALUES ('real-key', 'real-hash', 'real', 'Real', 'real-owner');
    INSERT INTO api_key (id, "keyHash", "keyPrefix", name, "userId", status) VALUES ('no-status-key', 'no-status-hash', 'nostatus', 'No status', 'test-developer-001', NULL);
    INSERT INTO api_audit_log ("apiKeyId", "userId", method, endpoint, "statusCode")
      VALUES ('cb48859f-70a0-4f21-8417-93b1d930838f', 'test-superadmin-001', 'GET', '/api/v1/users', 200);
  `)
  // everything 029 must not change, one digest per part so a failure names it
  const untouched = `
    SELECT jsonb_object_agg(part, digest) FROM (
      SELECT part, md5(string_agg(row_text, '|' ORDER BY row_text)) AS digest FROM (
        SELECT 'users' AS part, (u.id, u.email, u.name, u."emailVerified")::text AS row_text FROM users u
        UNION ALL SELECT 'real owner role', u.role::text FROM users u WHERE u.id = 'real-owner'
        UNION ALL SELECT 'real account', (a.*)::text FROM account a WHERE a.id = 'real-account'
        UNION ALL SELECT 'real session', (s.*)::text FROM session s WHERE s.id = 'real-session'
        UNION ALL SELECT 'real key', (k.id, k."keyHash", k.name, k."userId", k.status)::text FROM api_key k WHERE k.id = 'real-key'
        UNION ALL SELECT 'api_audit_log', (l.*)::text FROM api_audit_log l
        UNION ALL SELECT 'teams', (x.*)::text FROM teams x
        -- the System Admin Team membership follows the global role (027's trigger), checked below
        UNION ALL SELECT 'team_members', (x.*)::text FROM team_members x WHERE NOT (x."teamId" = 'team-nextspark-001' AND x."userId" = ANY (ARRAY['test-superadmin-001', 'test-developer-001']))
        UNION ALL SELECT 'users_metas', (x.*)::text FROM users_metas x
        UNION ALL SELECT 'media', (x.*)::text FROM media x
        UNION ALL SELECT 'widgets', (x.*)::text FROM widgets x
      ) parts GROUP BY part
    ) digests`
  const before = await value(client, untouched)

  addDisabling()
  const upgraded = migrate(root, url)
  assert.match(upgraded, /Sample accounts: 2 disabled/)

  assert.equal(await value(client, `SELECT count(*)::int FROM account WHERE "userId" = ANY($1)`, [SAMPLE_USERS]), 0)
  assert.equal(await value(client, `SELECT count(*)::int FROM session WHERE "userId" = ANY($1)`, [SAMPLE_USERS]), 0)
  assert.equal(await value(client, `SELECT count(*)::int FROM api_key WHERE "userId" = ANY($1) AND status IS DISTINCT FROM 'inactive'`, [SAMPLE_USERS]), 0)
  assert.deepEqual((await client.query(`SELECT DISTINCT role FROM users WHERE id = ANY($1)`, [SAMPLE_USERS])).rows, [{ role: 'member' }])
  assert.equal(await value(client, `SELECT count(*)::int FROM team_members WHERE "teamId" = 'team-nextspark-001' AND "userId" = ANY($1)`, [SAMPLE_USERS]), 0)
  assert.deepEqual(await value(client, untouched), before)

  // once recorded it does not run again, and running its SQL again changes nothing
  assert.match(migrate(root, url), new RegExp(`Skipping ${DISABLING} \\(already executed\\)`))
  const notices: string[] = []
  client.on('notice', n => notices.push(n.message ?? ''))
  await client.query(fs.readFileSync(path.join(CORE, 'migrations', DISABLING), 'utf8'))
  assert.ok(notices.some(n => /Sample accounts: 0 disabled/.test(n)), notices.join('\n'))
  assert.deepEqual(await value(client, untouched), before)
})

test('029 leaves a sample account whose password was changed, and a development run that opts in keeps them all', { skip: !HAS_POSTGRES, timeout: 240000 }, async t => {
  const { url, client } = await throwawayDatabase(t)

  const kept = project(t, { withDisabling: false })
  migrate(kept.root, url, { args: ['--sample-data'] })
  await client.query(`UPDATE account SET password = 'own:password' WHERE "userId" = 'test-developer-001'`)
  kept.addDisabling()
  assert.match(migrate(kept.root, url), /Sample accounts: 1 disabled/)
  assert.equal(await value(client, `SELECT password FROM account WHERE "userId" = 'test-developer-001'`), 'own:password')
  assert.equal(await value(client, `SELECT role FROM users WHERE id = 'test-developer-001'`), 'developer')
  assert.equal(await value(client, `SELECT role FROM users WHERE id = 'test-superadmin-001'`), 'member')

  const { url: devUrl, client: devClient } = await throwawayDatabase(t)
  const dev = project(t, { withDisabling: false })
  migrate(dev.root, devUrl, { args: ['--sample-data'] })
  dev.addDisabling()
  assert.match(migrate(dev.root, devUrl, { env: { NEXTSPARK_SEED_SAMPLE_DATA: '1' } }), /Sample accounts: kept \(development run with sample data\)/)
  assert.equal(await value(devClient, `SELECT count(*)::int FROM account WHERE "userId" = ANY($1) AND password IS NOT NULL`, [SAMPLE_USERS]), 2)
  assert.equal(await value(devClient, `SELECT role FROM users WHERE id = 'test-superadmin-001'`), 'superadmin')
})
