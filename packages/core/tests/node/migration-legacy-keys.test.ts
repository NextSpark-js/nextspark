/**
 * db:migrate against a real PostgreSQL, on a database a 0.x project migrated
 * while its migrations lived in contents/themes/<theme>: 0.1.0-beta.184 recorded
 * them as ('theme', <theme>) and ('theme-settings', '<theme>/settings/<area>'),
 * root-first records them as ('project', <name>) and ('project-settings', …).
 * A project migration recorded under the theme the project came from is not run
 * again; it is recorded for the project. The theme is the only one the table
 * names, or NEXT_PUBLIC_ACTIVE_THEME when it names several; otherwise nothing
 * runs. An entity whose directory went from campaign_members to
 * campaign-members (slugs are lowercase identifiers with hyphens) keeps its
 * entity migrations too.
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

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { name: string; after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster with one s138_ database, stopped and removed after the test. */
async function throwawayDatabase(t: TestContext, name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-legacy-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const admin = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  await admin.connect()
  await admin.query(`CREATE DATABASE s138_${name}`)
  await admin.end()
  const url = `postgresql://owner@127.0.0.1:${port}/s138_${name}?sslmode=disable`
  const client = new pg.Client({ connectionString: url })
  // the cluster stops under it at the end of the test
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  return { url, client }
}

/** A root-first project with one core migration and the given project files. */
function project(t: TestContext, files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-legacy-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const all = {
    'packages/core/migrations/001_core.sql': 'CREATE TABLE core_marker (id int);',
    'nextspark.config.ts': 'export default { plugins: [] }\n',
    'package.json': JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.8' } }),
    'pnpm-workspace.yaml': 'packages: []\n',
    'config/theme.config.ts': "export const themeConfig = { name: 'fixture' }\n",
    ...files,
  }
  for (const [file, content] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  return root
}

function migrate(root: string, url: string, extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, ...extra }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  if (!('NEXT_PUBLIC_ACTIVE_THEME' in extra)) delete env.NEXT_PUBLIC_ACTIVE_THEME
  const result = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
  const output = `${result.stdout}${result.stderr}`
  if (process.env.S138_LOG_DIR) fs.appendFileSync(path.join(process.env.S138_LOG_DIR, 'runner-output.log'), `\n===== ${extra.LABEL ?? ''}\n${output}`)
  return { status: result.status, output }
}

async function value(client: pg.Client, sql: string) {
  return (await client.query({ text: sql, rowMode: 'array' })).rows[0]?.[0]
}

async function rows(client: pg.Client, sql: string) {
  return (await client.query({ text: sql, rowMode: 'array' })).rows
}

/** The tracking tables as 0.1.0-beta.184 created them, with what it ran. */
async function legacyDatabase(client: pg.Client, content: [string, string, string][], entity: [string, string][] = []) {
  await client.query(`
    CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "_content_migrations" (
      id SERIAL PRIMARY KEY, source_type TEXT NOT NULL, source_name TEXT NOT NULL, filename TEXT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_type, source_name, filename)
    );
    CREATE TABLE "_entity_migrations" (
      id SERIAL PRIMARY KEY, entity_name TEXT NOT NULL, source_type TEXT NOT NULL, source_name TEXT NOT NULL, filename TEXT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(entity_name, filename)
    );
    INSERT INTO "_migrations" (filename) VALUES ('001_core.sql');
    CREATE TABLE core_marker (id int);
  `)
  for (const [type, name, file] of content) {
    await client.query(`INSERT INTO "_content_migrations" (source_type, source_name, filename, executed_at) VALUES ($1, $2, $3, '2026-01-02 03:04:05')`, [type, name, file])
  }
  for (const [name, file] of entity) {
    await client.query(`INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename) VALUES ($1, 'theme', 'acme', $2)`, [name, file])
  }
}

