#!/usr/bin/env node
/**
 * Run the current root-first project's Jest suite.
 *
 * `--selectProjects db` runs the project named `db` against a database of its own (#430): a throwaway PostgreSQL
 * cluster that the runner starts, applies the project's migrations to (no sample data) and removes afterwards, handed to
 * the suites as DATABASE_URL. The DATABASE_URL of the environment or the .env is not used for it. NEXTSPARK_TEST_DATABASE_URL
 * names a database to use instead, which has to be on this machine unless NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE=1;
 * the runner writes nothing to that one before the suites do. See test-database.mjs.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import throwaway from './throwaway-postgres.cjs'
import { resolveProjectPaths } from '../build/registry/project-mode.mjs'
import { describeDestination } from '../db/destination.mjs'
import { selectsDatabaseProject, testDatabaseTarget, isOn, DATABASE_PROJECT, TEST_DATABASE_URL, ALLOW_REMOTE_DATABASE } from './test-database.mjs'

const { HAS_POSTGRES, startCluster, clusterUrl } = throwaway
const { projectRoot } = resolveProjectPaths(process.cwd())
const candidates = ['tests/jest/jest.config.ts', 'tests/jest/jest.config.cjs', 'jest.config.ts', 'jest.config.cjs']
const configPath = candidates.find(candidate => existsSync(join(projectRoot, candidate)))
if (!configPath) {
  console.error('Error: Jest config not found in the project tests directory.')
  process.exit(1)
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Jest Project Runner')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  Config: ${configPath}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const jestArgs = process.argv.slice(2)
const env = { ...process.env }
let cluster = null
let child = null
let signaled = null
// The cluster is removed however the runner ends, an uncaught error and a signal included
process.on('exit', () => cluster?.stop())

function stopWith(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

if (selectsDatabaseProject(jestArgs)) {
  // MIGRATE_DATABASE_URL names the owner connection of a database that is not this one
  delete env.MIGRATE_DATABASE_URL
  let target
  try {
    target = testDatabaseTarget(process.env)
  } catch (error) {
    stopWith(error.message)
  }
  if (process.env.DATABASE_URL) {
    console.log(`  The DATABASE_URL of the environment is not used by the ${DATABASE_PROJECT} project; ${TEST_DATABASE_URL} names the database it uses instead.`)
  }
  if (target.url) {
    env.DATABASE_URL = target.url
    const remote = isOn(process.env[ALLOW_REMOTE_DATABASE])
    console.log(`  The ${DATABASE_PROJECT} project runs against ${describeDestination(target.url)} (${TEST_DATABASE_URL}${remote ? `, ${ALLOW_REMOTE_DATABASE} is set` : ''}).\n`)
  } else {
    if (!HAS_POSTGRES) {
      stopWith(`the ${DATABASE_PROJECT} project starts a throwaway PostgreSQL cluster, and initdb and pg_ctl are not on the PATH. ` +
        `Put the PostgreSQL binaries on the PATH (for example /opt/homebrew/opt/postgresql@16/bin), or set ${TEST_DATABASE_URL} to a database on this machine.`)
    }
    // From here on a signal must not end the runner before it removes the cluster, also while migrations run
    // (spawnSync holds the event loop, so the handler only records it; the migrations end with the same signal
    // when it comes from the terminal): the runner stops after them, and the exit handler removes the cluster.
    // Once Jest runs, the signal goes to it and the cluster goes when it ends.
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.on(signal, () => {
        signaled = signal
        child?.kill(signal)
      })
    }
    try {
      cluster = await startCluster('nextspark-test-db')
    } catch (error) {
      stopWith(`the throwaway PostgreSQL cluster for the ${DATABASE_PROJECT} project did not start.\n${error.message}`)
    }
    if (signaled) process.exit(1)
    env.DATABASE_URL = clusterUrl(cluster)
    console.log(`  The ${DATABASE_PROJECT} project runs against a throwaway PostgreSQL cluster (host 127.0.0.1, port ${cluster.port}), removed when the run ends.`)
    console.log('  Applying the project migrations to it (no sample data)...')
    delete env.MIGRATION_TIMEOUT_SECONDS
    const migrate = spawnSync(process.execPath, [join(import.meta.dirname, '..', 'db', 'run-migrations.mjs'), '--no-env-file'], {
      cwd: projectRoot, env, encoding: 'utf8', timeout: 600000,
    })
    if (signaled) process.exit(1)
    if (migrate.status !== 0) {
      const output = `${migrate.stdout ?? ''}${migrate.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
      stopWith(`the migrations failed on the throwaway database:\n${output}`)
    }
    console.log('  Done.\n')
  }
}

child = spawn('pnpm', ['exec', 'jest', '--config', configPath, ...jestArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
})
if (signaled) child.kill(signaled)
child.on('error', error => {
  console.error(`Failed to start Jest: ${error.message}`)
  process.exit(1)
})
child.on('close', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
