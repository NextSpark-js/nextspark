/**
 * A migration that never finishes has to end `db:verify-theme` by itself, with
 * the migration's name, and have its session on the server ended; a migration
 * that is only slow has to pass; and one still running at
 * MIGRATION_TIMEOUT_SECONDS fails there, even one that switches
 * statement_timeout off. A statement the server cancels before the limit is not
 * reported as the limit, and a migration stopped partway says that what it
 * committed stays and it is not recorded as run. The runner is exercised against
 * a stand-in server that speaks enough of the wire protocol to connect, answer
 * queries, cancel a statement at its statement_timeout the way Postgres does,
 * keep a statement_timeout a query sets, or go silent.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { migrationTimeLimit, runMigrationSql } from '../../scripts/db/migration-time-limit.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const VERIFY = path.join(CORE, 'scripts/db/verify-theme-migrations.mjs')

type TestContext = { after: (fn: () => void) => void }

/**
 * How the stand-in server treats a query:
 *  - 'ok': answers at once
 *  - { slowMs }: answers after that long, unless the statement_timeout in effect cancels it first
 *  - 'stuck': never finishes, so only a statement_timeout in effect cancels it
 *  - 'silent': never answers anything again, statement_timeout or not
 *
 * The statement_timeout in effect is the one the session started with, as
 * changed by the query itself and by the queries before it: `SET` and
 * `set_config(…, false)` change it for the session, `SET LOCAL` and
 * `set_config(…, true)` only for the query that sets it.
 */
type Treatment = 'ok' | 'stuck' | 'silent' | { slowMs: number }

interface Session {
  pid: number
  startup: Record<string, string>
  queries: string[]
  receivedAt: Map<string, number>
  closed: boolean
  closedAt?: number
  statementTimeout: number
}

const SESSION_TIMEOUT = /\bSET\s+(LOCAL\s+)?statement_timeout\s*(?:=|TO)\s*'?(\d+)'?|set_config\(\s*'statement_timeout'\s*,\s*'(\d+)'\s*,\s*(true|false)\s*\)/gi

/** The statement_timeout a query runs under, and the one it leaves the session with. */
function statementTimeoutFor(sql: string, sessionTimeout: number) {
  let session = sessionTimeout
  let query = sessionTimeout
  for (const [, local, setValue, configValue, configLocal] of sql.matchAll(SESSION_TIMEOUT)) {
    const value = Number(setValue ?? configValue)
    query = value
    if (!local && configLocal !== 'true') session = value
  }
  return { query, session }
}

