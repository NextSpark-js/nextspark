/**
 * `scripts/test/jest.mjs --selectProjects db` (#430): the `db` project of a project's Jest config runs against a
 * throwaway PostgreSQL cluster that the runner starts, migrates and removes, with no DATABASE_URL, and never against
 * the DATABASE_URL of the environment. A database named by NEXTSPARK_TEST_DATABASE_URL is used as it is, when it is on
 * this machine or the opt-in says otherwise; a remote one without the opt-in stops the run before anything connects.
 *
 * Runs the runner and Jest on a fixture project, and starts throwaway clusters with initdb and pg_ctl on free ports;
 * skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/test/jest.mjs')
const JEST = fs.realpathSync(path.join(CORE, 'node_modules/jest/bin/jest.js'))
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'
const REMOTE = 'postgres://appuser:s3cretpass@shared-dev.invalid:5432/shared_dev'

/** The directories the runner's clusters live in, which no other suite creates. */
const clusters = () => fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('nextspark-test-db-'))

type Cleanup = { after: (fn: () => void) => void }

/** A project with a Jest config of a `unit` and a `db` project, and a test in each that reports where it runs. */
function project(t: Cleanup, extra: Record<string, string> = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'jest-db-project-')))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const write = (relative: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), content)
  }
  write('package.json', JSON.stringify({ name: 'project', private: true, dependencies: { next: '16.4.2' } }))
  write('nextspark.config.ts', 'export default { plugins: [] }\n')
  write('config/theme.config.ts', "export const themeConfig = { name: 'fixture' }\n")
  write('migrations/001_widgets.sql', 'CREATE TABLE widgets (id int PRIMARY KEY);')
  for (const [relative, content] of Object.entries(extra)) write(relative, content)
  // `pnpm exec jest` finds it here, and the suites find pg
  write('node_modules/.bin/jest', `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(JEST)} "$@"\n`)
  fs.chmodSync(path.join(root, 'node_modules/.bin/jest'), 0o755)
  fs.symlinkSync(fs.realpathSync(path.join(CORE, 'node_modules/pg')), path.join(root, 'node_modules/pg'), 'dir')
  write('tests/jest/jest.config.cjs', `module.exports = {
  rootDir: ${JSON.stringify(root)},
  projects: [
    { displayName: 'unit', rootDir: ${JSON.stringify(root)}, testEnvironment: 'node', testMatch: ['<rootDir>/tests/jest/unit/*.test.js'] },
    { displayName: 'db', rootDir: ${JSON.stringify(root)}, testEnvironment: 'node', testMatch: ['<rootDir>/tests/jest/db/*.test.js'] },
  ],
}\n`)
  write('tests/jest/unit/where.test.js', `it('reports', () => { console.log('UNIT DATABASE_URL=' + (process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : 'unset')) })\n`)
  write('tests/jest/db/where.test.js', `const { Client } = require('pg')
it('reports and writes', async () => {
  const url = new URL(process.env.DATABASE_URL)
  console.log('DB HOST=' + url.host + ' USER=' + url.username)
  if (process.env.DB_SUITE_SLEEP) { console.log('DB SLEEPING'); await new Promise(resolve => setTimeout(resolve, Number(process.env.DB_SUITE_SLEEP))) }
  if (process.env.DB_SUITE_NO_CONNECT) return
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const { rows } = await client.query("SELECT current_database() AS db, to_regclass('public.widgets') IS NOT NULL AS migrated, to_regclass('public.users') IS NOT NULL AS core, to_regclass('public.\\"_migrations\\"') IS NOT NULL AS ledger")
  console.log('DB ROWS=' + JSON.stringify(rows[0]))
  await client.query('CREATE TABLE IF NOT EXISTS written_by_suite (id int)')
  await client.end()
}, 60000)\n`)
  return root
}

