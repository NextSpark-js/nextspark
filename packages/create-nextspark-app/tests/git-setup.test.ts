import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { setupGitRepository, INITIAL_COMMIT_MESSAGE } from '../src/utils/git.js'

const identity = {
  GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com',
}

function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cna-git-'))
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

function withEnv<T>(env: Record<string, string>, fn: () => T): T {
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]))
  Object.assign(process.env, env)
  try { return fn() } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

const runGit = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim()
const base = { 'package.json': '{}', 'pnpm-lock.yaml': 'lock', '.gitignore': 'node_modules/\n.env\n', 'node_modules/x/index.js': '', '.env': 'SECRET=1' }

test('commits the lockfile and respects .gitignore', () => {
  const dir = project(base)
  const result = withEnv(identity, () => setupGitRepository(dir))
  assert.equal(result.status, 'committed')
  assert.equal(runGit(dir, 'log', '-1', '--format=%s'), INITIAL_COMMIT_MESSAGE)
  const tracked = runGit(dir, 'ls-files').split('\n')
  assert.ok(tracked.includes('pnpm-lock.yaml'))
  assert.ok(!tracked.some(f => f.startsWith('node_modules') || f === '.env'))
})

test('skips a directory already inside a repository', () => {
  const outer = project({})
  runGit(outer, 'init')
  const dir = path.join(outer, 'app')
  fs.mkdirSync(dir)
  const result = withEnv(identity, () => setupGitRepository(dir))
  assert.equal(result.status, 'skipped')
  assert.ok(!fs.existsSync(path.join(dir, '.git')))
})

test('leaves the repository initialized when the commit fails for lack of identity', () => {
  const dir = project(base)
  const result = withEnv({
    GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.useConfigOnly', GIT_CONFIG_VALUE_0: 'true',
  }, () => setupGitRepository(dir))
  assert.equal(result.status, 'initialized')
  assert.ok(fs.existsSync(path.join(dir, '.git')))
})

test('does not commit when there is no .gitignore', () => {
  const dir = project({ 'package.json': '{}' })
  const result = withEnv(identity, () => setupGitRepository(dir))
  assert.equal(result.status, 'initialized')
  assert.ok(fs.existsSync(path.join(dir, '.git')))
})
