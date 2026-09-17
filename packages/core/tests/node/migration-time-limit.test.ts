/**
 * A migration that never finishes has to end `db:verify-theme` by itself, with
 * the migration's name, and have its session on the server ended; a migration
 * that is only slow has to pass; and one still running at
 * MIGRATION_TIMEOUT_SECONDS fails there, even one that switches
 * statement_timeout off. A statement the server cancels before the limit is not
 * reported as the limit, and a migration stopped partway says that what it
 * committed stays and it is not recorded as run. Recording a migration that ran
 * to the end is not held to the limit, and a record that fails says the file ran
 * and gives the INSERT that records it. A migration the server answers inside a
 * transaction, open or failed, has that transaction rolled back and is not
 * recorded, with or without a limit. The runner is exercised against
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
import {
  MigrationNotRecordedError,
  RECORD_WAIT_MS,
  migrationClient,
  migrationTimeLimit,
  recordMigration,
  runMigrationSql,
} from '../../scripts/db/migration-time-limit.mjs'

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
 *  - { error: [code, message] }: fails at once with that SQLSTATE and message
 *
 * A parameterised query is treated the same way when it is executed, by its SQL.
 *
 * The statement_timeout in effect is the one the session started with, as
 * changed by the query itself and by the queries before it: `SET` and
 * `set_config(…, false)` change it for the session, `SET LOCAL` and
 * `set_config(…, true)` only for the query that sets it.
 */
type Treatment = 'ok' | 'stuck' | 'silent' | { slowMs: number } | { error: [string, string] }

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
    // A BEGIN a query leaves without a COMMIT or ROLLBACK after it keeps the session in a transaction,
    // which a failed statement leaves failed
    let transaction: 'I' | 'T' | 'E' = 'I'
    const readyForQuery = () => message('Z', Buffer.from(transaction))
    const commandComplete = () => {
      message('C', text('SELECT 0'))
      readyForQuery()
    }

    const error = (code: string, reason: string) =>
      Buffer.concat([text('SERROR'), text(`C${code}`), text(`M${reason}`), Buffer.from('\0')])

    /** Runs a statement as its treatment says, under the statement_timeout in effect. */
    const execute = (sql: string, complete: () => void, fail: (fields: Buffer) => void) => {
      session.queries.push(sql)
      session.receivedAt.set(sql, Date.now())
      const treatment = treat(sql)
      const timeout = statementTimeoutFor(sql, session.statementTimeout)
      session.statementTimeout = timeout.session
      for (const [statement] of sql.matchAll(/\b(BEGIN|COMMIT|ROLLBACK)\s*(?:;|$)/gi)) {
        transaction = /^BEGIN/i.test(statement) ? 'T' : 'I'
      }
      const failed = (fields: Buffer) => {
        if (transaction === 'T') transaction = 'E'
        fail(fields)
      }
      if (typeof treatment === 'object' && 'error' in treatment) return failed(error(...treatment.error))
      const runsMs = treatment === 'stuck' ? Infinity : typeof treatment === 'object' ? treatment.slowMs : undefined
      if (treatment === 'ok') complete()
      else if (runsMs !== undefined && timeout.query > 0 && timeout.query < runsMs) {
        later(timeout.query, () => failed(error('57014', 'canceling statement due to statement timeout')))
      } else if (typeof treatment === 'object') later(treatment.slowMs, complete)
    }

    let pending = Buffer.alloc(0)
    let started = false
    let parsed = ''
    let executed = Promise.resolve()
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
          const terminate = sql.match(/pg_terminate_backend\((\d+)\)/)
          if (terminate) {
            session.queries.push(sql)
            terminated.push(Number(terminate[1]))
            sockets.get(Number(terminate[1]))?.destroy()
            commandComplete()
            continue
          }
          // the ReadyForQuery after an error comes in a later packet, which a real server's can too
          execute(sql, commandComplete, fields => {
            message('E', fields)
            later(20, readyForQuery)
          })
        }
        // The extended protocol, which parameterised queries use: no rows for any of them, and
        // Sync is answered once the statement it follows has
        else if (type === 'P') {
          parsed = body.subarray(body.indexOf(0) + 1, body.indexOf(0, body.indexOf(0) + 1)).toString()
          message('1')
        } else if (type === 'B') message('2')
        else if (type === 'D') message('n')
        else if (type === 'E') {
          executed = new Promise<void>(resolve => {
            execute(
              parsed,
              () => {
                message('C', text('SELECT 0'))
                resolve()
              },
              fields => {
                message('E', fields)
                resolve()
              }
            )
          })
        } else if (type === 'S') void executed.then(readyForQuery)
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

