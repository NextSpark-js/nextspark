/**
 * Runs one step of update-core (pnpm install, nextspark sync:app) and kills it
 * if update-core goes away before it is done with the step, however
 * update-core ended.
 *
 * Usage: node step-guard.mjs <command> [args...], started by update-core with
 * an IPC channel.
 *
 * The step runs in a process group of its own, which also holds the lifecycle
 * scripts pnpm install starts. This process sends update-core the step's pid,
 * which is that group's id, and then how the step exited, and stays until
 * update-core sends 'release'. update-core stops the group itself when a run
 * is interrupted or a step fails. Its end of the channel closes whenever it
 * exits, including when it is killed with SIGKILL, which it can't catch: if
 * that happens before 'release', this process kills the whole group.
 */

import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

const windows = process.platform === 'win32'
const [command, ...args] = process.argv.slice(2)

// Signals are update-core's to handle: it passes them on to the step's group
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {})

const step = spawn(command, args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: !windows,
  shell: windows && !path.isAbsolute(command),
})

let released = false
process.on('message', (message) => {
  if (message !== 'release') return
  released = true
  process.exit(0)
})
process.on('disconnect', () => {
  if (released) return
  if (step.pid) {
    if (windows) {
      // Windows has no process groups: taskkill /T ends the step's process tree
      spawnSync('taskkill', ['/pid', String(step.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 })
    } else {
      try {
        process.kill(-step.pid, 'SIGKILL')
      } catch {
        // ESRCH: nothing left in the group
      }
    }
  }
  process.exit(1)
})

if (step.pid) process.send({ pid: step.pid })
step.once('error', (error) => process.send({ error: { code: error.code, message: error.message } }))
step.once('exit', (code, signal) => process.send({ exit: { code, signal } }))
