/**
 * A connection's time limits hold whatever its connection string says (#193),
 * and the client is the one pg would build for the string without them. pg reads
 * the string's parameters over the options passed next to it, so the client is
 * built the way pg builds it and the two limits are set on the parameters pg
 * resolved.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import pg from 'pg'
import { timeLimitParametersIn, timeLimitedClient } from '../../scripts/db/connection-time-limits.mjs'
import { inspectTarget, inspectMaintenanceDatabase } from '../../scripts/db/inspect-server.mjs'

type TestContext = { after: (fn: () => void) => void }

type ClientInternals = pg.Client & {
  connectionParameters: Record<string, unknown> & { password?: unknown }
  binary: unknown
  _connectionTimeoutMillis: unknown
}

const SSL = { rejectUnauthorized: false, require: true }
const LIMITS = { connectMs: 3000, statementMs: 500, queryMs: 700 }
const LIMIT_NAMES = ['statement_timeout', 'query_timeout']

/** What pg makes of a connection string given next to the limits, which it reads over them. */
function pgWithoutTheFix(connectionString: string) {
  return new pg.Client({
    connectionString,
    ssl: SSL,
    connectionTimeoutMillis: LIMITS.connectMs,
    statement_timeout: LIMITS.statementMs,
    query_timeout: LIMITS.queryMs,
  }) as ClientInternals
}

const EMITTER_BOOKKEEPING = new Set(['_events', '_eventsCount', '_maxListeners'])

/**
 * An object's own properties, all the way down, with functions by name: two
 * clients built alike hold listeners that are equal but not the same function.
 */
function shapeOf(value: unknown, depth = 0): unknown {
  if (typeof value === 'function') return `[function ${value.name}]`
  if (value === null || typeof value !== 'object') return value
  if (depth > 8) return '[nested]'
  if (Array.isArray(value)) return value.map(item => shapeOf(item, depth + 1))
  return Object.fromEntries(
    Object.entries(value)
      .filter(([name]) => !EMITTER_BOOKKEEPING.has(name))
      .map(([name, item]) => [name, shapeOf(item, depth + 1)])
  )
}

/** Everything a client holds, the passwords pg hides included, apart from the two time limits. */
function connectionOf(client: ClientInternals) {
  const parameters = { ...(shapeOf(client.connectionParameters) as Record<string, unknown>), password: client.connectionParameters.password }
  for (const name of LIMIT_NAMES) delete parameters[name]
  return { ...(shapeOf(client) as Record<string, unknown>), password: client.password, connectionParameters: parameters }
}

/** The outcome of building a client: what it connects with, or the error building it throws. */
function built(make: () => ClientInternals) {
  try {
    return connectionOf(make())
  } catch (error) {
    return { threw: (error as Error).message }
  }
}

const BASE = 'postgresql://dbuser:p%40ss@db.example.com:5432/nextspark'

