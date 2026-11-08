/**
 * The optional pg-boss worker (#275) against a real PostgreSQL: it creates its schema, runs a declared job, retries
 * with backoff, fires a cron schedule and finishes the running job on SIGTERM. Skipped where initdb is missing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { PgBoss } from 'pg-boss'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'
import { resolveJobsConfig } from '../../src/lib/jobs/config'
import { startJobsWorker } from '../../src/lib/jobs/worker'
import type { JobsConfig } from '../../src/lib/jobs/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function until<T>(what: string, check: () => T | undefined | Promise<T | undefined>, ms = 30000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await sleep(100)
  }
}

test('resolveJobsConfig: off unless enabled, and says what is wrong', () => {
  assert.throws(() => resolveJobsConfig(undefined), /jobs\.enabled/)
  assert.throws(() => resolveJobsConfig({ queues: { a: {} } }), /jobs\.enabled/)
  assert.throws(() => resolveJobsConfig({ enabled: true, queues: { 'teams:purge': {} } }), /queue name can only hold/)
  assert.throws(() => resolveJobsConfig({ enabled: true, queues: { a: { retryLimit: -1 } } }), /retryLimit/)
  assert.throws(() => resolveJobsConfig({ enabled: true, queues: { a: {} }, schedules: [{ queue: 'b', cron: '* * * * *' }] }), /not declared/)
  assert.throws(() => resolveJobsConfig({ enabled: true, queues: { a: {} }, schedules: [{ queue: 'a', cron: '* * *' }] }), /five-field/)
  const ok = resolveJobsConfig({ enabled: true, queues: { 'purge-teams': { handler: 'teams:purge-deleted' } } })
  assert.equal(ok.queues[0].handler, 'teams:purge-deleted')
  assert.equal(ok.queues[0].retryLimit, 2)
  assert.equal(ok.schema, 'pgboss')
})

test('the jobs worker against a real PostgreSQL', { skip: !HAS_POSTGRES, timeout: 240000 }, async (t) => {
  const cluster = await startCluster('jobs-worker-pg')
  t.after(() => cluster.stop())
  const url = (user: string) => `postgresql://${user}@127.0.0.1:${cluster.port}/postgres?sslmode=disable`
  const owner = new pg.Client({ connectionString: url('owner') })
  owner.on('error', () => {})
  await owner.connect()
  t.after(() => owner.end())
  // the role the app runs as: it cannot create schemas
  await owner.query('CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS')
  const jobState = async (name: string) => (await owner.query(`SELECT state FROM pgboss.job WHERE name = $1`, [name])).rows.map(r => r.state as string)

  const sender = new PgBoss({ connectionString: url('owner') })
  sender.on('error', () => {})
  await sender.start()
  t.after(() => sender.stop({ graceful: false }))

  const calls: Record<string, Array<{ at: number; payload: unknown; action: { actionType: string; attempts: number; teamId: string | null } }>> = {}
  const failTimes: Record<string, number> = {}
  const handlers = (name: string) => {
    if (!name.startsWith('test:')) return undefined
    return {
      name,
      handler: async (payload: unknown, action: { actionType: string; attempts: number; teamId: string | null }) => {
        ;(calls[name] ??= []).push({ at: Date.now(), payload, action })
        if (calls[name].length <= (failTimes[name] ?? 0)) throw new Error(`${name} fails on purpose`)
      },
    }
  }
  const quiet = () => {}
  const config: JobsConfig = {
    enabled: true,
    shutdownTimeout: 10,
    queues: {
      hello: { handler: 'test:hello' },
      flaky: { handler: 'test:flaky', retryLimit: 2, retryDelay: 1, retryBackoff: true },
      ticker: { handler: 'test:ticker' },
    },
    schedules: [{ queue: 'ticker', cron: '* * * * *', data: { from: 'cron' } }],
  }
  failTimes['test:flaky'] = 2

  const worker = await startJobsWorker({ connectionString: url('owner'), ssl: false, config, getHandler: handlers, log: quiet })
  t.after(() => worker.stop())

  await t.test('creates its schema and runs a declared job with the Scheduled Actions handler', async () => {
    const schema = await owner.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss'`)
    assert.equal(schema.rowCount, 1, 'the pgboss schema exists')

    await sender.send('hello', { teamId: 'team-1', n: 7 })
    const call = await until('the hello job', () => calls['test:hello']?.[0])
    assert.deepEqual(call.payload, { teamId: 'team-1', n: 7 })
    assert.equal(call.action.actionType, 'test:hello')
    assert.equal(call.action.teamId, 'team-1')
    await until('the job completed', async () => ((await jobState('hello')).includes('completed') ? true : undefined))
  })

  await t.test('retries a failing job with backoff, then completes it', async () => {
    await sender.send('flaky', { x: 1 })
    await until('three attempts', () => (calls['test:flaky']?.length === 3 ? true : undefined))
    const [first, second, third] = calls['test:flaky']
    assert.deepEqual([first.action.attempts, second.action.attempts, third.action.attempts], [1, 2, 3])
    assert.ok(second.at - first.at >= 900, `waited ${second.at - first.at} ms before the first retry`)
    assert.ok(third.at - second.at >= 1900, `backoff grew: ${third.at - second.at} ms before the second retry`)
    await until('the job completed', async () => ((await jobState('flaky')).includes('completed') ? true : undefined))
  })

  await t.test('a job that keeps failing is marked failed once the retries are used', async () => {
    failTimes['test:hello'] = 99
    const before = calls['test:hello'].length
    await sender.send('hello', { fail: true }, { retryLimit: 0 })
    await until('the failing job', async () => ((await jobState('hello')).includes('failed') ? true : undefined))
    assert.equal(calls['test:hello'].length, before + 1, 'no retry with retryLimit 0')
    failTimes['test:hello'] = 0
  })

  await t.test('a schedule the config no longer declares stops firing', async () => {
    const other = await startJobsWorker({
      connectionString: url('owner'), ssl: false, getHandler: handlers, log: quiet,
      config: { ...config, schedules: [] },
    })
    const rows = await owner.query(`SELECT count(*)::int AS n FROM pgboss.schedule`)
    assert.equal(rows.rows[0].n, 0)
    await other.stop()
  })

  await t.test('executes a cron schedule', { timeout: 180000 }, async () => {
    // schedules are per config: bring the declared one back
    const again = await startJobsWorker({ connectionString: url('owner'), ssl: false, config, getHandler: handlers, log: quiet })
    t.after(() => again.stop())
    const call = await until('the cron job', () => calls['test:ticker']?.[0], 150000)
    assert.deepEqual(call.payload, { from: 'cron' })
  })
})

test('SIGTERM finishes the running job before the worker exits', { skip: !HAS_POSTGRES, timeout: 120000 }, async (t) => {
  const cluster = await startCluster('jobs-worker-sigterm')
  t.after(() => cluster.stop())
  const url = (user: string) => `postgresql://${user}@127.0.0.1:${cluster.port}/postgres?sslmode=disable`
  const owner = new pg.Client({ connectionString: url('owner') })
  owner.on('error', () => {})
  await owner.connect()
  t.after(() => owner.end())
  await owner.query('CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS')

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-sigterm-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const marks = path.join(dir, 'marks')
  const read = () => (fs.existsSync(marks) ? fs.readFileSync(marks, 'utf8').trim().split('\n') : [])

  const child = spawn(process.execPath, ['--import', 'tsx', path.join(HERE, 'fixtures', 'jobs-worker-child.ts')], {
    env: { ...process.env, DATABASE_URL: url('app_login'), MIGRATE_DATABASE_URL: url('owner'), JOBS_TEST_MARKS: marks },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', d => (output += d))
  child.stderr.on('data', d => (output += d))
  const exited = new Promise<number | null>(resolve => child.on('exit', resolve))
  t.after(() => child.kill('SIGKILL'))

  await until('the worker to start', () => (read().includes('ready') ? true : undefined), 60000)
  const sender = new PgBoss({ connectionString: url('owner') })
  sender.on('error', () => {})
  await sender.start()
  t.after(() => sender.stop({ graceful: false }))
  await sender.send('slow', {})
  await until('the job to start', () => (read().includes('started') ? true : undefined))

  child.kill('SIGTERM')
  const code = await exited
  assert.deepEqual(read().filter(m => m !== 'ready'), ['started', 'done:app_login'], `the job ran to its end as the app role.\n${output}`)
  assert.equal(code, 0, `exit code. ${output}`)
  const states = (await owner.query(`SELECT state FROM pgboss.job WHERE name = 'slow'`)).rows.map(r => r.state)
  assert.deepEqual(states, ['completed'], 'the job is completed, not lost or left active')
})

test('pg-boss stays out of the app and of Scheduled Actions', () => {
  const core = path.resolve(HERE, '../..')
  const pkg = JSON.parse(fs.readFileSync(path.join(core, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies?.['pg-boss'], undefined, 'not a dependency of core')
  assert.equal(pkg.peerDependenciesMeta['pg-boss'].optional, true, 'an optional peer')

  const readTree = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? readTree(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  const mentions = [...readTree(path.join(core, 'src')), ...readTree(path.join(core, 'scripts'))]
    .filter(f => /\.(ts|tsx|mjs)$/.test(f) && !f.includes(`${path.sep}lib${path.sep}jobs${path.sep}`))
    .filter(f => /pg-boss|lib\/jobs|from '\.\.?\/(\.\.\/)*jobs/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(core, f))
  assert.deepEqual(mentions, ['src/lib/config/types.ts'], 'only the config type reaches into jobs (type import)')
})