async function standInPostgres(t: TestContext, treat: (sql: string) => Treatment) {
  const sessions: Session[] = []
  const sockets = new Map<number, net.Socket>()
  const terminated: number[] = []
  const timers = new Set<NodeJS.Timeout>()
  let nextPid = 4100

  const later = (ms: number, fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, ms)
    timers.add(timer)
  }

  const server = net.createServer(socket => {
    const session: Session = { pid: nextPid++, startup: {}, queries: [], receivedAt: new Map(), closed: false, statementTimeout: 0 }
    sessions.push(session)
    sockets.set(session.pid, socket)
    socket.on('close', () => {
      session.closed = true
      session.closedAt = Date.now()
    })
    socket.on('error', () => {})

    const message = (type: string, body: Buffer = Buffer.alloc(0)) => {
      if (socket.destroyed) return
      const header = Buffer.alloc(5)
      header.write(type, 0, 'latin1')
      header.writeInt32BE(body.length + 4, 1)
      socket.write(Buffer.concat([header, body]))
    }
    const int32 = (value: number) => {
      const buffer = Buffer.alloc(4)
      buffer.writeInt32BE(value)
      return buffer
    }
    const text = (value: string) => Buffer.from(`${value}\0`)
    const readyForQuery = () => message('Z', Buffer.from('I'))
    const commandComplete = () => {
      message('C', text('SELECT 0'))
      readyForQuery()
    }

    let pending = Buffer.alloc(0)
    let started = false
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk])
      for (;;) {
        if (!started) {
          if (pending.length < 8 || pending.length < pending.readInt32BE(0)) return
          const length = pending.readInt32BE(0)
          const code = pending.readInt32BE(4)
          const body = pending.subarray(8, length)
          pending = pending.subarray(length)
          // SSLRequest
          if (code === 80877103) {
            socket.write('N')
            continue
          }
          const fields = body.toString().split('\0')
          for (let index = 0; index + 1 < fields.length && fields[index]; index += 2) {
            session.startup[fields[index]] = fields[index + 1]
          }
          session.statementTimeout = Number(session.startup.statement_timeout ?? 0)
          started = true
          message('R', int32(0))
          message('K', Buffer.concat([int32(session.pid), int32(1)]))
          readyForQuery()
          continue
        }

        if (pending.length < 5 || pending.length < pending.readInt32BE(1) + 1) return
        const type = String.fromCharCode(pending[0])
        const body = pending.subarray(5, pending.readInt32BE(1) + 1)
        pending = pending.subarray(pending.readInt32BE(1) + 1)

        if (type === 'Q') {
          const sql = body.subarray(0, body.length - 1).toString()
          session.queries.push(sql)
          session.receivedAt.set(sql, Date.now())
          const terminate = sql.match(/pg_terminate_backend\((\d+)\)/)
          if (terminate) {
            terminated.push(Number(terminate[1]))
            sockets.get(Number(terminate[1]))?.destroy()
            commandComplete()
            continue
          }
          const treatment = treat(sql)
          const timeout = statementTimeoutFor(sql, session.statementTimeout)
          session.statementTimeout = timeout.session
          const runsMs = treatment === 'stuck' ? Infinity : typeof treatment === 'object' ? treatment.slowMs : undefined
          if (treatment === 'ok') commandComplete()
          else if (runsMs !== undefined && timeout.query > 0 && timeout.query < runsMs) {
            later(timeout.query, () => {
              message('E', Buffer.concat([
                text('SERROR'),
                text('C57014'),
                text('Mcanceling statement due to statement timeout'),
                Buffer.from('\0'),
              ]))
              readyForQuery()
            })
          } else if (typeof treatment === 'object') later(treatment.slowMs, commandComplete)
        }
        // The extended protocol, which parameterised queries use: no rows for any of them
        else if (type === 'P') message('1')
        else if (type === 'B') message('2')
        else if (type === 'D') message('n')
        else if (type === 'E') message('C', text('SELECT 0'))
        else if (type === 'S') readyForQuery()
        else if (type === 'X') socket.end()
      }
    })
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    for (const timer of timers) clearTimeout(timer)
    for (const socket of sockets.values()) socket.destroy()
    server.close()
  })
  const { port } = server.address() as net.AddressInfo
  return { url: `postgresql://dbuser@127.0.0.1:${port}/nextspark_verify?sslmode=disable`, sessions, terminated }
}

interface Run {
  status: number | null
  output: string
  elapsedMs: number
}

/**
 * Runs a script to its end, or kills it after `killAfterMs` and reports a null
 * status. The script runs in a process group of its own, which is what gets
 * killed: db:verify-theme runs the migrations in a child that would otherwise
 * outlive it and hold the output open.
 */
function run(t: TestContext, script: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; killAfterMs: number }) {
  return new Promise<Run>(resolve => {
    const started = Date.now()
    const child = spawn(process.execPath, [script, ...args], { cwd: options.cwd, env: options.env, detached: true })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    const killGroup = () => {
      try {
        process.kill(-child.pid!, 'SIGKILL')
      } catch {
        // the group has already exited
      }
    }
    const killer = setTimeout(killGroup, options.killAfterMs)
    t.after(() => {
      clearTimeout(killer)
      killGroup()
    })
    child.on('close', (status: number | null) => {
      clearTimeout(killer)
      resolve({ status, output, elapsedMs: Date.now() - started })
    })
  })
}

