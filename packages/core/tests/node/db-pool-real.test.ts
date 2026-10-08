/**
 * #221 against a real PostgreSQL: a query past DB_STATEMENT_TIMEOUT_MS / DB_QUERY_TIMEOUT_MS fails fast instead of
 * hanging, and a backend killed under an idle pooled connection neither crashes the process (no uncaughtException)
 * nor breaks the next query.
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
import pg from 'pg'
import { createPool } from '../../src/lib/db-pool'

const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

async function throwawayUrl(t: { after: (fn: () => void) => void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-pool-pg-'))
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return `postgresql://owner@127.0.0.1:${port}/postgres`
}

test('a query past the statement timeout fails fast instead of hanging', { skip: !HAS_POSTGRES }, async (t) => {
  const connectionString = await throwawayUrl(t)
  process.env.DB_STATEMENT_TIMEOUT_MS = '300'
  const pool = createPool('test', { connectionString })
  t.after(() => pool.end())
  const started = Date.now()
  await assert.rejects(pool.query('SELECT pg_sleep(30)'), /statement timeout/)
  assert.ok(Date.now() - started < 5000, 'failed within seconds, not after the 30 s sleep')
  assert.equal((await pool.query('SELECT 1 AS ok')).rows[0].ok, 1, 'the pool still works')
  delete process.env.DB_STATEMENT_TIMEOUT_MS
})

test('the client-side query timeout fails a query the server does not cancel', { skip: !HAS_POSTGRES }, async (t) => {
  const connectionString = await throwawayUrl(t)
  process.env.DB_QUERY_TIMEOUT_MS = '300'
  const pool = createPool('test', { connectionString })
  t.after(() => pool.end())
  const started = Date.now()
  await assert.rejects(pool.query('SELECT pg_sleep(3)'), /timeout/i)
  assert.ok(Date.now() - started < 2000)
  delete process.env.DB_QUERY_TIMEOUT_MS
})

test('killing the backend of an idle pooled connection is not an uncaughtException and the next query works', { skip: !HAS_POSTGRES }, async (t) => {
  const connectionString = await throwawayUrl(t)
  const uncaught: Error[] = []
  const onUncaught = (err: Error) => uncaught.push(err)
  process.on('uncaughtException', onUncaught)
  const warn = t.mock.method(console, 'warn', () => {})
  const pool = createPool('test', { connectionString })
  t.after(() => { process.off('uncaughtException', onUncaught); return pool.end() })

  const { rows: [{ pid }] } = await pool.query('SELECT pg_backend_pid() AS pid') // the connection is now idle in the pool
  const admin = new pg.Client({ connectionString })
  await admin.connect()
  await admin.query('SELECT pg_terminate_backend($1)', [pid])
  await admin.end()
  for (let waited = 0; warn.mock.callCount() === 0 && waited < 5000; waited += 50) await new Promise(resolve => setTimeout(resolve, 50))

  assert.deepEqual(uncaught, [])
  assert.equal(warn.mock.callCount(), 1, 'the idle client error was logged once')
  assert.match(String(warn.mock.calls[0].arguments[0]), /test pool: client error \(57P01\)/)
  const { rows: [{ pid: next }] } = await pool.query('SELECT pg_backend_pid() AS pid')
  assert.notEqual(next, pid, 'the next query got a fresh connection')
})

/** A TCP relay to Postgres that can be switched to swallow everything in both directions, like a NAT that dropped the flow. */
async function blackholeProxy(target: URL, t: { after: (fn: () => void) => void }) {
  const state = { blackhole: false }
  const sockets = new Set<net.Socket>()
  const server = net.createServer(client => {
    const upstream = net.connect(Number(target.port), target.hostname)
    for (const [from, to] of [[client, upstream], [upstream, client]] as const) {
      sockets.add(from)
      from.on('data', chunk => { if (!state.blackhole) to.write(chunk) })
      from.on('error', () => {})
      from.on('close', () => to.destroy())
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close() })
  return { state, port: (server.address() as net.AddressInfo).port }
}

test('queryWithRLS/mutateWithRLS time out once, commit nothing and never reuse the client, on a slow query and a blackholed socket', { skip: !HAS_POSTGRES }, async (t) => {
  const direct = new URL(await throwawayUrl(t))
  const proxy = await blackholeProxy(direct, t)
  const admin = new pg.Client({ connectionString: direct.href })
  await admin.connect()
  t.after(() => admin.end())
  await admin.query('CREATE TABLE t (n int)')

  process.env.DATABASE_URL = `postgresql://owner@127.0.0.1:${proxy.port}/postgres?sslmode=disable`
  delete process.env.DATABASE_SERVICE_URL
  process.env.DB_QUERY_TIMEOUT_MS = '1000'
  const db = await import('../../src/lib/db')
  t.after(() => db.pool.end())
  const pidNow = async () => (await db.queryWithRLS<{ pid: number }>('SELECT pg_backend_pid() AS pid'))[0].pid
  const timed = async (run: () => Promise<unknown>) => {
    const started = Date.now()
    const error = await run().then(() => null, (e: Error) => e)
    return { error, ms: Date.now() - started }
  }

  // a slow statement: the INSERT must not commit, the client must not come back, and the caller sees the one timeout
  const first = await pidNow()
  const slow = await timed(() => db.mutateWithRLS('INSERT INTO t SELECT 1 FROM pg_sleep(3)'))
  assert.match(slow.error?.message ?? '', /Query read timeout/)
  assert.ok(slow.ms < 1800, `one timeout (${slow.ms} ms), not the timeout twice`)
  assert.equal(db.pool.totalCount, 0, 'the timed-out client was dropped')
  await new Promise(resolve => setTimeout(resolve, 3500))
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM t')).rows[0].n, 0, 'nothing committed')
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE state = 'idle in transaction'")).rows[0].n, 0)
  const second = await pidNow()
  assert.notEqual(second, first, 'the next call got a fresh connection')
  assert.equal((await db.queryWithRLS<{ n: number }>('SELECT count(*)::int AS n FROM t'))[0].n, 0)

  // a socket that stops answering: every call fails after one timeout and the dead client does not stay in the pool
  proxy.state.blackhole = true
  for (let attempt = 0; attempt < 2; attempt++) {
    const dead = await timed(() => db.queryWithRLS('SELECT 1'))
    assert.match(dead.error?.message ?? '', /Query read timeout/)
    assert.ok(dead.ms < 1800, `attempt ${attempt}: one timeout (${dead.ms} ms)`)
    assert.equal(db.pool.totalCount, 0, `attempt ${attempt}: no dead client kept`)
    if (attempt === 0) proxy.state.blackhole = false // the next call connects again
    if (attempt === 0) assert.ok(await pidNow() > 0, 'recovers once the path is back')
    if (attempt === 0) proxy.state.blackhole = true
  }
})

test('a client released in the same tick as its timeout is discarded, and the next pool.query works', { skip: !HAS_POSTGRES }, async (t) => {
  const connectionString = await throwawayUrl(t)
  process.env.DB_QUERY_TIMEOUT_MS = '500'
  const pool = createPool('test', { connectionString, max: 1 })
  t.after(() => { delete process.env.DB_QUERY_TIMEOUT_MS; return pool.end() })

  for (const form of ['promise', 'callback']) {
    const client = await pool.connect()
    const failure = await new Promise<Error>(resolve => {
      if (form === 'promise') client.query('SELECT pg_sleep(3)').catch(resolve)
      else client.query('SELECT pg_sleep(3)', err => resolve(err as Error))
    })
    assert.match(failure.message, /Query read timeout/, form)
    client.release() // no await in between, like kysely, user-data and token-refresh
    assert.equal(pool.totalCount, 0, `${form}: the client is gone as soon as it is released`)
    assert.equal((await pool.query('SELECT 1 AS ok')).rows[0].ok, 1, `${form}: the next query works`)
  }
})
