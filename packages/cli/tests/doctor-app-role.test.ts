import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkAppRole } from '../src/doctor/checks/app-role.js'

/** A project whose .env has DATABASE_URL, and a core whose check script prints `lines` and exits with `code` (null: core has no script). */
async function doctor(code: number | null, lines: string[] = [], env = 'DATABASE_URL=postgresql://u@127.0.0.1:5432/db\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-role-'))
  const core = path.join(dir, 'core')
  if (code !== null) {
    fs.mkdirSync(path.join(core, 'scripts/db'), { recursive: true })
    fs.writeFileSync(path.join(core, 'scripts/db/check-app-role.mjs'),
      `console.log(${JSON.stringify(lines.join('\n'))}); process.exit(${code})\n`)
  }
  fs.writeFileSync(path.join(dir, '.env'), env)
  const previous = process.cwd()
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  process.chdir(dir)
  try {
    return await checkAppRole(core)
  } finally {
    process.chdir(previous)
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor warns NS_APP_ROLE_NOT_AUTHENTICATED with the GRANT for a superuser, and passes once it is granted (#393)', async () => {
  const grant = 'GRANT authenticated TO nextspark_app WITH INHERIT TRUE;'
  const missing = await doctor(1, ['nextspark_app is not a member of authenticated', grant])
  assert.equal(missing.status, 'warn')
  assert.equal(missing.code, 'NS_APP_ROLE_NOT_AUTHENTICATED')
  assert.equal(missing.message, 'NS_APP_ROLE_NOT_AUTHENTICATED: nextspark_app is not a member of authenticated')
  assert.equal(missing.fix, `As a superuser, run: ${grant}`)
  assert.deepEqual(await doctor(0, ['nextspark_app inherits the policies of authenticated']),
    { name: 'App role', status: 'pass', message: 'nextspark_app inherits the policies of authenticated' })
})

test('doctor says nothing false when there is no database, no role to check, or the database cannot be read (#393)', async () => {
  assert.equal((await doctor(0, ['x'], '# nothing\n')).status, 'pass')
  assert.equal((await doctor(0, ['No nextspark_app role: nothing to check'])).status, 'pass')
  const unreadable = await doctor(2, ['Could not read the roles: connection refused'])
  assert.equal(unreadable.status, 'pass')
  assert.equal(unreadable.message, 'Not checked: Could not read the roles: connection refused')
  const old = await doctor(null)
  assert.equal(old.status, 'pass')
  assert.match(old.message, /^Not checked/)
})

test('doctor does not warn on an exit 1 that carries no statement (a crash is not a verdict) (#393)', async () => {
  const crashed = await doctor(1, ['Something broke'])
  assert.equal(crashed.status, 'pass')
  assert.equal(crashed.fix, undefined)
  assert.match(crashed.message, /^Not checked/)
})

// The check against core's real script and a real cluster (skipped without initdb/pg_ctl on the PATH).
const HAS_POSTGRES = ['initdb', 'pg_ctl', 'psql'].every(bin => spawnSync(bin, ['--version']).status === 0)
const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core')

test('doctor, with the real core script on a real cluster, warns with a statement that fixes it, then passes (#393)', { skip: !HAS_POSTGRES && 'initdb/pg_ctl/psql not on PATH', timeout: 120000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-pg-'))
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  const data = path.join(dir, 'data')
  t.after(() => {
    try { execFileSync('pg_ctl', ['-D', data, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' }) } catch { /* never started */ }
    fs.rmSync(dir, { recursive: true, force: true })
  })
  execFileSync('initdb', ['-D', data, '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', data, '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
  // the CLI has no pg driver: psql runs the statements
  const sql = (statement: string) => execFileSync('psql', ['-h', '127.0.0.1', '-p', String(port), '-U', 'owner', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', statement], { stdio: 'ignore' })

  const run = async () => {
    const previous = process.cwd()
    const previousUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    process.chdir(dir)
    try { return await checkAppRole(CORE) } finally {
      process.chdir(previous)
      if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl
    }
  }

  assert.equal((await run()).status, 'pass', 'no nextspark_app yet: nothing to report')
  sql('CREATE ROLE authenticated; CREATE ROLE nextspark_app NOLOGIN NOINHERIT')
  const missing = await run()
  assert.equal(missing.status, 'warn')
  assert.equal(missing.code, 'NS_APP_ROLE_NOT_AUTHENTICATED')
  const statement = (missing.fix ?? '').replace('As a superuser, run: ', '')
  assert.match(statement, /^GRANT authenticated TO nextspark_app/)
  sql(statement)
  assert.equal((await run()).status, 'pass')
})
