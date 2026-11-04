/**
 * #393: nextspark_app has to inherit `authenticated`, because every policy is written TO authenticated. When the
 * migration role cannot run the GRANT (no CREATEROLE, nextspark_app already there), 022 warns and goes on:
 * - scripts/db/check-app-role.mjs (what `nextspark doctor` runs) exits 1 with the exact statement while the
 *   membership is missing, exits 0 once it is granted, and exits 0 with nothing to say on a database with no
 *   nextspark_app (no cutover);
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

/** A project whose only core migration is 022, run by the real runner as `url`. */
function migrate(t: TestContext, url: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-role-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
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

  // the migration role has no CREATEROLE: 022 warns in the middle of the output, and the summary repeats it at the end
  const output = migrate(t, url('limited', 'firstdb'))
  const done = output.indexOf('All migrations completed successfully')
  const summary = output.slice(done)
  assert.ok(done > 0 && output.indexOf('Role setup: could not run the GRANT of authenticated') < done, 'the warning is in the middle of the output')
  assert.match(summary, /Needs a superuser, by hand[\s\S]*Role setup: could not run the GRANT of authenticated to nextspark_app/)
  assert.doesNotMatch(summary, /comment on role/, 'the comment on the role is only a description')

  const missing = check(url('limited', 'firstdb'))
  assert.equal(missing.status, 1, missing.lines.join('\n'))
  assert.match(missing.lines[0], /nextspark_app is not a member of authenticated/)
  assert.match(missing.lines[0], /USER_NOT_FOUND/)
  const version = Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)
  assert.equal(missing.lines[1], version >= 160000 ? 'GRANT authenticated TO nextspark_app WITH INHERIT TRUE;' : 'GRANT authenticated TO nextspark_app;')

  // the statement it prints is the fix
  await admin.query(missing.lines[1])
  if (version < 160000) await admin.query('ALTER ROLE nextspark_app INHERIT')
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

test('a database with no nextspark_app has nothing to check: it passes and prints no statement', OPTS, async t => {
  const { url } = await startCluster(t)
  const result = check(url('owner', 'postgres'))
  assert.equal(result.status, 0, result.lines.join('\n'))
  assert.match(result.lines[0], /No nextspark_app role/)
  assert.equal(result.lines.length, 1)
})
