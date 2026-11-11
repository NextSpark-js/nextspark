/**
 * The tables db:migrate keeps its records in (_migrations, _content_migrations, _entity_migrations) are for the
 * migration role only: row-level security on, no policy, no FORCE, and no privilege for nextspark_app, authenticated
 * or anon, whatever 022's grants and the host's default privileges gave them. Migration 045 does it to the tables a
 * database already has; the runner does it to the ones it creates. The runner, as the owner, keeps reading and writing
 * them, with MIGRATE_DATABASE_URL apart from the DATABASE_URL of the application.
 *
 * Starts throwaway clusters with initdb and pg_ctl on free ports; skipped when they are not on the PATH.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster, type ThrowawayCluster } from '../support/throwaway-postgres'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const CHECK = path.join(CORE, 'scripts/db/check-migration-ledger.mjs')
const MIGRATION = fs.readFileSync(path.join(CORE, 'migrations/045_migration_ledgers_row_level_security.sql'), 'utf8')
const LEDGERS = ['_migrations', '_content_migrations', '_entity_migrations']
const TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
const RUNTIME_ROLES = ['nextspark_app', 'authenticated', 'anon']
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

let cluster: ThrowawayCluster
let admin: pg.Client
const toClean: Array<() => void | Promise<void>> = []
let databases = 0

const url = (user: string, database: string, port = cluster.port) => `postgresql://${user}@127.0.0.1:${port}/${database}?sslmode=disable`

async function connect(connectionString: string) {
  const client = new pg.Client({ connectionString })
  client.on('error', () => {})
  await client.connect()
  toClean.push(() => client.end())
  return client
}

before(async () => {
  if (!HAS_POSTGRES) return
  cluster = await startCluster('ledgers-lockdown-pg')
  admin = await connect(url('owner', 'postgres'))
  // a host that grants every new table to anon and authenticated, and roles for the migration and the application
  for (const sql of [
    'CREATE ROLE anon NOLOGIN', 'CREATE ROLE authenticated NOLOGIN', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT',
    'CREATE ROLE migrator LOGIN CREATEROLE', 'CREATE ROLE stranger LOGIN',
  ]) await admin.query(sql)
}, { timeout: 120000 })

after(async () => {
  for (const clean of toClean.reverse()) await clean()
  cluster?.stop()
})

/** A database owned by the (non-superuser) migration role, where new tables are granted to anon and authenticated like a managed host does. */
async function database() {
  const name = `lockdown_${++databases}`
  await admin.query(`CREATE DATABASE ${name} OWNER migrator`)
  const owner = await connect(url('migrator', name))
  await owner.query('ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated')
  await owner.query('ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated')
  return { name, owner, inspect: await connect(url('owner', name)) }
}