// Not idempotent: a second run fails on the primary key
const SEED = { 'migrations/010_seed.sql': 'CREATE TABLE IF NOT EXISTS seeded (id int PRIMARY KEY); INSERT INTO seeded VALUES (1);' }
const SETTINGS = { 'settings/general/migrations/020_settings.sql': 'CREATE TABLE settings_general (id int);' }
const SEEDED_BEFORE = 'CREATE TABLE seeded (id int PRIMARY KEY); INSERT INTO seeded VALUES (1);'

const projectRows = (client: pg.Client) =>
  rows(client, `SELECT source_type, source_name, filename, executed_at::text FROM "_content_migrations" WHERE source_type LIKE 'project%' ORDER BY filename`)

test('(a) a migration the theme already ran is not run again, and is recorded for the project; (f) a second run does nothing', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'a')
  await legacyDatabase(client, [['theme', 'acme', '010_seed.sql'], ['theme-settings', 'acme/settings/general', '020_settings.sql']])
  await client.query(`${SEEDED_BEFORE} CREATE TABLE settings_general (id int);`)
  const root = project(t, { ...SEED, ...SETTINGS })

  const first = migrate(root, url, { LABEL: '(a) first run' })
  assert.equal(first.status, 0, first.output)
  assert.match(first.output, /010_seed\.sql: already applied as theme acme; recorded for the project/)
  assert.match(first.output, /020_settings\.sql: already applied as theme acme; recorded for the project/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM seeded'), 1)
  assert.deepEqual(await projectRows(client), [
    ['project', 'fixture', '010_seed.sql', '2026-01-02 03:04:05'],
    ['project-settings', 'fixture/settings/general', '020_settings.sql', '2026-01-02 03:04:05'],
  ])
  // the legacy rows stay
  assert.equal(await value(client, `SELECT count(*)::int FROM "_content_migrations" WHERE source_type LIKE 'theme%'`), 2)

  const second = migrate(root, url, { LABEL: '(f) second run' })
  assert.equal(second.status, 0, second.output)
  assert.doesNotMatch(second.output, /already applied as theme/)
  assert.match(second.output, /010_seed\.sql \(already executed\)/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM "_content_migrations"'), 4)
  assert.equal(await value(client, 'SELECT count(*)::int FROM seeded'), 1)
})

test('(b) two themes and no NEXT_PUBLIC_ACTIVE_THEME: the run stops before anything, naming them', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'b')
  await legacyDatabase(client, [['theme', 'acme', '010_seed.sql'], ['theme', 'beta', '010_seed.sql']])
  await client.query(`${SEEDED_BEFORE} DROP TABLE core_marker; DELETE FROM "_migrations";`)
  const root = project(t, SEED)

  const result = migrate(root, url, { LABEL: '(b) two themes, no env' })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /recorded under more than one theme: acme, beta\. Set NEXT_PUBLIC_ACTIVE_THEME to the theme this project was migrated from/)
  // nothing ran: not the core migration, not the project's
  assert.equal(await value(client, `SELECT to_regclass('core_marker')::text`), null)
  assert.equal(await value(client, 'SELECT count(*)::int FROM "_migrations"'), 0)
  assert.deepEqual(await projectRows(client), [])
})

test('(c) two themes with NEXT_PUBLIC_ACTIVE_THEME: that theme is the one the project came from', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'c')
  await legacyDatabase(client, [['theme', 'acme', '010_seed.sql'], ['theme', 'acme', '011_other.sql'], ['theme', 'beta', '010_seed.sql']])
  await client.query(SEEDED_BEFORE)
  const root = project(t, { ...SEED, 'migrations/011_other.sql': 'CREATE TABLE other_table (id int);' })

  const result = migrate(root, url, { LABEL: '(c) two themes, env beta', NEXT_PUBLIC_ACTIVE_THEME: 'beta' })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /010_seed\.sql: already applied as theme beta; recorded for the project/)
  // acme ran 011, beta did not: it runs
  assert.doesNotMatch(result.output, /011_other\.sql: already applied/)
  assert.equal(await value(client, `SELECT to_regclass('other_table')::text`), 'other_table')
  assert.deepEqual((await projectRows(client)).map(row => row[2]), ['010_seed.sql', '011_other.sql'])
})

