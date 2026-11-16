import { test } from 'node:test'
import assert from 'node:assert/strict'
import { win32 } from 'node:path'
const join = win32.join
import { findGitBash } from './run-sh.mjs'

const GIT_CORE = 'C:\\Program Files\\Git\\mingw64\\libexec\\git-core'
const WSL = 'C:\\Windows\\System32\\bash.exe'

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

test('on win32 never picks the System32 (WSL) bash, and returns null when Git Bash is absent', () => {
  const asked = []
  const bash = findGitBash({
    platform: 'win32',
    env: { ProgramFiles: 'C:\\Windows\\System32\\..' },
    execFileSync: (cmd) => (cmd === 'git' ? 'C:\\Windows\\System32\\libexec\\x' : WSL),
    existsSync: (p) => { asked.push(p); return /system32/i.test(p) },
  })
  assert.equal(bash, null)
  assert.ok(!asked.some((p) => /system32/i.test(p)))
})