/** A project whose core, theme and theme entity migrations are the given files, for the theme `fixture`. */
function projectWithTheme(t: TestContext, { core, theme, widgets }: Record<'core' | 'theme' | 'widgets', Record<string, string>>) {
  const root = projectWith(t, core)
  const themeDir = path.join(root, 'apps/dev/contents/themes/fixture')
  for (const [dir, files] of [
    [path.join(themeDir, 'migrations'), theme],
    [path.join(themeDir, 'entities/widgets/migrations'), widgets],
  ] as const) {
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), sql)
  }
  return root
}

const TRACKED = {
  core: { '001_core.sql': 'CREATE TABLE core_table (id int);', '002_core_after.sql': 'CREATE TABLE core_after (id int);' },
  theme: { '001_theme.sql': 'CREATE TABLE theme_table (id int);' },
  widgets: { '001_widgets.sql': 'CREATE TABLE widgets (id int);' },
}

/** The statement that records a migration in a tracking table, parameterised or not. */
const recordOf = (table: string) => new RegExp(`^(SET LOCAL [^;]+; )*INSERT INTO "${table}"`)

test('recording a migration that ran to the end is not held to the limit, in any tracking table', { timeout: 30000 }, async t => {
  const tables = ['_migrations', '_content_migrations', '_entity_migrations']
  const server = await standInPostgres(t, sql => (tables.some(table => recordOf(table).test(sql)) ? { slowMs: 1200 } : 'ok'))
  const cwd = projectWithTheme(t, TRACKED)

  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd,
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
    killAfterMs: 20000,
  })

  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /Successfully executed 001_core\.sql/)
  assert.match(result.output, /Successfully executed 002_core_after\.sql/)
  assert.match(result.output, /001_theme\.sql executed successfully/)
  assert.match(result.output, /001_widgets\.sql executed successfully/)
  for (const table of tables) {
    const records = server.sessions.flatMap(session => session.queries).filter(sql => recordOf(table).test(sql))
    assert.ok(records.length > 0, table)
    // the server still has a limit of its own on the record
    for (const record of records) assert.match(record, new RegExp(`^SET LOCAL statement_timeout = ${RECORD_WAIT_MS}; SET LOCAL lock_timeout = 0; `), record)
  }
  for (const session of server.sessions) assert.equal(session.startup.statement_timeout, '500')
})

