/**
 * Core's postinstall (#203) never writes into a project: since 0.1.0-beta.192 src/app is generated
 * by `nextspark prepare`, and `nextspark sync:app` (which the hook used to run) is gone. All the
 * hook may do is print a notice in a project that still carries a committed app tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const POSTINSTALL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/postinstall.mjs')

/** Every file under `root` with its content, to compare before and after. */
function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else files[path.relative(root, file)] = fs.readFileSync(file, 'utf8')
    }
  }
  walk(root)
  return files
}

function project(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-'))
  const write = (name: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    fs.writeFileSync(path.join(root, name), content)
  }
  write('package.json', JSON.stringify({ name: 'p', dependencies: { '@nextsparkjs/core': '0.1.0-beta.192', '@nextsparkjs/cli': '0.1.0-beta.192' } }))
  for (const [name, content] of Object.entries(files)) write(name, content)
  // What the package manager runs: from inside the installed package
  const installed = path.join(root, 'node_modules', '@nextsparkjs', 'core')
  fs.mkdirSync(installed, { recursive: true })
  // A CLI on the path: if the hook still ran it, it would leave a trace
  const bin = path.join(root, 'node_modules', '.bin')
  fs.mkdirSync(bin, { recursive: true })
  fs.writeFileSync(path.join(bin, 'nextspark'), `#!/bin/sh\necho "$@" > "${root}/cli-was-run.txt"\n`, { mode: 0o755 })
  const run = () => spawnSync(process.execPath, [POSTINSTALL], { cwd: installed, encoding: 'utf8', env: { ...process.env, NEXTSPARK_DEBUG: '' } })
  return { root, run }
}

test('a project with a committed src/app gets a notice and nothing is written or run', (t) => {
  const { root, run } = project({ 'src/app/page.tsx': 'export default function Page() { return null }\n' })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const before = snapshot(root)

  const result = run()

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /nextspark migrate/)
  assert.match(result.stdout, /Nothing was changed/)
  assert.deepEqual(snapshot(root), before)
  assert.equal(fs.existsSync(path.join(root, 'cli-was-run.txt')), false, 'the CLI must not be run')
})

test('a project with a pre-root-first app/ gets the same notice', (t) => {
  const { root, run } = project({ 'app/page.tsx': 'export default function Page() { return null }\n' })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const result = run()

  assert.match(result.stdout, /nextspark migrate/)
  assert.equal(fs.existsSync(path.join(root, 'cli-was-run.txt')), false)
})

const VALID_RECORD = JSON.stringify({ schemaVersion: 1, generator: 'nextspark prepare', mode: 'production', versions: {}, inputs: { hash: null, files: {} }, files: { 'src/app/page.tsx': 'hash' } })

test('a committed src/app next to an invalid or stale generation record still gets the notice', (t) => {
  for (const record of ['{"schema":999,"files":[]}', 'not json', '{}']) {
    const { root, run } = project({ 'src/app/page.tsx': 'export default function Page() { return null }\n', '.nextspark/generation.json': record })
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    assert.match(run().stdout, /nextspark migrate/, record)
  }
})

test('a generated host, or a project with no src/app, gets nothing', (t) => {
  for (const files of [
    { 'src/app/page.tsx': 'export {}\n', '.nextspark/generation.json': VALID_RECORD },
    {},
  ]) {
    const { root, run } = project(files)
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const before = snapshot(root)

    const result = run()

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, '')
    assert.deepEqual(snapshot(root), before)
    assert.equal(fs.existsSync(path.join(root, 'cli-was-run.txt')), false)
  }
})
