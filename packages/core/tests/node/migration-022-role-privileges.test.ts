/**
 * Migration 022 on a cluster where nextspark_app, authenticated and anon already exist (a shared
 * cluster, a managed host) and the migration role cannot manage them (no superuser, and no CREATEROLE or,
 * on PostgreSQL 16 and later, no ADMIN OPTION on them): the role steps it has no privilege for are skipped
 * with a WARNING that says what to run by hand, and the rest (the grants) goes through. A superuser still
 * gets no warning and the same role state, and so does a limited role on a cluster a superuser already
 * migrated. Any error other than insufficient_privilege still stops the migration.
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

/** Starts a throwaway cluster (cleanup registered before it starts) and returns an admin client and the port. */
async function startCluster(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-022-pg-'))
  const port = await freePort()
  const data = path.join(dir, 'data')
  t.after(() => {
    try { execFileSync('pg_ctl', ['-D', data, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' }) } catch { /* never started */ }
    fs.rmSync(dir, { recursive: true, force: true })
  })
  execFileSync('initdb', ['-D', data, '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', data, '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  const admin = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  await admin.connect()
  t.after(() => admin.end())
  return { admin, port }
}

const OPTS = { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 120000 }

test('022 without CREATEROLE: warns for each skipped role step and still applies the grants; a superuser gets no warning', OPTS, async t => {
  const { admin, port } = await startCluster(t)
  for (const sql of [
    'CREATE ROLE authenticated', 'CREATE ROLE anon', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT',
    'CREATE ROLE limited LOGIN', 'CREATE DATABASE limiteddb OWNER limited', 'CREATE DATABASE superdb',
  ]) await admin.query(sql)

  const warnings = await run022(port, 'limited', 'limiteddb')
  assert.equal(warnings.length, 3, warnings.join('\n'))
  for (const [i, what] of [/GRANT of authenticated to nextspark_app/, /ALTER ROLE nextspark_app INHERIT/, /comment on role nextspark_app/].entries()) {
    assert.match(warnings[i], /^Role setup: could not/)
    assert.match(warnings[i], what)
  }
  assert.match(warnings[0], /WITH INHERIT TRUE/)
  // the part that needs no role privilege ran
  const { rows } = await admin.query("SELECT has_schema_privilege('nextspark_app', 'public', 'USAGE') AS usage")
  assert.equal(rows[0].usage, true)

  // a superuser: no warning, and the role ends up INHERIT, in `authenticated` (and inheriting), with the migration user a member
  assert.deepEqual(await run022(port, 'owner', 'superdb'), [])
  const state = await admin.query(`SELECT rolinherit, pg_has_role('nextspark_app', 'authenticated', 'USAGE') AS usage,
    pg_has_role('owner', 'nextspark_app', 'MEMBER') AS owner_member FROM pg_roles WHERE rolname = 'nextspark_app'`)
  assert.deepEqual(state.rows[0], { rolinherit: true, usage: true, owner_member: true })

  // another database of the same cluster, already migrated by the superuser: nothing left to do, nothing to warn about
  assert.deepEqual(await run022(port, 'limited', 'limiteddb'), [])
})

test('022 as CREATEROLE without superuser, with a NOINHERIT nextspark_app created by another role: authenticated ends up usable by it', OPTS, async t => {
  const { admin, port } = await startCluster(t)
  for (const sql of ['CREATE ROLE creator LOGIN CREATEROLE', 'CREATE ROLE nextspark_app NOLOGIN NOINHERIT', 'CREATE DATABASE creatordb OWNER creator'])
    await admin.query(sql)
  // `authenticated` is created by the migration role, as migration 001 does, so it has ADMIN on it
  const creator = new pg.Client({ connectionString: `postgresql://creator@127.0.0.1:${port}/postgres?sslmode=disable` })
  await creator.connect()
  await creator.query('CREATE ROLE authenticated')
  await creator.end()
  // a membership left without INHERIT on PostgreSQL 16+ (a superuser's plain GRANT): a MEMBER check would skip it
  await admin.query('GRANT authenticated TO nextspark_app')

  const warnings = await run022(port, 'creator', 'creatordb')
  // PostgreSQL 16+: COMMENT ON ROLE needs ADMIN OPTION on the role, which `creator` does not have on nextspark_app
  const version = Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num)
  if (version >= 160000) {
    assert.equal(warnings.length, 1, warnings.join('\n'))
    assert.match(warnings[0], /could not set the comment on role nextspark_app/)
  } else {
    assert.deepEqual(warnings, [])
  }
  // pg_has_role USAGE is "member and inherits": on PostgreSQL 16 and later the membership has to be granted WITH INHERIT TRUE
  const { rows } = await admin.query("SELECT pg_has_role('nextspark_app', 'authenticated', 'USAGE') AS usage")
  assert.equal(rows[0].usage, true)
})

test('022 stops on an error that is not insufficient_privilege', OPTS, async t => {
  const { admin, port } = await startCluster(t)
  // no `authenticated` role: pg_has_role fails with undefined_object, which must not be swallowed
  for (const sql of ['CREATE ROLE nextspark_app NOLOGIN', 'CREATE DATABASE somedb']) await admin.query(sql)
  await assert.rejects(run022(port, 'owner', 'somedb'), /authenticated/)
})
