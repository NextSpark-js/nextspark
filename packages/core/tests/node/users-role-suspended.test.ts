/**
 * Migration 031 lets users.role be 'suspended' (the superadmin suspend action) by adding it to check_users_role,
 * keeping every role the constraint already accepts (a project may have added its own). It is idempotent, and leaves a
 * constraint that is not a plain list of roles alone.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
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
const MIGRATION = fs.readFileSync(path.join(CORE, 'migrations/031_users_role_suspended.sql'), 'utf8')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

async function throwawayDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-role-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const client = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())
  return client
}

async function constraintOf(client: pg.Client) {
  const { rows } = await client.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'check_users_role'`)
  return rows[0]?.def as string | undefined
}

async function withConstraint(client: pg.Client, check: string) {
  await client.query('DROP TABLE IF EXISTS users')
  await client.query(`CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT, CONSTRAINT check_users_role CHECK (${check}))`)
}

test('adds suspended to core\'s roles, once, and still refuses a role outside the list', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH' }, async t => {
  const client = await throwawayDatabase(t)
  await withConstraint(client, `role IN ('member', 'superadmin', 'developer')`)
  await client.query(MIGRATION)
  const once = await constraintOf(client)
  await client.query(MIGRATION)
  assert.equal(await constraintOf(client), once)
  for (const role of ['member', 'superadmin', 'developer', 'suspended']) assert.match(once!, new RegExp(`'${role}'`))
  await client.query(`INSERT INTO users VALUES ('u1', 'suspended')`)
  await assert.rejects(client.query(`INSERT INTO users VALUES ('u2', 'admin')`), /check_users_role/)
})

test('keeps a role a project added to the list', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH' }, async t => {
  const client = await throwawayDatabase(t)
  await withConstraint(client, `role IN ('member', 'superadmin', 'developer', 'editor')`)
  await client.query(MIGRATION)
  await client.query(`INSERT INTO users VALUES ('u1', 'editor'), ('u2', 'suspended')`)
})

test('leaves a constraint that is not a list of roles alone', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH' }, async t => {
  const client = await throwawayDatabase(t)
  await withConstraint(client, 'length(role) < 20')
  const before = await constraintOf(client)
  await client.query(MIGRATION)
  assert.equal(await constraintOf(client), before)
})
