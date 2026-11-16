// Runs a shell script with its arguments: `node scripts/lib/run-sh.mjs <script.sh> [args...]`.
// Outside Windows the script runs directly (its shebang picks bash). On
// Windows `bash` on PATH is usually WSL's System32\bash.exe, which runs the
// script inside Linux, so Git for Windows' bash is looked up instead.
import { spawn, execFileSync as realExecFileSync } from 'node:child_process'
import { existsSync as realExistsSync } from 'node:fs'
import { win32 as winPath, resolve } from 'node:path'
const { dirname, join } = winPath
import { fileURLToPath } from 'node:url'

export function findGitBash({
  platform = process.platform,
  env = process.env,
  existsSync = realExistsSync,
  execFileSync = realExecFileSync,
} = {}) {
  if (platform !== 'win32') return null
  const candidates = []
  const run = (cmd, args) => {
    try {
      return String(execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
        .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    } catch { return [] }
  }
  // git-core is <root>/mingw64/libexec/git-core; a git.exe is <root>/{cmd,bin,mingw64/bin}/git.exe.
  const fromGit = (root) => candidates.push(join(root, 'bin', 'bash.exe'), join(root, 'usr', 'bin', 'bash.exe'))
  for (const p of run('git', ['--exec-path'])) fromGit(winPath.resolve(p, '..', '..', '..'))
  for (const p of run('where', ['git'])) {
    const up = winPath.resolve(dirname(p), '..')
    fromGit(up)
    fromGit(winPath.resolve(up, '..'))
  }
  for (const base of [env.ProgramFiles, env['ProgramFiles(x86)']]) {
    if (base) candidates.push(join(base, 'Git', 'bin', 'bash.exe'))
  }
  // Never WSL's launcher.
  return candidates.find((c) => !/[\\/]system32[\\/]/i.test(c) && existsSync(c)) ?? null
}

function main() {
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
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 1)
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