/** An environment with none of the variables that would point the runner elsewhere. */
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const {
    MIGRATE_DATABASE_URL: _migrate,
    DATABASE_URL: _database,
    VERIFY_THEME_DATABASE_URL: _verify,
    VERIFY_THEME_ALLOW_CLUSTER_CHANGES: _allow,
    MIGRATION_TIMEOUT_SECONDS: _limit,
    NEXT_PUBLIC_ACTIVE_THEME: _theme,
    ...env
  } = process.env
  return { ...env, ...extra }
}

/** A project in monorepo layout whose core migrations are the given files. */
function projectWith(t: TestContext, migrations: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-time-limit-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  for (const [file, sql] of Object.entries(migrations)) {
    fs.writeFileSync(path.join(root, 'packages/core/migrations', file), sql)
  }
  return root
}

const MIGRATIONS = {
  '001_first.sql': 'CREATE TABLE first_table (id int);',
  '002_waits.sql': 'SELECT pg_sleep(60);',
  '003_after.sql': 'CREATE TABLE after_table (id int);',
}

const sessionThatRan = (sessions: Session[], sql: string) => sessions.find(session => session.queries.includes(sql))

test('the limit is read in seconds, and the server and the client both hold to it', () => {
  assert.equal(migrationTimeLimit({}), null)
  assert.equal(migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: '' }), null)
  assert.deepEqual(migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: '30' }), { seconds: 30, statementMs: 30000, queryMs: 30000 })
  assert.deepEqual(migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: '0.5' }), { seconds: 0.5, statementMs: 500, queryMs: 500 })
  for (const value of ['0', '-5', 'thirty', 'Infinity']) {
    assert.throws(() => migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: value }), /greater than 0/, value)
  }
})

test('a migration still running at the limit fails the run with its name, and its statement is stopped', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? 'stuck' : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  const waiting = sessionThatRan(server.sessions, MIGRATIONS['002_waits.sql'])!
  if (/its session on the server was ended/.test(result.output)) assert.deepEqual(server.terminated, [waiting.pid])
  else assert.match(result.output, /canceling statement due to statement timeout/)
  assert.ok(result.elapsedMs < 5000, `took ${result.elapsedMs} ms`)
  assert.equal(waiting.startup.statement_timeout, '500')
  assert.equal(sessionThatRan(server.sessions, MIGRATIONS['003_after.sql']), undefined)
})

// What the runner says about a migration stopped partway, however it was stopped
const COMMITTED_STAYS = /stays in the database\. It is not recorded as run, so the next run starts the file over/

test('a statement the server cancels under a limit the migration sets itself is not reported as the limit', { timeout: 20000 }, async t => {
  // a lock wait the server gives up on before the client does: its own limit, set lower by the migration
  const migrations = { ...MIGRATIONS, '002_waits.sql': "SET statement_timeout = 100; SELECT pg_sleep(60);" }
  const server = await standInPostgres(t, sql => (sql === migrations['002_waits.sql'] ? 'stuck' : 'ok'))
  const cwd = projectWith(t, migrations)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '5' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  const reported = result.output.match(
    /Failed to execute 002_waits\.sql: the server cancelled it after (\d+) ms, before MIGRATION_TIMEOUT_SECONDS \(5 s\) ran out: canceling statement due to statement timeout\./
  )
  assert.ok(reported, result.output)
  assert.ok(Number(reported[1]) >= 100 && Number(reported[1]) < 5000, reported[0])
  assert.doesNotMatch(result.output, /did not finish within 5 s/)
  assert.match(result.output, COMMITTED_STAYS)
  assert.deepEqual(server.terminated, [])
})

/** A client whose query the server cancels after `afterMs`, for the reason given. */
function cancelledAfter(afterMs: number, reason = 'canceling statement due to statement timeout') {
  return {
    query: () => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(reason), { code: '57014' })), afterMs)),
  } as unknown as Parameters<typeof runMigrationSql>[0]
}

