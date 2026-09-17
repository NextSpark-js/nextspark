/**
 * Runs one step of update-core (pnpm install, nextspark sync:app) and kills it
 * if update-core goes away before it is done with the step, however
 * update-core ended.
 *
 * Usage: node step-guard.mjs <command> [args...], started by update-core with
 * an IPC channel.
 *
 * The step runs in a process group of its own, which also holds the lifecycle
 * scripts pnpm install starts. It starts as a shell that waits for this process
 * to write "go" on a pipe, and only then runs the command in its own place, so
 * the command's pid is the shell's. This process sends update-core that pid,
 * which is the group's id, and opens the gate once update-core answers
 * 'start': the command never runs in a group update-core can't reach. If this
 * process dies before opening it, the pipe closes and the shell exits without
 * running the command. It then sends how the step exited, and stays until
 * update-core sends 'release'. update-core stops the group itself when a run
 * is interrupted or a step fails. Its end of the channel closes whenever it
 * exits, including when it is killed with SIGKILL, which it can't catch: if
 * that happens before 'release', this process kills the whole group. A process
 * that is stopped (SIGSTOP) runs none of this until it is continued.
 *
 * Windows has neither process groups nor the shell, so there the command starts
 * right away, without the gate.
 */

import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

const windows = process.platform === 'win32'
const [command, ...args] = process.argv.slice(2)

/** Reads "go" from fd 3, closes it so the command doesn't inherit it, and becomes the command */
const GATE = 'IFS= read -r go <&3 && [ "$go" = go ] || exit 125; exec 3<&-; exec "$@"'

// Signals are update-core's to handle: it passes them on to the step's group
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {})

const step = windows
  ? spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], shell: !path.isAbsolute(command) })
  : spawn('/bin/sh', ['-c', GATE, 'update-core-step', command, ...args], { stdio: ['ignore', 'inherit', 'inherit', 'pipe'], detached: true })
const gate = windows ? null : step.stdio[3]
// EPIPE: the group was stopped before the gate opened
gate?.on('error', () => {})

let released = false
process.on('message', (message) => {
  if (message === 'start') {
    gate?.end('go\n')
  } else if (message === 'release') {
    released = true
    process.exit(0)
  }
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
