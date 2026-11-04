import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { after, before, test } from 'node:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buildCli } from './built-cli.js'

// migrate asks git which files are ignored (#391): a long answer is still an answer, and a failed question is not "nothing is ignored"

let cliEntry: string
const roots: string[] = []
before(() => { cliEntry = buildCli() })
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })

const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const OLD_PROXY = "import { auth } from '@nextsparkjs/core/lib/auth'\nexport async function proxy() { return auth }\nexport const config = { matcher: ['/dashboard/:path*'] }\n"
const FACADE = "export { proxy } from '@nextsparkjs/core/proxy'\nexport const config = { matcher: ['/dashboard/:path*'] }\n"

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'project', private: true, dependencies: { next: '16.4.2', '@nextsparkjs/core': '0.1.0-beta.200' } }),
  'next.config.mjs': 'export default {}\n',
  'src/proxy.ts': FACADE,
  // a member manifest in an ignored directory is seen only if migrate forgets that the repository ignores it
  'bulk-cache/member/package.json': JSON.stringify({ name: 'ignored-member', dependencies: { '@nextsparkjs/core': '0.0.1' } }),
  'visible/member/package.json': JSON.stringify({ name: 'visible-member', dependencies: { '@nextsparkjs/core': '0.0.2' } }),
  '.gitignore': 'node_modules\nsrc/app\nbulk-cache/\n',
  'node_modules/@nextsparkjs/core/package.json': JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.200' }),
  'node_modules/@nextsparkjs/core/templates/proxy.ts': FACADE,
  'node_modules/@nextsparkjs/core/scripts/build/registry/host/previous-templates.json': JSON.stringify({ 'proxy.ts': [sha(OLD_PROXY)], 'instrumentation.ts': [] }),
}

/** A committed project (ignored files are not committed) with `bulk` ignored files laid under bulk-cache/. */
function project(bulk = 0): string {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-migrate-ignored-'))
  roots.push(root)
  for (const [file, content] of Object.entries(BASE)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git('init', '--quiet')
  git('config', 'user.email', 'fixture@example.test')
  git('config', 'user.name', 'Fixture')
  git('add', '.')
  git('commit', '--quiet', '-m', 'fixture')
  // 1000 per directory keeps the fixture quick to write; long names push git's answer past 1 MB
  for (let i = 0; i < bulk; i++) {
    const directory = join(root, 'bulk-cache', `group-${Math.floor(i / 1000)}`)
    if (i % 1000 === 0) mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, `generated-output-with-a-deliberately-long-file-name-${i}.txt`), '')
  }
  return root
}

function check(root: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [cliEntry, 'migrate', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_registry: 'http://127.0.0.1:9', pnpm_config_registry: 'http://127.0.0.1:9', ...env },
  })
}

const members = (stdout: string) => (JSON.parse(stdout) as { versions: { members: { path: string }[] } }).versions.members.map(member => member.path).sort()

test('ignored files are left alone when the answer is longer than 1 MB', () => {
  const root = project(60_000)
  const result = check(root)
  assert.equal(result.status, 0, `${result.stdout.slice(0, 500)}\n${result.stderr}`)
  assert.deepEqual(members(result.stdout), ['.', 'visible/member'], 'the ignored member manifest is not read')
})

test('an answer of "nothing is ignored" (exit 1) is not an error', () => {
  const root = project()
  writeFileSync(join(root, '.gitignore'), 'node_modules\n')
  const result = check(root)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.deepEqual(members(result.stdout), ['.', 'bulk-cache/member', 'visible/member'])
})

test('any other git failure stops migrate with a message instead of treating everything as unignored', () => {
  const root = project()
  const real = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
  const bin = mkdtempSync(join(tmpdir(), 'nextspark-fake-git-'))
  roots.push(bin)
  writeFileSync(join(bin, 'git'), `#!/bin/sh\nif [ "$1" = check-ignore ]; then echo 'fatal: fake failure' >&2; exit 2; fi\nexec "${real}" "$@"\n`)
  chmodSync(join(bin, 'git'), 0o755)
  const result = check(root, { PATH: `${bin}:${process.env.PATH}` })
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout.includes('obsoleteCopies'), false, result.stdout)
  assert.match(`${result.stdout}${result.stderr}`, /git check-ignore failed \(exit 2\): fatal: fake failure/)
})