test('a cancellation says after how long it came, and that the limit had not run out when it came sooner', { timeout: 20000 }, async () => {
  const limit = { seconds: 0.4, statementMs: 400, queryMs: 400 }

  await assert.rejects(
    runMigrationSql(cancelledAfter(50), { sql: 'SELECT 1', limit, connectionString: '' }),
    (error: Error) => {
      assert.match(error.message, /^the server cancelled it after \d+ ms, before MIGRATION_TIMEOUT_SECONDS \(0\.4 s\) ran out: canceling statement due to statement timeout\./)
      assert.doesNotMatch(error.message, /did not finish/)
      assert.match(error.message, COMMITTED_STAYS)
      return true
    }
  )
  await assert.rejects(
    runMigrationSql(cancelledAfter(450), { sql: 'SELECT 1', limit, connectionString: '' }),
    (error: Error) => {
      assert.match(
        error.message,
        /^did not finish within 0\.4 s \(MIGRATION_TIMEOUT_SECONDS\); the server cancelled it after \d+ ms: canceling statement due to statement timeout\./
      )
      assert.match(error.message, COMMITTED_STAYS)
      return true
    }
  )
  // another session cancelling the statement once the limit has passed: the reason is the server's, not the limit
  await assert.rejects(
    runMigrationSql(cancelledAfter(450, 'canceling statement due to user request'), { sql: 'SELECT 1', limit, connectionString: '' }),
    (error: Error) => {
      assert.match(
        error.message,
        /^did not finish within 0\.4 s \(MIGRATION_TIMEOUT_SECONDS\); the server cancelled it after (4[5-9]\d|[5-9]\d\d) ms: canceling statement due to user request\./
      )
      return true
    }
  )
})

test('a migration whose session cannot be ended is said to be able to go on committing', { timeout: 20000 }, async () => {
  // a port nothing listens on: the connection that would end the session is refused
  const closed = net.createServer()
  await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve))
  const { port } = closed.address() as net.AddressInfo
  await new Promise(resolve => closed.close(resolve))

  const client = {
    processID: 4242,
    query: () => Promise.reject(new Error('Query read timeout')),
    end: () => Promise.resolve(),
  } as unknown as Parameters<typeof runMigrationSql>[0]

  await assert.rejects(
    runMigrationSql(client, {
      sql: 'SELECT 1',
      limit: { seconds: 0.5, statementMs: 500, queryMs: 500 },
      connectionString: `postgresql://dbuser@127.0.0.1:${port}/nextspark_verify?sslmode=disable`,
    }),
    (error: Error) => {
      assert.match(error.message, /^did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\); its session on the server could not be ended: .*ECONNREFUSED/)
      assert.match(error.message, /It may still be running there, and what it commits, with a COMMIT in the file or in a procedure it calls, stays in the database\./)
      assert.match(error.message, COMMITTED_STAYS)
      return true
    }
  )
})

test('a migration the server never answers is given up on, and its session ended', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? 'silent' : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  assert.match(result.output, /its session on the server was ended\. What it had not committed is gone, but what it committed before it was stopped/)
  assert.match(result.output, COMMITTED_STAYS)
  assert.ok(result.elapsedMs < 5000, `took ${result.elapsedMs} ms`)
  const waiting = sessionThatRan(server.sessions, MIGRATIONS['002_waits.sql'])!
  assert.deepEqual(server.terminated, [waiting.pid])
  assert.equal(waiting.closed, true)
  assert.equal(sessionThatRan(server.sessions, MIGRATIONS['003_after.sql']), undefined)
})

test('a migration that is slow but within the limit runs, and so does the rest', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? { slowMs: 700 } : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '1' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /Successfully executed 002_waits\.sql/)
  assert.ok(sessionThatRan(server.sessions, MIGRATIONS['003_after.sql']))
  assert.deepEqual(server.terminated, [])
})

// pg reads a connection string's parameters over the options passed next to it
const LIMITS_OFF = '&statement_timeout=0&query_timeout='

test('a database URL that switches the limits off does not lift them', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? 'stuck' : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url + LIMITS_OFF, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(
    result.output,
    /The database URL sets statement_timeout and query_timeout, which migrations do not use: each one runs under MIGRATION_TIMEOUT_SECONDS \(0\.5 s\)/
  )
  assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  assert.match(result.output, /canceling statement due to statement timeout|its session on the server was ended/)
  assert.ok(result.elapsedMs < 5000, `took ${result.elapsedMs} ms`)
  assert.ok(server.sessions.length > 0)
  for (const session of server.sessions) assert.equal(session.startup.statement_timeout, '500')
})

