/**
 * A throwaway PostgreSQL cluster for the tests that need a real server (#402). Every suite that starts one goes
 * through here, so the startup is the same everywhere:
 *
 * - the port is picked just before the server binds it, and a bind conflict (another process took it in between)
 *   is retried on a new port instead of failing the suite;
 * - pg_ctl waits long enough for a loaded machine (the default 60 s is not enough when several suites start at once);
 * - a cluster that cannot start throws an error that carries initdb's or the server's own log, instead of a bare
 *   "command failed" that every test in the suite then repeats;
 * - whatever was created is removed when the start fails, and `stop()` always removes it.
 *
 * It uses nothing from jest or node:test, so jest and tsx suites share it.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

const START_TIMEOUT_SECONDS = 90
const START_ATTEMPTS = 5
// what the server logs when its port or its socket file is taken
const PORT_CONFLICT = /Address already in use|could not bind|could not create lock file|lock file ".*" already exists/i

export async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

export interface ThrowawayCluster {
  dir: string
  data: string
  port: number
  /** Stops the server (even if it is half started) and removes the directory. Safe to call twice. */
  stop(): void
}

export interface ClusterOptions {
  /** Called once the data directory exists and before the server starts; returns more server options (`-c ssl=on`). */
  prepare?(dir: string, data: string): string
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: START_TIMEOUT_SECONDS * 1000 + 30000 })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`.trim() }
}

function readLog(file: string) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split('\n').slice(-40).join('\n')
  } catch {
    return '(no server log)'
  }
}

/** Starts a cluster in a new temporary directory named after `prefix`; the caller owns `stop()`. */
export async function startCluster(prefix: string, { prepare }: ClusterOptions = {}): Promise<ThrowawayCluster> {
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
    const failures: string[] = []
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