function run(root: string, args: string[], env: Record<string, string> = {}, base: Record<string, string | undefined> = process.env) {
  const childEnv: Record<string, string | undefined> = { ...base, FORCE_COLOR: '0', CI: 'true', ...env }
  for (const key of Object.keys(env)) if (env[key] === '') delete childEnv[key]
  const result = spawnSync(process.execPath, [RUNNER, ...args, '--ci'], { cwd: root, env: childEnv as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 240000 })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

test('the db project runs against a throwaway cluster, migrated and removed, with no DATABASE_URL and not the one of the environment', { skip, timeout: 300000 }, t => {
  const root = project(t)
  const before = clusters()

  const withoutUrl = run(root, ['--selectProjects', 'db'], { DATABASE_URL: '', NEXTSPARK_TEST_DATABASE_URL: '' })
  assert.equal(withoutUrl.status, 0, withoutUrl.out)
  assert.match(withoutUrl.out, /The db project runs against a throwaway PostgreSQL cluster \(host 127\.0\.0\.1, port \d+\), removed when the run ends\./)
  assert.match(withoutUrl.out, /DB HOST=127\.0\.0\.1:\d+ USER=owner/)
  // the project's migrations ran on it, core's included, and the suite wrote to it
  assert.match(withoutUrl.out, /DB ROWS=\{"db":"postgres","migrated":true,"core":true,"ledger":true\}/)
  assert.deepEqual(clusters(), before, 'the cluster is gone')

  // the environment's DATABASE_URL (a shared database) is not used, and the run says so
  const withShared = run(root, ['--selectProjects', 'db'], { DATABASE_URL: REMOTE, NEXTSPARK_TEST_DATABASE_URL: '' })
  assert.equal(withShared.status, 0, withShared.out)
  assert.match(withShared.out, /The DATABASE_URL of the environment is not used by the db project; NEXTSPARK_TEST_DATABASE_URL names the database it uses instead\./)
  assert.match(withShared.out, /DB HOST=127\.0\.0\.1:\d+ USER=owner/)
  assert.ok(!withShared.out.includes('shared-dev.invalid') && !withShared.out.includes('s3cretpass'), withShared.out)
  assert.deepEqual(clusters(), before)
})

test('the other projects run as before: no cluster, and the DATABASE_URL of the environment untouched', { skip, timeout: 300000 }, t => {
  const root = project(t)
  const before = clusters()
  const unit = run(root, ['--selectProjects', 'unit'], { DATABASE_URL: REMOTE })
  assert.equal(unit.status, 0, unit.out)
  assert.match(unit.out, /UNIT DATABASE_URL=shared-dev\.invalid:5432/)
  assert.doesNotMatch(unit.out, /throwaway|Applying the project migrations/)
  assert.deepEqual(clusters(), before)
})

test('a database named by NEXTSPARK_TEST_DATABASE_URL on this machine is used as it is, and the runner writes nothing to it', { skip, timeout: 300000 }, async t => {
  const own = await startCluster('jest-db-own')
  t.after(own.stop)
  const root = project(t)
  const url = `postgresql://owner@127.0.0.1:${own.port}/postgres?sslmode=disable`
  const result = run(root, ['--selectProjects', 'db'], { NEXTSPARK_TEST_DATABASE_URL: url, DATABASE_URL: REMOTE })
  assert.equal(result.status, 0, result.out)
  assert.match(result.out, new RegExp(`The db project runs against host 127\\.0\\.0\\.1, database postgres \\(NEXTSPARK_TEST_DATABASE_URL\\)\\.`))
  assert.match(result.out, new RegExp(`DB HOST=127\\.0\\.0\\.1:${own.port}`))
  // no migration ran there: only what the suite itself did
  assert.match(result.out, /DB ROWS=\{"db":"postgres","migrated":false,"core":false,"ledger":false\}/)
  assert.doesNotMatch(result.out, /throwaway/)
  const client = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${own.port}/postgres?sslmode=disable` })
  await client.connect()
  try {
    assert.equal((await client.query(`SELECT to_regclass('public.written_by_suite') IS NOT NULL AS written`)).rows[0].written, true)
  } finally {
    await client.end()
  }
})

test('a database that is not on this machine stops the run before Jest starts or anything connects, and says how to allow it', { skip, timeout: 300000 }, t => {
  const root = project(t)
  const before = clusters()
  const refused = run(root, ['--selectProjects', 'db'], { NEXTSPARK_TEST_DATABASE_URL: REMOTE })
  assert.equal(refused.status, 1, refused.out)
  assert.match(refused.out, /NEXTSPARK_TEST_DATABASE_URL points at host shared-dev\.invalid, database shared_dev, which is not this machine/)
  assert.match(refused.out, /set NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE=1/)
  assert.doesNotMatch(refused.out, /DB HOST=|Tests:|s3cretpass|appuser/)
  assert.deepEqual(clusters(), before, 'no cluster was started')

  // with the opt-in the suite gets that database, and the run says the opt-in is set (the suite here does not connect)
  const allowed = run(root, ['--selectProjects', 'db'], { NEXTSPARK_TEST_DATABASE_URL: REMOTE, NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE: '1', DB_SUITE_NO_CONNECT: '1' })
  assert.equal(allowed.status, 0, allowed.out)
  assert.match(allowed.out, /The db project runs against host shared-dev\.invalid, database shared_dev \(NEXTSPARK_TEST_DATABASE_URL, NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE is set\)\./)
  assert.match(allowed.out, /DB HOST=shared-dev\.invalid:5432 USER=appuser/)
  assert.ok(!allowed.out.includes('s3cretpass'), 'the runner prints host and database, never the password')
})

test('without initdb and pg_ctl on the PATH the db project says so, and names the variable that avoids them', { skip, timeout: 120000 }, t => {
  const root = project(t)
  const bare = run(root, ['--selectProjects', 'db'], { PATH: path.dirname(process.execPath) })
  assert.equal(bare.status, 1, bare.out)
  assert.match(bare.out, /initdb and pg_ctl are not on the PATH/)
  assert.match(bare.out, /NEXTSPARK_TEST_DATABASE_URL/)
})

test('the cluster is removed when the runner is told to stop', { skip, timeout: 300000 }, async t => {
  const root = project(t)
  const before = clusters()
  const child = spawn(process.execPath, [RUNNER, '--selectProjects', 'db', '--ci'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', CI: 'true', DB_SUITE_SLEEP: '10000', DATABASE_URL: '', NEXTSPARK_TEST_DATABASE_URL: '' } as NodeJS.ProcessEnv,
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const closed = new Promise<void>(resolve => child.on('close', () => resolve()))
  try {
    for (let waited = 0; !output.includes('DB SLEEPING'); waited += 200) {
      assert.ok(waited < 120000, `the suite never started:\n${output}`)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    const port = Number(/port (\d+)\)/.exec(output)?.[1])
    assert.ok(port > 0, output)
    assert.equal(clusters().length, before.length + 1, 'the cluster is running')
    child.kill('SIGTERM')
    await closed
    assert.deepEqual(clusters(), before, 'the cluster directory is gone')
    // and so is the server: nothing listens on its port
    await assert.rejects(new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => { socket.destroy(); resolve(undefined) })
      socket.on('error', reject)
    }))
  } finally {
    // jest and its workers may outlive the runner for a moment: the group goes
    try { process.kill(-child.pid!, 'SIGKILL') } catch { /* already gone */ }
  }
})

test('an interrupt while the migrations run leaves no cluster behind', { skip, timeout: 300000 }, async t => {
  const root = project(t, { 'migrations/002_slow.sql': 'SELECT pg_sleep(120);' })
  const before = clusters()
  const child = spawn(process.execPath, [RUNNER, '--selectProjects', 'db', '--ci'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', CI: 'true', DATABASE_URL: '', NEXTSPARK_TEST_DATABASE_URL: '' } as NodeJS.ProcessEnv,
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const closed = new Promise<void>(resolve => child.on('close', () => resolve()))
  try {
    for (let waited = 0; !output.includes('Applying the project migrations'); waited += 200) {
      assert.ok(waited < 120000, output)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    // let the slow migration start, then Ctrl-C: the signal reaches the whole group, as from a terminal
    await new Promise(resolve => setTimeout(resolve, 2500))
    process.kill(-child.pid!, 'SIGINT')
    await closed
    assert.deepEqual(clusters(), before, 'the cluster directory is gone')
  } finally {
    try { process.kill(-child.pid!, 'SIGKILL') } catch { /* already gone */ }
  }
})
