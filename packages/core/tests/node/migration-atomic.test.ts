/**
 * db:migrate against a real PostgreSQL: each migration file runs in one
 * transaction with its record, so a run stopped after the file but before the
 * COMMIT, by a failing record or a killed process, leaves neither the file's
 * changes nor its record, and the next run applies it once: a file that drops
 * and recreates a table does not drop the rows written after it ran. A file that
 * manages its own transactions is not run unless it starts with the line that
 * runs it outside the runner's transaction, and then runs as it is.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and
 * is skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { NO_TRANSACTION_MARKER } from '../../scripts/db/migration-time-limit.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster with one database, stopped and removed after the test. */
async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-atomic-pg-'))
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

/** A project in monorepo layout whose `widgets` entity has the given migration files. */
function project(t: TestContext, widgets: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-atomic-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'entities/widgets/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.5' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const write = (files: Record<string, string>) => {
    for (const [file, sql] of Object.entries(files)) fs.writeFileSync(path.join(root, 'entities/widgets/migrations', file), sql)
  }
  write(widgets)
  return { root, write }
}

function migrate(root: string, url: string) {
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const result = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

async function value(client: pg.Client, sql: string) {
  return (await client.query({ text: sql, rowMode: 'array' })).rows[0]?.[0]
}

const records = (client: pg.Client, file: string) =>
  value(client, `SELECT count(*)::int FROM "_entity_migrations" WHERE filename = '${file}'`)

const SEED = {
  '001_widgets_table.sql': 'DROP TABLE IF EXISTS widgets CASCADE; CREATE TABLE widgets (id int PRIMARY KEY);',
}
const ADDS_ROW = { '002_widgets_row.sql': 'ALTER TABLE widgets ADD COLUMN name text; INSERT INTO widgets VALUES (1, $$first$$);' }

test('a record that fails after the file has run leaves neither the file nor the record, and the next run applies it once', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const { root, write } = project(t, SEED)
  assert.equal(migrate(root, url).status, 0)

  await client.query(`
    CREATE FUNCTION refuse_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'record refused'; END $$;
    CREATE TRIGGER refuse_record BEFORE INSERT ON "_entity_migrations" FOR EACH ROW EXECUTE FUNCTION refuse_record();
  `)
  write(ADDS_ROW)
  const failed = migrate(root, url)
  assert.equal(failed.status, 1, failed.output)
  assert.equal(await value(client, `SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'widgets' AND column_name = 'name'`), 0)
  assert.equal(await value(client, 'SELECT count(*)::int FROM widgets'), 0)
  assert.equal(await records(client, '002_widgets_row.sql'), 0)
  assert.match(failed.output, /002_widgets_row\.sql: the file ran to the end, but recording it as run in "_entity_migrations" failed: record refused\. It ran in one transaction with its record/)

  await client.query('DROP TRIGGER refuse_record ON "_entity_migrations"')
  for (let run = 0; run < 2; run++) {
    const applied = migrate(root, url)
    assert.equal(applied.status, 0, applied.output)
    assert.equal(await value(client, 'SELECT count(*)::int FROM widgets'), 1)
    assert.equal(await records(client, '002_widgets_row.sql'), 1)
  }
})

test('a run killed after the file has run, while its record waits, leaves neither, and the next run applies the file once', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const { root, write } = project(t, SEED)
  assert.equal(migrate(root, url).status, 0)

  // a file like the shipped 001_*_table.sql ones: run twice, it drops the rows written in between
  const rebuilds = { '002_gadgets_table.sql': 'DROP TABLE IF EXISTS gadgets CASCADE; CREATE TABLE gadgets (id int PRIMARY KEY); INSERT INTO gadgets VALUES (1);' }
  write(rebuilds)
  // SHARE mode holds the record's INSERT, not the SELECT that checks for it
  const locker = new pg.Client({ connectionString: url })
  // the cluster stops under it at the end of the test
  locker.on('error', () => {})
  await locker.connect()
  t.after(() => locker.end())
  await locker.query('BEGIN; LOCK TABLE "_entity_migrations" IN SHARE MODE')

  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const child = spawn(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, stdio: 'ignore' })
  t.after(() => child.kill('SIGKILL'))
  let backend: number | undefined
  for (const started = Date.now(); backend === undefined && Date.now() - started < 30000; ) {
    backend = await value(client, `SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'INSERT INTO "_entity_migrations"%'`)
    if (backend === undefined) await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert.ok(backend, 'the record never waited on the lock')
  child.kill('SIGKILL')
  // Postgres notices the client is gone only once the INSERT gets its lock; ending the session stands for that
  await client.query(`SELECT pg_terminate_backend(${backend})`)
  await locker.query('ROLLBACK')

  assert.equal(await value(client, `SELECT to_regclass('gadgets')::text`), null)
  assert.equal(await records(client, '002_gadgets_table.sql'), 0)

  const applied = migrate(root, url)
  assert.equal(applied.status, 0, applied.output)
  await client.query('INSERT INTO gadgets VALUES (2)')
  assert.equal(migrate(root, url).status, 0)
  assert.deepEqual((await client.query('SELECT id FROM gadgets ORDER BY id')).rows, [{ id: 1 }, { id: 2 }])
  assert.equal(await records(client, '002_gadgets_table.sql'), 1)
})

test('a file that manages its own transaction is not run unless it starts with the line that runs it outside the transaction', { skip: !HAS_POSTGRES, timeout: 120000 }, async t => {
  const { url, client } = await throwawayDatabase(t)
  const own = 'BEGIN; CREATE TABLE own_table (id int); COMMIT;'
  const { root, write } = project(t, { ...SEED, '002_own.sql': own })

  const refused = migrate(root, url)
  assert.equal(refused.status, 1, refused.output)
  assert.match(refused.output, /002_own\.sql: the file was not run: it has a BEGIN statement/)
  assert.equal(await value(client, `SELECT to_regclass('own_table')::text`), null)
  assert.equal(await records(client, '002_own.sql'), 0)

  write({ '002_own.sql': `${NO_TRANSACTION_MARKER}\n${own}`, '003_index.sql': 'CREATE INDEX CONCURRENTLY widgets_id ON widgets (id);' })
  const concurrently = migrate(root, url)
  assert.equal(concurrently.status, 1, concurrently.output)
  assert.match(concurrently.output, /CREATE INDEX CONCURRENTLY cannot run inside a transaction block\. .*needs the file to start with the line -- nextspark:no-transaction/)
  assert.equal(await records(client, '002_own.sql'), 1)
  assert.equal(await value(client, `SELECT to_regclass('own_table')::text`), 'own_table')

  write({ '003_index.sql': `-- Builds the index without blocking writes.\n${NO_TRANSACTION_MARKER}\nCREATE INDEX CONCURRENTLY widgets_id ON widgets (id);` })
  const marked = migrate(root, url)
  assert.equal(marked.status, 0, marked.output)
  assert.equal(await value(client, `SELECT to_regclass('widgets_id')::text`), 'widgets_id')
  assert.equal(await records(client, '003_index.sql'), 1)
})