/** What each role can do on a table, asked by a superuser: the table's own flags and every privilege of every runtime role. */
async function access(inspect: pg.Client, table: string) {
  const { rows } = await inspect.query(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forced FROM pg_class WHERE oid = to_regclass($1)`, [`public."${table}"`])
  const granted: string[] = []
  for (const role of RUNTIME_ROLES) {
    for (const privilege of TABLE_PRIVILEGES) {
      const { rows: [has] } = await inspect.query('SELECT has_table_privilege($1, $2, $3) AS has', [role, `public."${table}"`, privilege])
      if (has.has) granted.push(`${role}:${privilege}`)
    }
    const { rows: [sequence] } = await inspect.query(`SELECT pg_get_serial_sequence($1, 'id') AS name`, [`public."${table}"`])
    const { rows: [has] } = await inspect.query(`SELECT has_sequence_privilege($1, $2, 'USAGE, SELECT, UPDATE') AS has`, [role, sequence.name])
    if (has.has) granted.push(`${role}:sequence`)
  }
  return { rls: rows[0]?.rls, forced: rows[0]?.forced, granted }
}

const LOCKED = { rls: true, forced: false, granted: [] }

/** A project in monorepo layout with core's real migrations (no sample data), one project migration and one entity migration. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgers-lockdown-'))
  toClean.push(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql')) {
    fs.copyFileSync(path.join(CORE, 'migrations', file), path.join(root, 'packages/core/migrations', file))
  }
  const write = (relative: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), content)
  }
  write('nextspark.config.ts', 'export default { plugins: [] }\n')
  write('package.json', JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  write('pnpm-workspace.yaml', 'packages: []\n')
  write('config/theme.config.ts', "export const themeConfig = { name: 'fixture' }\n")
  write('migrations/001_project.sql', 'CREATE TABLE project_log (file text); INSERT INTO project_log VALUES (\'001\');')
  write('entities/widgets/migrations/001_widgets.sql', 'CREATE TABLE widget_log (file text);')
  return { root, write }
}

function run(script: string, root: string, env: Record<string, string>, args: string[] = []) {
  const childEnv: Record<string, string | undefined> = { ...process.env, ...env }
  for (const key of ['DATABASE_URL', 'MIGRATE_DATABASE_URL', 'MIGRATION_TIMEOUT_SECONDS', 'NODE_ENV']) if (!(key in env)) delete childEnv[key]
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env: childEnv as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 180000 })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

test('db:migrate creates the ledgers locked to the migration role, which keeps reading and writing them', { skip, timeout: 300000 }, async () => {
  const db = await database()
  const { root, write } = project()
  // the application's own connection does not exist yet: a runner that used DATABASE_URL could not connect
  const env = { MIGRATE_DATABASE_URL: url('migrator', db.name), DATABASE_URL: url('app_login', db.name) }

  const first = run(RUNNER, root, env, ['--no-env-file'])
  assert.equal(first.status, 0, first.out)
  for (const ledger of LEDGERS) assert.deepEqual(await access(db.inspect, ledger), LOCKED, ledger)
  // 022 did grant the tables to the application role, so this is what 045 and the runner took back
  assert.equal((await db.inspect.query(`SELECT has_table_privilege('nextspark_app', 'public.users', 'SELECT') AS has`)).rows[0].has, true)

  // the owner is not subject to the policy-less RLS, and the hash column came without a grant
  for (const ledger of LEDGERS) {
    assert.ok(Number((await db.owner.query(`SELECT count(*) FROM "${ledger}"`)).rows[0].count) > 0, `${ledger} has rows`)
    const { rows: [column] } = await db.inspect.query(`SELECT has_column_privilege('nextspark_app', $1, 'content_hash', 'SELECT') AS app, has_column_privilege('anon', $1, 'content_hash', 'SELECT') AS anon, has_column_privilege('authenticated', $1, 'content_hash', 'SELECT') AS authenticated, has_column_privilege('migrator', $1, 'content_hash', 'SELECT') AS owner`, [`public."${ledger}"`])
    assert.deepEqual(column, { app: false, anon: false, authenticated: false, owner: true }, ledger)
  }

  // the application role: the data tables work, the ledgers do not
  await db.inspect.query('CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS INHERIT IN ROLE nextspark_app')
  const app = await connect(url('app_login', db.name))
  await app.query('SELECT 1 FROM users LIMIT 1')
  for (const ledger of LEDGERS) {
    for (const statement of [`SELECT * FROM "${ledger}"`, `DELETE FROM "${ledger}"`, `UPDATE "${ledger}" SET filename = filename`, `INSERT INTO "${ledger}" (filename) VALUES ('x')`]) {
      await assert.rejects(app.query(statement), (error: any) => error.code === '42501', `${statement} as the application role`)
    }
  }

  // runs after the lockdown still write: nothing pending, then a new migration, an edit, and a dry run
  const second = run(RUNNER, root, env, ['--no-env-file'])
  assert.equal(second.status, 0, second.out)
  write('migrations/002_project.sql', "INSERT INTO project_log VALUES ('002');")
  write('migrations/001_project.sql', "CREATE TABLE project_log (file text); INSERT INTO project_log VALUES ('001'); -- edited\n")
  const dry = run(RUNNER, root, env, ['--no-env-file', '--dry-run'])
  assert.equal(dry.status, 0, dry.out)
  assert.match(dry.out, /002_project\.sql/)
  const third = run(RUNNER, root, env, ['--no-env-file'])
  assert.equal(third.status, 0, third.out)
  assert.match(third.out, /001_project\.sql \(project fixture\)/)
  const { rows } = await db.owner.query(`SELECT filename, content_hash IS NOT NULL AS hashed FROM "_content_migrations" ORDER BY filename`)
  assert.deepEqual(rows, [{ filename: '001_project.sql', hashed: true }, { filename: '002_project.sql', hashed: true }])
  for (const ledger of LEDGERS) assert.deepEqual(await access(db.inspect, ledger), LOCKED, `${ledger} after more runs`)

  // doctor reads the ledgers through the migration connection; the application's cannot
  const checked = run(CHECK, root, env)
  assert.equal(checked.status, 0, checked.out)
  assert.equal(JSON.parse(checked.out).edited[0].file, '001_project.sql')
  const asApp = run(CHECK, root, { DATABASE_URL: url('app_login', db.name) })
  assert.equal(asApp.status, 2, asApp.out)
  assert.match(asApp.out, /belong to their owner.*MIGRATE_DATABASE_URL/)
})

test('045 restricts the ledgers a database already has, leaves other tables alone, and can run again', { skip, timeout: 120000 }, async () => {
  const db = await database()
  // ledgers as an earlier release left them: no RLS, granted to every runtime role (022 and the host's defaults)
  await db.owner.query(`CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL); CREATE TABLE "_content_migrations" (id SERIAL PRIMARY KEY, filename TEXT);
    CREATE TABLE "_entity_migrations" (id SERIAL PRIMARY KEY, filename TEXT); CREATE TABLE tasks (id SERIAL PRIMARY KEY);
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextspark_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nextspark_app`)
  for (const ledger of LEDGERS) assert.notDeepEqual((await access(db.inspect, ledger)).granted, [], `${ledger} starts granted`)
  const tasksBefore = await access(db.inspect, 'tasks')

  await db.owner.query(MIGRATION)
  for (const ledger of LEDGERS) assert.deepEqual(await access(db.inspect, ledger), LOCKED, ledger)
  assert.deepEqual(await access(db.inspect, 'tasks'), tasksBefore, 'a table that is not a ledger keeps its grants and its RLS setting')

  await db.owner.query(MIGRATION)
  for (const ledger of LEDGERS) assert.deepEqual(await access(db.inspect, ledger), LOCKED, `${ledger} after a second run`)
  // the owner still writes
  await db.owner.query(`INSERT INTO "_migrations" (filename) VALUES ('x.sql')`)
  assert.equal((await db.owner.query('SELECT count(*) FROM "_migrations"')).rows[0].count, '1')
})

test('045 on a new database, where the other ledgers do not exist yet, locks the one there is and creates nothing', { skip, timeout: 120000 }, async () => {
  const db = await database()
  await db.owner.query('CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL)')
  await db.owner.query(MIGRATION)
  assert.deepEqual(await access(db.inspect, '_migrations'), LOCKED)
  const { rows } = await db.inspect.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)
  assert.deepEqual(rows.map(row => row.tablename), ['_migrations'])
  // and on a database with no ledger at all
  const empty = await database()
  await empty.owner.query(MIGRATION)
  assert.deepEqual((await empty.inspect.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows, [])
})

test('045 on a cluster without nextspark_app, authenticated and anon still enables RLS', { skip, timeout: 120000 }, async t => {
  const bare = await startCluster('ledgers-lockdown-bare')
  t.after(bare.stop)
  const owner = await connect(url('owner', 'postgres', bare.port))
  await owner.query('CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT)')
  await owner.query(MIGRATION)
  assert.equal((await owner.query(`SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('"_migrations"')`)).rows[0].relrowsecurity, true)
})

test('045 leaves a ledger its role does not own as it was, with a WARNING, and goes on to the others', { skip, timeout: 120000 }, async () => {
  const db = await database()
  await db.inspect.query('GRANT CREATE ON SCHEMA public TO stranger')
  const stranger = await connect(url('stranger', db.name))
  await stranger.query('CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT)')
  await db.owner.query('CREATE TABLE "_content_migrations" (id SERIAL PRIMARY KEY, filename TEXT)')
  const warnings: string[] = []
  db.owner.on('notice', notice => { if (notice.severity === 'WARNING') warnings.push(notice.message ?? '') })
  await db.owner.query(MIGRATION)
  assert.equal(warnings.length, 1, warnings.join('\n'))
  assert.match(warnings[0], /^Ledger lockdown: could not restrict _migrations/)
  assert.equal((await access(db.inspect, '_migrations')).rls, false)
  assert.deepEqual(await access(db.inspect, '_content_migrations'), LOCKED)
})

test('the lockdown warning for a ledger the role does not own is said once, scrubbed', { skip, timeout: 300000 }, async () => {
  const db = await database()
  const { root } = project()
  await db.inspect.query('GRANT CREATE ON SCHEMA public TO stranger')
  const stranger = await connect(url('stranger', db.name))
  await stranger.query('CREATE TABLE "_migrations" (id SERIAL PRIMARY KEY, filename TEXT UNIQUE NOT NULL, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
  await stranger.query('GRANT ALL ON "_migrations" TO migrator; GRANT ALL ON SEQUENCE "_migrations_id_seq" TO migrator')
  const result = run(RUNNER, root, { DATABASE_URL: url('migrator', db.name), MIGRATE_DATABASE_URL: url('migrator', db.name) }, ['--no-env-file'])
  assert.equal(result.status, 0, result.out)
  const said = result.out.split('\n').filter(line => line.includes('Ledger lockdown: could not restrict _migrations'))
  assert.equal(said.length, 1, result.out)
})

test('a role that only has grants on ledgers with row-level security is stopped with a message, by the run, the dry run and doctor', { skip, timeout: 300000 }, async () => {
  const db = await database()
  const { root } = project()
  const env = { DATABASE_URL: url('migrator', db.name), MIGRATE_DATABASE_URL: url('migrator', db.name) }
  assert.equal(run(RUNNER, root, env, ['--no-env-file']).status, 0)
  await db.inspect.query('CREATE ROLE granted_only LOGIN')
  await db.inspect.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO granted_only')
  const asGranted = { DATABASE_URL: url('granted_only', db.name), MIGRATE_DATABASE_URL: url('granted_only', db.name) }
  for (const args of [['--no-env-file'], ['--no-env-file', '--dry-run']]) {
    const stopped = run(RUNNER, root, asGranted, args)
    assert.equal(stopped.status, 1, stopped.out)
    assert.match(stopped.out, /belong to their owner.*would see none of their rows.*MIGRATE_DATABASE_URL/)
    assert.doesNotMatch(stopped.out, /Pending migrations/)
  }
  const doctor = run(CHECK, root, asGranted)
  assert.equal(doctor.status, 2, doctor.out)
  assert.match(doctor.out, /belong to their owner/)
  // the owner is not stopped
  assert.equal(run(RUNNER, root, env, ['--no-env-file', '--dry-run']).status, 0)
})
