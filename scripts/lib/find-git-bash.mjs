// Looks for Git for Windows' bash; WSL's System32\bash.exe is never a candidate.
import { execFileSync as realExecFileSync } from 'node:child_process'
import { existsSync as realExistsSync } from 'node:fs'
import { win32 as winPath } from 'node:path'
const { dirname, join } = winPath

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
