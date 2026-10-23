/**
 * Migration 022 on a cluster where nextspark_app, authenticated and anon already exist (a shared
 * cluster, a managed host) and the migration role is neither a superuser nor CREATEROLE: the role
 * steps it has no privilege for are skipped with a WARNING that says what to run by hand, and the
 * rest (the grants) goes through. A superuser still gets no warning and the same role state.
 *
 * Starts a throwaway cluster with initdb and pg_ctl on a free port; skipped when they are not on the PATH.
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

const MIGRATION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations/022_rls_runtime_roles.sql')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** Runs 022 as `user` and returns the WARNING messages it raised. */
async function run022(port: number, user: string, database: string) {
  const client = new pg.Client({ connectionString: `postgresql://${user}@127.0.0.1:${port}/${database}?sslmode=disable` })
  const warnings: string[] = []
  client.on('notice', notice => { if (notice.severity === 'WARNING') warnings.push(notice.message ?? '') })
  await client.connect()
  try {
    await client.query(fs.readFileSync(MIGRATION, 'utf8'))
  } finally {
    await client.end()
  }
  return warnings
}

test('022 without CREATEROLE: warns for each skipped role step and still applies the grants; a superuser gets no warning', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH' }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-022-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const admin = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  await admin.connect()
  t.after(() => admin.end())
  for (const sql of [
    'CREATE ROLE authenticated', 'CREATE ROLE anon', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT',
    'CREATE ROLE limited LOGIN', 'CREATE DATABASE limiteddb OWNER limited', 'CREATE DATABASE superdb',
  ]) await admin.query(sql)

  const warnings = await run022(port, 'limited', 'limiteddb')
  assert.equal(warnings.length, 3, warnings.join('\n'))
  for (const [i, what] of [/ALTER ROLE nextspark_app INHERIT/, /GRANT authenticated TO nextspark_app/, /comment on role nextspark_app/].entries()) {
    assert.match(warnings[i], /^Role setup: could not/)
    assert.match(warnings[i], what)
  }
  // the part that needs no role privilege ran
  const { rows } = await admin.query("SELECT has_schema_privilege('nextspark_app', 'public', 'USAGE') AS usage")
  assert.equal(rows[0].usage, true)

  // a superuser: no warning, and the role ends up INHERIT, in `authenticated`, with the migration user a member
  assert.deepEqual(await run022(port, 'owner', 'superdb'), [])
  const state = await admin.query(`SELECT rolinherit, pg_has_role('nextspark_app', 'authenticated', 'MEMBER') AS member,
    pg_has_role('owner', 'nextspark_app', 'MEMBER') AS owner_member FROM pg_roles WHERE rolname = 'nextspark_app'`)
  assert.deepEqual(state.rows[0], { rolinherit: true, member: true, owner_member: true })
})
