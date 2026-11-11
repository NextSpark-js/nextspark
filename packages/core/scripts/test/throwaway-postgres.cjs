'use strict'
/**
 * A throwaway PostgreSQL cluster for the tests that need a real server (#402, #430). Core's own suites and the
 * database suites of a project start theirs through here, so the startup is the same everywhere:
 *
 * - the port is picked just before the server binds it, and a bind conflict (another process took it in between)
 *   is retried on a new port instead of failing the suite;
 * - pg_ctl waits long enough for a loaded machine (the default 60 s is not enough when several suites start at once);
 * - a cluster that cannot start throws an error that carries initdb's or the server's own log, instead of a bare
 *   "command failed" that every test in the suite then repeats;
 * - whatever was created is removed when the start fails, and `stop()` always removes it.
 *
 * It needs `initdb` and `pg_ctl` on the PATH (`HAS_POSTGRES`), uses nothing from jest or node:test, and is plain
 * CommonJS, so jest, node:test and ESM scripts load it the same way:
 *
 *   const { startCluster, clusterUrl } = require('@nextsparkjs/core/scripts/test/throwaway-postgres.cjs')
 *   const cluster = await startCluster('my-suite')
 *   const url = clusterUrl(cluster)   // postgresql://owner@127.0.0.1:<port>/postgres?sslmode=disable
 *   ...
 *   cluster.stop()
 *
 * The cluster listens on 127.0.0.1 and in a socket directory of its own, trusts every local connection, and has one
 * superuser, `owner`.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

const START_TIMEOUT_SECONDS = 90
const START_ATTEMPTS = 5
// what the server logs when its port or its socket file is taken
const PORT_CONFLICT = /Address already in use|could not bind|could not create lock file|lock file ".*" already exists/i

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: START_TIMEOUT_SECONDS * 1000 + 30000 })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`.trim() }
}

function readLog(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split('\n').slice(-40).join('\n')
  } catch {
    return '(no server log)'
  }
}

/**
 * Starts a cluster in a new temporary directory named after `prefix`; the caller owns `stop()`.
 * `options.prepare(dir, data)` runs once the data directory exists and before the server starts; it returns more
 * server options (`-c ssl=on`).
 */
async function startCluster(prefix, { prepare } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
  const data = path.join(dir, 'data')
  const log = path.join(dir, 'log')
  const stopServer = () => spawnSync('pg_ctl', ['-D', data, 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
  const stop = () => {
    stopServer()
    fs.rmSync(dir, { recursive: true, force: true })
  }
  try {
    const init = run('initdb', ['-D', data, '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'])
    if (!init.ok) throw new Error(`initdb failed:\n${init.output}`)
    const extra = prepare?.(dir, data) ?? ''
    const failures = []
    for (let attempt = 1; attempt <= START_ATTEMPTS; attempt++) {
      const port = await freePort()
      fs.rmSync(log, { force: true })
      const start = run('pg_ctl', ['-D', data, '-l', log, '-t', String(START_TIMEOUT_SECONDS), '-o', `-h 127.0.0.1 -p ${port} -k ${dir} ${extra}`, 'start', '-w'])
      if (start.ok) return { dir, data, port, stop }
      const serverLog = readLog(log)
      failures.push(`attempt ${attempt} on port ${port}:\n${start.output}\n${serverLog}`)
      stopServer()
      if (!PORT_CONFLICT.test(serverLog)) break
    }
    throw new Error(`The throwaway PostgreSQL cluster did not start.\n${failures.join('\n')}`)
  } catch (error) {
    stop()
    throw error
  }
}

/** The connection URL of a database of the cluster (the default `postgres`), as the owner, with SSL off. */
function clusterUrl(cluster, database = 'postgres') {
  return `postgresql://owner@127.0.0.1:${cluster.port}/${encodeURIComponent(database)}?sslmode=disable`
}

module.exports = { HAS_POSTGRES, freePort, startCluster, clusterUrl }