test('a migration that ran to the end but could not be recorded says so, and gives the INSERT that records it', { timeout: 30000 }, async t => {
  const cases = [
    {
      table: '_migrations',
      error: ['57014', 'canceling statement due to statement timeout'] as [string, string],
      file: '001_core.sql',
      insert: `INSERT INTO "_migrations" ("filename") VALUES ('001_core.sql') ON CONFLICT DO NOTHING;`,
      notRun: TRACKED.core['002_core_after.sql'],
    },
    {
      table: '_content_migrations',
      error: ['42501', 'permission denied for table _content_migrations'] as [string, string],
      file: '001_theme.sql',
      insert: `INSERT INTO "_content_migrations" ("source_type", "source_name", "filename") VALUES ('theme', 'fixture', '001_theme.sql') ON CONFLICT DO NOTHING;`,
      notRun: TRACKED.widgets['001_widgets.sql'],
    },
    {
      table: '_entity_migrations',
      error: ['55P03', 'canceling statement due to lock timeout'] as [string, string],
      file: '001_widgets.sql',
      insert: `INSERT INTO "_entity_migrations" ("entity_name", "source_type", "source_name", "filename") VALUES ('widgets', 'theme', 'fixture', '001_widgets.sql') ON CONFLICT DO NOTHING;`,
      notRun: undefined,
    },
  ]
  for (const { table, error, file, insert, notRun } of cases) {
    const server = await standInPostgres(t, sql => (recordOf(table).test(sql) ? { error } : 'ok'))
    const cwd = projectWithTheme(t, TRACKED)

    const result = await run(t, RUNNER, ['--no-env-file'], {
      cwd,
      env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', MIGRATION_TIMEOUT_SECONDS: '0.5' }),
      killAfterMs: 10000,
    })

    assert.equal(result.status, 1, result.output)
    const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(
      result.output,
      new RegExp(
        `❌ ${escaped(file)} ran to the end, but recording it as run in "${table}" failed: ${escaped(error[1])}\\. ` +
          'What it committed stays in the database, and until it is recorded the next run starts the file over\\. ' +
          `Record it before running the migrations again: ${escaped(insert)}`
      ),
      table
    )
    assert.doesNotMatch(result.output, new RegExp(`Failed to execute ${escaped(file)}`), table)
    if (notRun) assert.equal(sessionThatRan(server.sessions, notRun), undefined, table)
  }
})

/** The tracked migrations with `sql` as the file recorded in `table`, and the migration the runner would run after it. */
function trackedWith(table: string, sql: string) {
  if (table === '_migrations') {
    return { files: { ...TRACKED, core: { ...TRACKED.core, '001_core.sql': sql } }, file: '001_core.sql', next: TRACKED.core['002_core_after.sql'] }
  }
  if (table === '_content_migrations') {
    return { files: { ...TRACKED, theme: { '001_theme.sql': sql } }, file: '001_theme.sql', next: TRACKED.widgets['001_widgets.sql'] }
  }
  return { files: { ...TRACKED, widgets: { '001_widgets.sql': sql } }, file: '001_widgets.sql', next: undefined }
}

const TABLES = ['_migrations', '_content_migrations', '_entity_migrations']
const WITH_AND_WITHOUT_LIMIT: Record<string, string>[] = [{ MIGRATION_TIMEOUT_SECONDS: '0.5' }, {}]

/** Runs the tracked migrations with `sql` as the file recorded in `table`, against a stand-in that treats that file as given. */
async function runTrackedWith(t: TestContext, table: string, sql: string, treatment: Treatment, limit: Record<string, string>) {
  const server = await standInPostgres(t, query => (query === sql ? treatment : 'ok'))
  const { files, file, next } = trackedWith(table, sql)
  const result = await run(t, RUNNER, ['--no-env-file'], {
    cwd: projectWithTheme(t, files),
    env: cleanEnv({ DATABASE_URL: server.url, NEXT_PUBLIC_ACTIVE_THEME: 'fixture', ...limit }),
    killAfterMs: 10000,
  })
  const session = sessionThatRan(server.sessions, sql)
  return {
    server,
    result,
    file,
    next,
    label: `${table} ${JSON.stringify(limit)} ${sql}`,
    afterFile: session?.queries[session.queries.indexOf(sql) + 1],
    records: server.sessions.flatMap(s => s.queries).filter(query => recordOf(table).test(query) && query.includes(`'${file}'`)),
  }
}

const escapedFile = (file: string) => file.replace(/\./g, '\\.')

