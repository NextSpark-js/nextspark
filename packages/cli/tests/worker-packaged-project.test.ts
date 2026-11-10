/**
 * `nextspark worker` from a project generated from the packed tarballs (#275), not from the monorepo: the project's
 * `.ts` files load as CommonJS, `server-only` is not a dependency it lists and the registries are only the generated
 * `.nextspark/registries`. Needs that project, so it runs only when NEXTSPARK_PACKED_PROJECT names one:
 *
 *   ./scripts/packages/pack.sh --all --output <dir>/.packages, then create-nextspark-app with those tarballs,
 *   `pnpm add pg-boss` in the project, in config/app.config.ts
 *   jobs: { enabled: true, shutdownTimeout: 10, queues: { ping: { handler: 'worker-check:ping' } } }
 *   and a lib/scheduled-actions/index.ts that imports core, the documented form, and registers the handler:
 *   registerScheduledAction('worker-check:ping', async () => { console.log('[worker-check] ping handled') })
 *
 * The test starts its own PostgreSQL cluster (initdb on the PATH), migrates it with the project's CLI, runs the worker
 * the installed CLI (`nextspark worker`), directly so SIGTERM reaches it, enqueues a job and sends SIGTERM.
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'

import { HAS_POSTGRES, startCluster } from '../../core/tests/support/throwaway-postgres.js'

const project = process.env.NEXTSPARK_PACKED_PROJECT

test('the worker runs from a project generated from the packed tarballs', { skip: !project || !HAS_POSTGRES, timeout: 240000 }, async (t) => {
  const cluster = await startCluster('worker-packed-pg')
  t.after(() => cluster.stop())
  const url = (user: string) => `postgresql://${user}@127.0.0.1:${cluster.port}/postgres?sslmode=disable`
  const run = (cmd: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync(cmd, args, { cwd: project, env: { ...process.env, ...env }, encoding: 'utf8' })

  const migrated = run('pnpm', ['exec', 'nextspark', 'db:migrate', '--no-env-file'], { DATABASE_URL: url('owner'), MIGRATE_DATABASE_URL: url('owner') })
  assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr)
  const role = spawnSync('psql', [url('owner'), '-c', 'CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS INHERIT IN ROLE nextspark_app'], { encoding: 'utf8' })
  assert.equal(role.status, 0, role.stderr)
  const prepared = run('pnpm', ['exec', 'nextspark', 'prepare'])
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr)

  const cli = join(project!, 'node_modules', '@nextsparkjs', 'cli', 'dist', 'cli.js')
  const child = spawn(process.execPath, [cli, 'worker'], {
    cwd: project,
    env: { ...process.env, DATABASE_URL: url('app_login'), MIGRATE_DATABASE_URL: url('owner') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', d => (output += d))
  child.stderr.on('data', d => (output += d))
  const exited = new Promise<number | null>(resolve => child.on('exit', resolve))
  t.after(() => child.kill('SIGKILL'))
  let dead = false
  void exited.then(() => (dead = true))
  const until = async (what: string, pattern: RegExp, ms = 90000) => {
    for (const end = Date.now() + ms; !pattern.test(output); await new Promise(r => setTimeout(r, 200))) {
      if (dead && !pattern.test(output)) throw new Error(`The worker exited while waiting for ${what}.\n${output}`)
      if (Date.now() > end) throw new Error(`Timed out waiting for ${what}.\n${output}`)
    }
  }

  await until('the worker to start', /\[Jobs\] started: 1 queue/)

  const sent = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { PgBoss } from 'pg-boss'
    const boss = new PgBoss(${JSON.stringify(url('owner'))})
    boss.on('error', () => {})
    await boss.start()
    await boss.send('ping', {})
    await boss.stop({ graceful: false })
  `], { cwd: project, encoding: 'utf8' })
  assert.equal(sent.status, 0, sent.stderr)
  await until('the job to run', /\[worker-check\] ping handled/, 30000)

  child.kill('SIGTERM')
  assert.equal(await exited, 0, output)
})