const URLS = [
  // a Unix socket written as a percent-encoded host, which a trailing space turns into a host name for pg
  'postgres://u@%2Ftmp/db?port=55447&sslmode=disable&statement_timeout=0 ',
  'postgres://u@%2Ftmp/db?port=55447&sslmode=disable&statement_timeout=0',
  'postgres://u@%2Ftmp%2Fpg/db?statement_timeout=0 &sslmode=disable',
  'postgres://u@%2Fvar%2Frun%2Fpostgresql/db?query_timeout=0\n',
  'postgres://u@%2Ftmp/db?statement_timeout=0\t',
  ' postgres://u@db.example.com/db?statement_timeout=0',
  // passwords with characters a URL encodes, or that pg encodes for it
  'postgresql://user:p%3Aa%2Fs%3Fs%23w%26rd%20x@db.example.com/nextspark?statement_timeout=0',
  'postgresql://user:p@ss w0rd!$@db.example.com/nextspark?statement_timeout=0',
  'postgres://u:100%pure@db.example.com/db?statement_timeout=0',
  'postgres://u:%E2%9C%93%zz@db.example.com/db?query_timeout=',
  // IPv6
  'postgres://u:p@[::1]:5433/db?statement_timeout=0',
  'postgres://u@[2001:db8::1]/db?query_timeout=0&sslmode=require',
  'postgres://u@[fe80::1%25en0]:5432/db?statement_timeout=0',
  // options, which do not lift the server's limit
  'postgres://u@db.example.com/db?options=-c%20statement_timeout%3D0&statement_timeout=0',
  `${BASE}?sslmode=disable&statement_timeout=0&query_timeout=&application_name=a%20b`,
  // repeated parameters, and parameters that name the target
  'postgres://u@db.example.com/db?statement_timeout=0&sslmode=disable&statement_timeout=',
  'postgres://u@db.example.com/db?statement_timeout=0&host=other.example.com&port=6543',
  'postgres://u:p@db.example.com/db?user=other&password=secret&statement_timeout=0',
  'postgres://u@/db?host=/var/run/postgresql&statement_timeout=0',
  'postgres:///db?host=%2Fvar%2Frun&port=5433&statement_timeout=0',
  'socket:/var/run/postgresql?db=nextspark&encoding=utf8&statement_timeout=0',
  '/var/run/postgresql nextspark?statement_timeout=0',
  '/var/run/postgresql nextspark',
  // the parameter written in the ways pg's parser still reads it
  'postgres://u@db.example.com/db?statement%5Ftimeout=0',
  'postgres://u@db.example.com/db?statement_\ttimeout=0',
  'postgres://u@db.example.com/db?statement_timeout=0#top',
  'postgres://u@db.example.com/db#statement_timeout=0',
  'postgres://u@db.example.com/db?application_name=a+b&statement_timeout=0',
  // no query, no database, an encoded database, only a query
  'postgres://u:p@db.example.com:6543/db',
  'postgres://u@db.example.com:5432?statement_timeout=0',
  'postgres://u@db.example.com/my%20db?statement_timeout=0',
  'postgres://u@db.example.com/my db?statement_timeout=0',
  '?statement_timeout=0',
  // ssl
  'postgres://u@db.example.com/db?ssl=true&statement_timeout=0',
  'postgres://u@db.example.com/db?ssl=0&statement_timeout=0',
  'postgres://u@db.example.com/db?sslmode=no-verify&statement_timeout=0',
  'postgres://u@db.example.com/db?replication=database&statement_timeout=0',
  // what pg cannot parse
  'postgres://[::1/db?statement_timeout=0',
  // parameters named like options pg's client reads only from what it is constructed with, some of them only in newer
  // versions of pg, which a client pg builds for the string does not act on
  'postgres://u:p@db.example.com/db?scramMaxIterations=1&statement_timeout=0',
  'postgres://u:p@db.example.com/db?pipeline=true&statement_timeout=0',
  'postgres://u:p@db.example.com/db?keepAlive=true&keepAliveInitialDelayMillis=1&connectionTimeoutMillis=0',
  'postgres://u:p@db.example.com/db?enableChannelBinding=true&binary=true&Promise=x&types=x&stream=x&connection=x',
  // parameters newer versions of pg read from the string
  'postgres://u:p@db.example.com/db?sslnegotiation=direct&statement_timeout=0',
  'postgres://u:p@db.example.com/db?sslnegotiation=direct&sslmode=disable',
  'postgres://u:p@db.example.com/db?sslnegotiation=sideways',
]

test('a time-limited client connects where, and as whom, pg would connect without the limits', () => {
  for (const url of URLS) {
    assert.deepEqual(built(() => timeLimitedClient(url, LIMITS) as ClientInternals), built(() => pgWithoutTheFix(url)), JSON.stringify(url))
  }
})

test('a time-limited client carries the limits it is given, whatever the URL sets', () => {
  for (const url of URLS.filter(url => !('threw' in built(() => pgWithoutTheFix(url))))) {
    const client = timeLimitedClient(url, LIMITS) as ClientInternals
    assert.equal(client.connectionParameters.statement_timeout, LIMITS.statementMs, JSON.stringify(url))
    assert.equal(client.connectionParameters.query_timeout, LIMITS.queryMs, JSON.stringify(url))
  }
})

test('the time-limit parameters are named as pg reads them', () => {
  assert.deepEqual(timeLimitParametersIn(`${BASE}?sslmode=disable&statement_timeout=0&query_timeout=`), ['statement_timeout', 'query_timeout'])
  assert.deepEqual(timeLimitParametersIn(`${BASE}?query_timeout=5000`), ['query_timeout'])
  assert.deepEqual(timeLimitParametersIn(`${BASE}?statement%5Ftimeout=0`), ['statement_timeout'])
  assert.deepEqual(timeLimitParametersIn('socket:/var/run/postgresql?db=nextspark&statement_timeout=0'), ['statement_timeout'])
  for (const url of [BASE, `${BASE}?options=-c%20statement_timeout%3D0`, `${BASE}#statement_timeout=0`, '/var/run/postgresql nextspark?statement_timeout=0']) {
    assert.deepEqual(timeLimitParametersIn(url), [], url)
  }
})

test("parameters named like the client's own options reach neither the client nor another parse", () => {
  const url =
    'postgres://u:p@db.example.com/db?binary=true&keepAlive=true&stream=x&Promise=x&types=x&connection=x' +
    '&enableChannelBinding=true&connectionTimeoutMillis=0&connectionString=postgres://x:y@elsewhere.example.com/other&statement_timeout=0'
  const client = timeLimitedClient(url, LIMITS) as ClientInternals

  assert.deepEqual(connectionOf(client), connectionOf(pgWithoutTheFix(url)))
  assert.equal(client.host, 'db.example.com')
  assert.equal(client.binary, false)
  assert.equal(client._connectionTimeoutMillis, LIMITS.connectMs)
})

