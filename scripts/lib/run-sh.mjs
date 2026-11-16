// Runs a shell script with its arguments: `node scripts/lib/run-sh.mjs <script.sh> [args...]`.
// Outside Windows the script runs directly (its shebang picks bash). On
// Windows `bash` on PATH is usually WSL's System32\bash.exe, which runs the
// script inside Linux, so Git for Windows' bash is looked up instead.
import { spawn } from 'node:child_process'
import { constants as osConstants } from 'node:os'
import { resolve } from 'node:path'
import { findGitBash } from './find-git-bash.mjs'

const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('Usage: node scripts/lib/run-sh.mjs <script.sh> [args...]')
  process.exit(2)
}
const bash = findGitBash()
if (process.platform === 'win32' && !bash) {
  console.error('Git Bash was not found. Install Git for Windows (https://git-scm.com/download/win) and run this again.')
  process.exit(1)
}
const child = bash
  ? spawn(bash, [script, ...args], { stdio: 'inherit' })
  : spawn(resolve(script), args, { stdio: 'inherit' })
child.on('error', (e) => { console.error(e.message); process.exit(1) })
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    // Node ignores some signals (SIGPIPE), so the kill above may do nothing.
    process.exit(128 + (osConstants.signals[signal] ?? 1))
  }
  process.exit(code ?? 1)
})