test('a database URL that switches the limits off still leaves a server that never answers given up on', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? 'silent' : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url + LIMITS_OFF, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  assert.match(result.output, /its session on the server was ended/)
  assert.ok(result.elapsedMs < 5000, `took ${result.elapsedMs} ms`)
  const waiting = sessionThatRan(server.sessions, MIGRATIONS['002_waits.sql'])!
  assert.deepEqual(server.terminated, [waiting.pid])
  assert.equal(waiting.closed, true)
})

test('a database URL that switches the limits off does not fail a migration that is only slow', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? { slowMs: 700 } : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url + LIMITS_OFF, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '1' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /Successfully executed 002_waits\.sql/)
  assert.ok(sessionThatRan(server.sessions, MIGRATIONS['003_after.sql']))
  assert.deepEqual(server.terminated, [])
})

test('without a limit, the time limits a database URL sets are the ones that apply', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, () => 'ok')
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: `${server.url}&statement_timeout=90000`, NEXT_PUBLIC_ACTIVE_THEME: 'fixture' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /statement_timeout/)
  assert.ok(server.sessions.length > 0)
  for (const session of server.sessions) assert.equal(session.startup.statement_timeout, '90000')
})

/**
 * How long after the server received a migration its session was ended. A
 * migration that runs past the limit has to be cut at the limit, not when it
 * would have finished.
 */
function cutAfterMs(session: Session, sql: string) {
  assert.ok(session.closedAt, 'the session was never ended')
  return session.closedAt! - session.receivedAt.get(sql)!
}

// Under a limit of 1 s, the client waited up to 2 s for an answer while the server's limit was off.
const RUNS_PAST_THE_LIMIT_MS = 1500

test('a migration that switches statement_timeout off for itself still stops at the limit', { timeout: 60000 }, async t => {
  for (const switchedOff of [
    'SET statement_timeout = 0; SELECT pg_sleep(1.5);',
    'BEGIN; SET LOCAL statement_timeout = 0; SELECT pg_sleep(1.5); COMMIT;',
    "SELECT set_config('statement_timeout', '0', false); SELECT pg_sleep(1.5);",
    "SELECT set_config('statement_timeout', '0', true); SELECT pg_sleep(1.5);",
  ]) {
    const migrations = { ...MIGRATIONS, '002_waits.sql': switchedOff }
    const server = await standInPostgres(t, sql => (sql === switchedOff ? { slowMs: RUNS_PAST_THE_LIMIT_MS } : 'ok'))
    const cwd = projectWith(t, migrations)

    const result = await run(t, RUNNER, ['--no-env-file'], {
      cwd,
      env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '1' }),
      killAfterMs: 15000,
    })

    assert.equal(result.status, 1, `${switchedOff}\n${result.output}`)
    assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 1 s \(MIGRATION_TIMEOUT_SECONDS\); its session on the server was ended/, switchedOff)
    const session = sessionThatRan(server.sessions, switchedOff)!
    assert.deepEqual(server.terminated, [session.pid], switchedOff)
    const cutMs = cutAfterMs(session, switchedOff)
    assert.ok(cutMs >= 900 && cutMs < RUNS_PAST_THE_LIMIT_MS - 200, `${switchedOff}: cut after ${cutMs} ms`)
    assert.equal(sessionThatRan(server.sessions, MIGRATIONS['003_after.sql']), undefined, switchedOff)
  }
})

