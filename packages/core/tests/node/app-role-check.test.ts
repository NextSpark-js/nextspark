/**
 * #393: nextspark_app has to inherit `authenticated`, because every policy is written TO authenticated. When the
 * migration role cannot run the GRANT (no CREATEROLE, nextspark_app already there), 022 warns and goes on:
 * - scripts/db/check-app-role.mjs (what `nextspark doctor` runs) exits 1 with the exact statement while the
 *   membership is missing, exits 0 once it is granted, and exits 0 with nothing to say on a database with no
 *   nextspark_app (migrations not run);
 * - db:migrate repeats the warning as a summary after "All migrations completed", and prints no summary on a
 *   cluster where the grant was in place.
 *
 * Starts a throwaway cluster with initdb and pg_ctl on a free port; skipped when they are not on the PATH.
 */
import { test, type TestContext } from 'node:test'
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
const CHECK = path.join(CORE, 'scripts/db/check-app-role.mjs')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const OPTS = { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 120000 }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

async function startCluster(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-role-pg-'))
  const port = await freePort()
  const data = path.join(dir, 'data')
  t.after(() => {
    try { execFileSync('pg_ctl', ['-D', data, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' }) } catch { /* never started */ }
    fs.rmSync(dir, { recursive: true, force: true })
  })
  execFileSync('initdb', ['-D', data, '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', data, '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  const admin = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  admin.on('error', () => {})
  await admin.connect()
  t.after(() => admin.end())
  return { admin, url: (user: string, database: string) => `postgresql://${user}@127.0.0.1:${port}/${database}?sslmode=disable` }
}

function check(url: string) {
  const env = { ...process.env, DATABASE_URL: url }
  const run = spawnSync(process.execPath, [CHECK], { env, encoding: 'utf8', timeout: 30000 })
  return { status: run.status, lines: run.stdout.trim().split('\n') }
}

/** A project whose only core migration is 022, plus an entity migration so PHASE 2 prints too, run by the real runner as `url`. */
function migrate(t: TestContext, url: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-role-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.mkdirSync(path.join(root, 'entities/widgets/migrations'), { recursive: true })
  fs.writeFileSync(path.join(root, 'entities/widgets/migrations/100_widgets.sql'), 'CREATE TABLE IF NOT EXISTS widgets (id int PRIMARY KEY);')
  fs.copyFileSync(path.join(CORE, 'migrations/022_rls_runtime_roles.sql'), path.join(root, 'packages/core/migrations/022_rls_runtime_roles.sql'))
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const env = { ...process.env, DATABASE_URL: url }
  delete env.MIGRATE_DATABASE_URL
  delete env.MIGRATION_TIMEOUT_SECONDS
  const run = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`)
  return run.stdout
}

test('the check and the db:migrate summary report a nextspark_app that is not a member of authenticated, and pass once it is', OPTS, async t => {
  const { admin, url } = await startCluster(t)
  for (const sql of [
    'CREATE ROLE authenticated', 'CREATE ROLE anon', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT', 'CREATE ROLE limited LOGIN',
    'CREATE DATABASE firstdb OWNER limited', 'CREATE DATABASE seconddb OWNER limited',
  ]) await admin.query(sql)

  // a table whose only policy is TO authenticated: nextspark_app sees its row only when the policy applies to it
  await admin.query('CREATE TABLE rls_probe (id int); INSERT INTO rls_probe VALUES (1); GRANT SELECT ON rls_probe TO nextspark_app; ALTER TABLE rls_probe ENABLE ROW LEVEL SECURITY; CREATE POLICY p ON rls_probe FOR SELECT TO authenticated USING (true)')
  const visible = async () => {
    await admin.query('BEGIN; SET LOCAL ROLE nextspark_app')
    try { return (await admin.query('SELECT count(*)::int AS n FROM rls_probe')).rows[0].n } finally { await admin.query('ROLLBACK') }
  }
  assert.equal(await visible(), 0)

  // the migration role has no CREATEROLE: 022 warns in the middle of the output, and the summary repeats it as the last thing printed
  const output = migrate(t, url('limited', 'firstdb'))
  const done = output.lastIndexOf('All migrations completed successfully')
  assert.ok(output.includes('PHASE 2'), 'the entity phase ran')
  assert.ok(output.indexOf('Role setup: could not run the GRANT of authenticated') < output.indexOf('PHASE 2'), 'the warning is in the middle of the output')
  const summary = output.slice(done)
  assert.match(summary, /Needs a superuser, by hand[\s\S]*Role setup: could not run the GRANT of authenticated to nextspark_app/)
  assert.doesNotMatch(summary, /comment on role/, 'the comment on the role is only a description')
  assert.ok(output.trimEnd().split('\n').slice(-4).join('\n').includes('Role setup:'), 'nothing but the summary follows the completion line')

  const missing = check(url('limited', 'firstdb'))
  assert.equal(missing.status, 1, missing.lines.join('\n'))
  assert.match(missing.lines[0], /nextspark_app is not a member of authenticated/)
  assert.match(missing.lines[0], /USER_NOT_FOUND/)
  const version = Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)
  // 022 creates the role NOINHERIT: before PostgreSQL 16 the GRANT alone would leave the policy not applying
  assert.equal(missing.lines[1], version >= 160000 ? 'GRANT authenticated TO nextspark_app WITH INHERIT TRUE;' : 'GRANT authenticated TO nextspark_app; ALTER ROLE nextspark_app INHERIT;')

  // the statement it prints is the whole fix: the policy applies afterwards, and the check passes
  await admin.query(missing.lines[1])
  assert.equal(await visible(), 1)
  const granted = check(url('limited', 'firstdb'))
  assert.equal(granted.status, 0, granted.lines.join('\n'))
  assert.match(granted.lines[0], /inherits the policies of authenticated/)
  assert.doesNotMatch(migrate(t, url('limited', 'seconddb')), /Needs a superuser/)
})

test('on PostgreSQL 15 and before, a member that does not inherit is told to ALTER ROLE ... INHERIT', OPTS, async t => {
  const { admin, url } = await startCluster(t)
  const version = Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)
  if (version >= 160000) return t.skip('PostgreSQL 16 and later keep INHERIT on the membership')
  for (const sql of ['CREATE ROLE authenticated', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT', 'GRANT authenticated TO nextspark_app']) await admin.query(sql)
  const result = check(url('owner', 'postgres'))
  assert.equal(result.status, 1)
  assert.equal(result.lines[1], 'ALTER ROLE nextspark_app INHERIT;')
})

test('a DATABASE_URL that cannot be read exits 3, never 1 (not a member)', OPTS, async t => {
  const { url } = await startCluster(t)
  for (const bad of ['postgresql://[bad', 'postgresql://owner@127.0.0.1:1/postgres?sslmode=disable']) {
    const result = check(bad)
    assert.equal(result.status, 3, `${bad}: ${result.lines.join('\n')}`)
    assert.match(result.lines[0], /^Could not read the roles/)
  }
  assert.equal(check(url('owner', 'postgres')).status, 0)
  // the same for the row-level security check, which used to exit 1 (a verdict) on a URL the driver cannot parse
  const rls = spawnSync(process.execPath, [path.join(CORE, 'scripts/db/check-rls-runtime.mjs')], { env: { ...process.env, DATABASE_URL: 'postgresql://[bad' }, encoding: 'utf8', timeout: 30000 })
  assert.equal(rls.status, 2, rls.stdout)
})

test('a database with no nextspark_app has nothing to check: it passes and prints no statement', OPTS, async t => {
  const { url } = await startCluster(t)
  const result = check(url('owner', 'postgres'))
  assert.equal(result.status, 0, result.lines.join('\n'))
  assert.match(result.lines[0], /No nextspark_app role: migration 022 creates it/)
  assert.equal(result.lines.length, 1)
})