test('(d) a database with no legacy rows runs the project migrations as before', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'd')
  const root = project(t, { ...SEED, ...SETTINGS, 'entities/campaign-members/migrations/001_campaign_members.sql': 'CREATE TABLE campaign_members (id int);' })

  const result = migrate(root, url, { LABEL: '(d) fresh database', NEXT_PUBLIC_ACTIVE_THEME: 'acme' })
  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /already applied as/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM seeded'), 1)
  assert.deepEqual((await projectRows(client)).map(row => row.slice(0, 3)), [
    ['project', 'fixture', '010_seed.sql'],
    ['project-settings', 'fixture/settings/general', '020_settings.sql'],
  ])
  assert.deepEqual(await rows(client, 'SELECT entity_name, filename FROM "_entity_migrations"'), [['campaign-members', '001_campaign_members.sql']])
})

test('(e) an entity renamed from campaign_members to campaign-members keeps the migrations it ran', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'e')
  await legacyDatabase(client, [], [['campaign_members', '001_campaign_members.sql']])
  await client.query('CREATE TABLE campaign_members (id int);')
  const root = project(t, {
    'entities/campaign-members/migrations/001_campaign_members.sql': 'CREATE TABLE campaign_members (id int);',
    'entities/campaign-members/migrations/002_campaign_members_name.sql': 'ALTER TABLE campaign_members ADD COLUMN name text;',
  })

  const first = migrate(root, url, { LABEL: '(e) entity rename' })
  assert.equal(first.status, 0, first.output)
  assert.match(first.output, /001_campaign_members\.sql: already applied as entity campaign_members; recorded for campaign-members/)
  assert.equal(await value(client, `SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'campaign_members' AND column_name = 'name'`), 1)
  assert.deepEqual(await rows(client, 'SELECT entity_name, source_type, filename FROM "_entity_migrations" ORDER BY entity_name, filename'), [
    ['campaign-members', 'project', '001_campaign_members.sql'],
    ['campaign-members', 'project', '002_campaign_members_name.sql'],
    ['campaign_members', 'theme', '001_campaign_members.sql'],
  ])

  const second = migrate(root, url, { LABEL: '(e) second run' })
  assert.equal(second.status, 0, second.output)
  assert.doesNotMatch(second.output, /already applied as entity/)
})

test('(g) an underscore entity recorded elsewhere, or with no theme to come from, is not taken over by a new hyphenated one', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'g')
  await legacyDatabase(client, [])
  // foo_bar came from a plugin, baz_qux was a root-first entity; both were dropped since
  await client.query(`
    INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename) VALUES
      ('foo_bar', 'plugin', 'old-plugin', '001_create.sql'),
      ('baz_qux', 'project', 'fixture', '001_create.sql');
  `)
  const root = project(t, {
    'entities/foo-bar/migrations/001_create.sql': 'CREATE TABLE foo_bar_v2 (id int);',
    'entities/baz-qux/migrations/001_create.sql': 'CREATE TABLE baz_qux_v2 (id int);',
  })

  const result = migrate(root, url, { LABEL: '(g) other source, no legacy theme' })
  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /already applied as entity/)
  assert.equal(await value(client, `SELECT to_regclass('foo_bar_v2')::text`), 'foo_bar_v2')
  assert.equal(await value(client, `SELECT to_regclass('baz_qux_v2')::text`), 'baz_qux_v2')
})

test('(h) an unrelated entity row of another theme does not make a content takeover ambiguous', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t, 'h')
  await legacyDatabase(client, [['theme', 'acme', '010_seed.sql']])
  await client.query(`${SEEDED_BEFORE} INSERT INTO "_entity_migrations" (entity_name, source_type, source_name, filename) VALUES ('zzz', 'theme', 'beta', '001_zzz.sql');`)
  const root = project(t, SEED)

  const result = migrate(root, url, { LABEL: '(h) content acme, unrelated entity beta, no env' })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /010_seed\.sql: already applied as theme acme; recorded for the project/)
  assert.doesNotMatch(result.output, /more than one theme/)
  assert.equal(await value(client, 'SELECT count(*)::int FROM seeded'), 1)
})