test('a migration that ends inside a transaction it left open is rolled back and fails, in _migrations, _content_migrations and _entity_migrations', { timeout: 60000 }, async t => {
  // BEGIN; SELECT 1; opens a transaction that writes nothing, so no transaction id is ever assigned to it
  for (const sql of ['BEGIN; CREATE TABLE open_table (id int);', 'BEGIN; SELECT 1;']) {
    for (const table of TABLES) {
      for (const limit of WITH_AND_WITHOUT_LIMIT) {
        const { server, result, file, next, label, afterFile, records } = await runTrackedWith(t, table, sql, 'ok', limit)

        assert.equal(result.status, 1, `${label}\n${result.output}`)
        assert.match(
          result.output,
          new RegExp(
            `❌ Failed to execute ${escapedFile(file)}: the file ends inside a transaction it opened and did not close; that transaction was rolled back: ` +
              'nothing the file did inside it is applied, and it is not recorded as run, so the next run starts the file over\\. ' +
              'Anything it committed before opening that transaction stays in the database\\. Add the COMMIT the file is missing'
          ),
          label
        )
        assert.doesNotMatch(result.output, new RegExp(`Successfully executed ${escapedFile(file)}|${escapedFile(file)} executed successfully`), label)
        assert.equal(afterFile, 'ROLLBACK', label)
        assert.deepEqual(records, [], label)
        if (next) assert.equal(sessionThatRan(server.sessions, next), undefined, label)
      }
    }
  }
})

test('a migration that fails inside a transaction it opened has it rolled back, and says nothing it did inside it is applied', { timeout: 60000 }, async t => {
  const sql = 'BEGIN; SELECT 1/0;'
  for (const table of TABLES) {
    for (const limit of WITH_AND_WITHOUT_LIMIT) {
      const { server, result, file, next, label, afterFile, records } = await runTrackedWith(t, table, sql, { error: ['22012', 'division by zero'] }, limit)

      assert.equal(result.status, 1, `${label}\n${result.output}`)
      assert.match(
        result.output,
        new RegExp(
          `❌ Failed to execute ${escapedFile(file)}: division by zero\\. It failed inside a transaction it had not closed, and that transaction was rolled back: ` +
            'nothing the file did inside it is applied\\. Anything it committed before opening that transaction stays in the database, ' +
            'and it is not recorded as run, so the next run starts the file over\\.'
        ),
        label
      )
      assert.equal(afterFile, 'ROLLBACK', label)
      assert.deepEqual(records, [], label)
      if (next) assert.equal(sessionThatRan(server.sessions, next), undefined, label)
    }
  }
})

test('a migration that commits the transaction it opens is recorded, and the rest runs', { timeout: 60000 }, async t => {
  const sql = 'BEGIN; CREATE TABLE committed_table (id int); COMMIT;'
  for (const table of TABLES) {
    for (const limit of WITH_AND_WITHOUT_LIMIT) {
      const { server, result, file, next, label, records } = await runTrackedWith(t, table, sql, 'ok', limit)

      assert.equal(result.status, 0, `${label}\n${result.output}`)
      assert.match(result.output, new RegExp(`Successfully executed ${escapedFile(file)}|${escapedFile(file)} executed successfully`), label)
      assert.equal(records.length, 1, label)
      assert.ok(!server.sessions.some(session => session.queries.includes('ROLLBACK')), label)
      if (next) assert.ok(sessionThatRan(server.sessions, next), label)
    }
  }
})

test('a statement cancelled inside a transaction has it rolled back, and a cancellation under the limit keeps its own message', { timeout: 20000 }, async t => {
  const sql = 'BEGIN; SET LOCAL statement_timeout = 100; SELECT pg_sleep(60);'

  const limited = await runTrackedWith(t, '_migrations', sql, 'stuck', { MIGRATION_TIMEOUT_SECONDS: '5' })
  assert.equal(limited.result.status, 1, limited.result.output)
  assert.match(
    limited.result.output,
    /❌ Failed to execute 001_core\.sql: the server cancelled it after \d+ ms, before MIGRATION_TIMEOUT_SECONDS \(5 s\) ran out: canceling statement due to statement timeout\. What it had not committed is gone/
  )
  assert.match(limited.result.output, COMMITTED_STAYS)
  assert.doesNotMatch(limited.result.output, /It failed inside a transaction/)
  assert.equal(limited.afterFile, 'ROLLBACK')
  assert.deepEqual(limited.records, [])

  const unlimited = await runTrackedWith(t, '_migrations', sql, 'stuck', {})
  assert.equal(unlimited.result.status, 1, unlimited.result.output)
  assert.match(
    unlimited.result.output,
    /❌ Failed to execute 001_core\.sql: canceling statement due to statement timeout\. It failed inside a transaction it had not closed, and that transaction was rolled back/
  )
  assert.equal(unlimited.afterFile, 'ROLLBACK')
  assert.deepEqual(unlimited.records, [])
})