test('a migration that switches statement_timeout off for the ones after it does not lift the limit from them', { timeout: 20000 }, async t => {
  const migrations = {
    '001_first.sql': 'CREATE TABLE first_table (id int);',
    '002_switches_off.sql': "SELECT set_config('statement_timeout', '0', false);",
    '003_waits.sql': 'SELECT pg_sleep(1.5);',
  }
  const server = await standInPostgres(t, sql => (sql === migrations['003_waits.sql'] ? { slowMs: RUNS_PAST_THE_LIMIT_MS } : 'ok'))
  const cwd = projectWith(t, migrations)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '1' }),
    killAfterMs: 15000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Successfully executed 002_switches_off\.sql/)
  assert.match(result.output, /Failed to execute 003_waits\.sql: did not finish within 1 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  const session = sessionThatRan(server.sessions, migrations['003_waits.sql'])!
  assert.equal(session.statementTimeout, 0)
  const cutMs = cutAfterMs(session, migrations['003_waits.sql'])
  assert.ok(cutMs >= 900 && cutMs < RUNS_PAST_THE_LIMIT_MS - 200, `cut after ${cutMs} ms`)
})

test('db:migrate takes the limit from the project .env, as it takes the database', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === MIGRATIONS['002_waits.sql'] ? 'silent' : 'ok'))
  const cwd = projectWith(t, MIGRATIONS)
  fs.writeFileSync(
    path.join(cwd, '.env'),
    `DATABASE_URL="${server.url}"\nNEXT_PUBLIC_ACTIVE_THEME=fixture\nMIGRATION_TIMEOUT_SECONDS=0.5\n`
  )

  const result = await run(t, RUNNER, [], { cwd, env: cleanEnv({}), killAfterMs: 10000 })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Failed to execute 002_waits\.sql: did not finish within 0\.5 s \(MIGRATION_TIMEOUT_SECONDS\)/)
  assert.equal(sessionThatRan(server.sessions, MIGRATIONS['002_waits.sql'])?.startup.statement_timeout, '500')
})

test('db:migrate sets no limit unless it is asked for one', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, () => 'ok')
  const cwd = projectWith(t, MIGRATIONS)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 0, result.output)
  assert.ok(server.sessions.length > 0)
  for (const session of server.sessions) assert.equal(session.startup.statement_timeout, undefined)
})

const FIRST_CORE_MIGRATION = (() => {
  const dir = path.join(CORE, 'migrations')
  const file = fs.readdirSync(dir).filter(name => name.endsWith('.sql')).sort()[0]
  return { file, sql: fs.readFileSync(path.join(dir, file), 'utf8') }
})()

test('db:verify-theme ends by itself when a migration hangs, naming it', { timeout: 30000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === FIRST_CORE_MIGRATION.sql ? 'stuck' : 'ok'))

  const result = await run(t, VERIFY, ['default'], {
    cwd: CORE,
    env: cleanEnv({ VERIFY_THEME_DATABASE_URL: server.url, MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 20000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /Each migration may run for 0\.5 s; MIGRATION_TIMEOUT_SECONDS changes that/)
  assert.match(
    result.output,
    new RegExp(`Failed to execute ${FIRST_CORE_MIGRATION.file.replace('.', '\\.')}: did not finish within 0\\.5 s`)
  )
  assert.match(result.output, /Theme "default" migrations failed \(exit code 1\)/)
})

test('db:verify-theme gives every migration 30 s unless told otherwise', { timeout: 60000 }, async t => {
  const server = await standInPostgres(t, () => 'ok')

  const result = await run(t, VERIFY, ['default'], {
    cwd: CORE,
    env: cleanEnv({ VERIFY_THEME_DATABASE_URL: server.url }),
    killAfterMs: 45000,
  })

  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /Each migration may run for 30 s/)
  const migrating = sessionThatRan(server.sessions, FIRST_CORE_MIGRATION.sql)
  assert.equal(migrating?.startup.statement_timeout, '30000')
})

test('db:verify-theme refuses a limit that is not a number of seconds before it connects', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, () => 'ok')

  const result = await run(t, VERIFY, ['default'], {
    cwd: CORE,
    env: cleanEnv({ VERIFY_THEME_DATABASE_URL: server.url, MIGRATION_TIMEOUT_SECONDS: 'forever' }),
    killAfterMs: 10000,
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /MIGRATION_TIMEOUT_SECONDS must be a number of seconds greater than 0, not "forever"/)
  assert.deepEqual(server.sessions, [])
})
