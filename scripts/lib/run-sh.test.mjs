import { test } from 'node:test'
import assert from 'node:assert/strict'
import { win32 } from 'node:path'
import { join as pjoin } from 'node:path'
import { mkdtempSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { findGitBash } from './find-git-bash.mjs'

const join = win32.join
const GIT_CORE = 'C:\\Program Files\\Git\\mingw64\\libexec\\git-core'

test('outside win32 no bash is looked up and nothing is executed', () => {
  const calls = []
  const bash = findGitBash({
    platform: 'darwin',
    existsSync: () => { calls.push('exists'); return true },
    execFileSync: () => { calls.push('exec'); return '' },
  })
  assert.equal(bash, null)
  assert.deepEqual(calls, [])
})

test('on win32 bash comes from git --exec-path', () => {
  const want = join('C:\\Program Files\\Git', 'bin', 'bash.exe')
  const bash = findGitBash({
    platform: 'win32',
    env: {},
    execFileSync: (cmd) => (cmd === 'git' ? GIT_CORE : ''),
    existsSync: (p) => p === want,
  })
  assert.equal(bash, want)
})

test('on win32 bash comes from where git when --exec-path fails', () => {
  const want = join('D:\\Git', 'bin', 'bash.exe')
  const bash = findGitBash({
    platform: 'win32',
    env: {},
    execFileSync: (cmd) => { if (cmd === 'git') throw new Error('no'); return 'D:\\Git\\cmd\\git.exe\r\n' },
    existsSync: (p) => p === want,
  })
  assert.equal(bash, want)
})

test('on win32 falls back to ProgramFiles', () => {
  const want = join('E:\\PF', 'Git', 'bin', 'bash.exe')
  const bash = findGitBash({
    platform: 'win32',
    env: { ProgramFiles: 'E:\\PF' },
    execFileSync: () => { throw new Error('no') },
    existsSync: (p) => p === want,
  })
  assert.equal(bash, want)
})

test('on win32 never picks a System32 (WSL) bash, even one that exists', () => {
  const bash = findGitBash({
    platform: 'win32',
    env: { ProgramFiles: 'C:\\Windows\\System32' },
    execFileSync: () => { throw new Error('no') },
    existsSync: () => true,
  })
  assert.equal(bash, null)
})

test('the launcher runs the script through a symlink and propagates its exit code', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(pjoin(tmpdir(), 'run-sh-'))
  try {
    const link = pjoin(dir, 'link.mjs')
    symlinkSync(fileURLToPath(new URL('./run-sh.mjs', import.meta.url)), link)
    const sh = pjoin(dir, 'x.sh')
    writeFileSync(sh, '#!/bin/bash\necho "args:$1"\nexit 7\n', { mode: 0o755 })
    const r = spawnSync(process.execPath, [link, sh, 'a b'], { encoding: 'utf8' })
    assert.equal(r.status, 7)
    assert.match(r.stdout, /args:a b/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the launcher exits 128+N when the script dies of a signal Node ignores (SIGPIPE)', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(pjoin(tmpdir(), 'run-sh-'))
  try {
    const sh = pjoin(dir, 'x.sh')
    writeFileSync(sh, '#!/bin/bash\nkill -PIPE $$\nsleep 5\n', { mode: 0o755 })
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./run-sh.mjs', import.meta.url)), sh], { encoding: 'utf8' })
    assert.equal(r.status, 141)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