/**
 * A stand-in Postgres on a Unix socket that records who connects to which
 * database and answers every query with no rows.
 */
async function socketServer(t: TestContext) {
  // a socket path is limited to about 100 bytes, which a per-user temporary directory can exceed
  const dir = fs.mkdtempSync(path.join('/tmp', 'pg-'))
  const sessions: Record<string, string>[] = []
  const sockets = new Set<net.Socket>()
  const server = net.createServer(socket => {
    sockets.add(socket)
    socket.on('error', () => {})
    let pending = Buffer.alloc(0)
    let started = false
    const message = (type: string, body: Buffer = Buffer.alloc(0)) => {
      const header = Buffer.alloc(5)
      header.write(type, 0, 'latin1')
      header.writeInt32BE(body.length + 4, 1)
      socket.write(Buffer.concat([header, body]))
    }
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk])
      for (;;) {
        if (!started) {
          if (pending.length < 8 || pending.length < pending.readInt32BE(0)) return
          const length = pending.readInt32BE(0)
          const code = pending.readInt32BE(4)
          const fields = pending.subarray(8, length).toString().split('\0')
          pending = pending.subarray(length)
          if (code === 80877103) {
            socket.write('N')
            continue
          }
          const startup: Record<string, string> = {}
          for (let index = 0; index + 1 < fields.length && fields[index]; index += 2) startup[fields[index]] = fields[index + 1]
          sessions.push(startup)
          started = true
          message('R', Buffer.from([0, 0, 0, 0]))
          message('Z', Buffer.from('I'))
          continue
        }
        if (pending.length < 5 || pending.length < pending.readInt32BE(1) + 1) return
        const type = String.fromCharCode(pending[0])
        pending = pending.subarray(pending.readInt32BE(1) + 1)
        if (type === 'Q') {
          message('C', Buffer.from('SELECT 0\0'))
          message('Z', Buffer.from('I'))
        } else if (type === 'X') socket.end()
      }
    })
  })
  await new Promise<void>(resolve => server.listen(path.join(dir, '.s.PGSQL.5432'), resolve))
  t.after(() => {
    for (const socket of sockets) socket.destroy()
    server.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return { dir, sessions }
}

const QUICK = { connectMs: 2000, statementMs: 1000, queryMs: 1000 }

test('a socket written as a host name pg does not resolve is not connected to', { timeout: 10000 }, async t => {
  const server = await socketServer(t)
  const url = `postgresql://dbuser@${encodeURIComponent(server.dir)}/nextspark_verify?sslmode=disable&statement_timeout=0 `

  await assert.rejects(new pg.Client(url).connect(), /ENOTFOUND|EAI_AGAIN/)
  await assert.rejects(inspectTarget(url, QUICK), /ENOTFOUND|EAI_AGAIN/)
  const maintenance = await inspectMaintenanceDatabase(url, QUICK)
  assert.equal(maintenance.unreachable, true)
  assert.match(maintenance.reason, /ENOTFOUND|EAI_AGAIN/)
  assert.deepEqual(server.sessions, [])
})

test('the maintenance database is asked for on the server, and as the user, the URL names', { timeout: 10000 }, async t => {
  const server = await socketServer(t)

  for (const url of [
    `postgresql://dbuser@${encodeURIComponent(server.dir)}/nextspark_verify?sslmode=disable&statement_timeout=0`,
    `postgresql://dbuser@/nextspark_verify?host=${encodeURIComponent(server.dir)}&sslmode=disable&statement_timeout=0`,
  ]) {
    server.sessions.length = 0
    await inspectTarget(url, QUICK)
    assert.deepEqual(await inspectMaintenanceDatabase(url, QUICK), { objects: [] }, url)
    assert.deepEqual(
      server.sessions.map(({ user, database, statement_timeout }) => ({ user, database, statement_timeout })),
      [
        { user: 'dbuser', database: 'nextspark_verify', statement_timeout: '1000' },
        { user: 'dbuser', database: 'postgres', statement_timeout: '1000' },
      ],
      url
    )
  }
})

test('a URL whose database is already the maintenance database is not asked twice', { timeout: 10000 }, async t => {
  const server = await socketServer(t)

  for (const url of [
    `postgresql://dbuser@${encodeURIComponent(server.dir)}/postgres?sslmode=disable`,
    `postgresql://dbuser@${encodeURIComponent(server.dir)}/postgre%73?sslmode=disable`,
    `postgresql://postgres@${encodeURIComponent(server.dir)}?sslmode=disable`,
  ]) {
    assert.deepEqual(await inspectMaintenanceDatabase(url, QUICK), { objects: [] }, url)
  }
  assert.deepEqual(server.sessions, [])
})