test('a ROLLBACK that fails is said to leave the transaction to end with the connection', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (sql === 'ROLLBACK' ? { error: ['XX000', 'rollback refused'] } : 'ok'))
  for (const limit of [migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: '5' }), null]) {
    const client = migrationClient(server.url, limit)
    await client.connect()
    try {
      await assert.rejects(runMigrationSql(client, { sql: 'BEGIN; SELECT 1;', limit, connectionString: server.url }), (error: Error) => {
        assert.match(
          error.message,
          /^the file ends inside a transaction it opened and did not close; rolling that transaction back failed \(rollback refused\), and Postgres rolls it back when the run stops and closes the connection: nothing the file did inside it is applied/
        )
        return true
      })
    } finally {
      // before the stand-in closes its sockets under a client still waiting for the ROLLBACK's ReadyForQuery
      await client.end()
    }
  }
})

test('a record is sent with its own limit on the server and the client, and its values written as SQL literals', async () => {
  const sent: unknown[] = []
  const client = { query: (query: unknown) => (sent.push(query), Promise.resolve()) } as unknown as Parameters<typeof recordMigration>[0]
  const limit = { seconds: 0.5, statementMs: 500, queryMs: 500 }

  await recordMigration(client, { file: "001_o'brien.sql", table: '_migrations', row: { filename: "001_o'brien.sql" }, limit })
  await recordMigration(client, { file: '001_core.sql', table: '_migrations', row: { filename: '001_core.sql' }, limit: null })

  assert.deepEqual(sent, [
    {
      text: `SET LOCAL statement_timeout = ${RECORD_WAIT_MS}; SET LOCAL lock_timeout = 0; INSERT INTO "_migrations" ("filename") VALUES ('001_o''brien.sql')`,
      query_timeout: RECORD_WAIT_MS,
    },
    `INSERT INTO "_migrations" ("filename") VALUES ('001_core.sql')`,
  ])
})

test('a record the server never answers is given up on at its own wait, and said to be unrecorded', { timeout: 20000 }, async t => {
  const server = await standInPostgres(t, sql => (recordOf('_migrations').test(sql) ? 'silent' : 'ok'))
  const limit = migrationTimeLimit({ MIGRATION_TIMEOUT_SECONDS: '5' })
  const client = migrationClient(server.url, limit)
  await client.connect()
  t.after(() => client.end())

  const startedAt = Date.now()
  await assert.rejects(
    recordMigration(client, { file: '001_core.sql', table: '_migrations', row: { filename: '001_core.sql' }, limit, waitMs: 300 }),
    (error: Error) => {
      assert.ok(error instanceof MigrationNotRecordedError)
      assert.match(
        error.message,
        /^001_core\.sql ran to the end, but recording it as run in "_migrations" got no answer within 0\.3 s, so it may or may not be recorded\. .*Record it before running the migrations again: INSERT INTO "_migrations" \("filename"\) VALUES \('001_core\.sql'\) ON CONFLICT DO NOTHING;$/
      )
      return true
    }
  )
  const waitedMs = Date.now() - startedAt
  assert.ok(waitedMs >= 290 && waitedMs < 5000, `waited ${waitedMs} ms`)
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
