/**
 * `prepare` clears .next/dev when the features flags change (#445)
 */
import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { after, test } from 'node:test'

import { FEATURES_STATE_FILE, devServerRunning, syncDevCache } from '../next-dev-cache.mjs'

const made = []
after(() => made.forEach(dir => rmSync(dir, { recursive: true, force: true })))
const temp = prefix => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  made.push(dir)
  return dir
}

function project() {
  const root = temp('nextspark-devcache-')
  mkdirSync(join(root, '.next', 'dev', 'types'), { recursive: true })
  writeFileSync(join(root, '.next', 'dev', 'types', 'routes.d.ts'), 'stale')
  writeFileSync(join(root, '.next', 'BUILD_ID'), 'keep')
  return root
}
const dev = root => join(root, '.next', 'dev')
const idle = () => false
const state = root => JSON.parse(readFileSync(join(root, FEATURES_STATE_FILE), 'utf8'))

test('a changed flag deletes .next/dev, only that, says so and records the new flags', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  const result = syncDevCache({ projectRoot: root, features: { billing: false }, running: idle })
  assert.equal(result.action, 'cleared')
  assert.match(result.line, /features\.billing changed: deleted \.next\/dev/)
  assert.equal(existsSync(dev(root)), false)
  assert.equal(readFileSync(join(root, '.next', 'BUILD_ID'), 'utf8'), 'keep')
  assert.deepEqual(state(root), { billing: false, superadmin: true })
})

test('the same flags delete nothing; an unset flag and true are the same', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, features: { billing: true, superadmin: true }, running: idle }).action, 'unchanged')
  assert.equal(existsSync(dev(root)), true)
})

test('without a record nothing is deleted, and the flags are recorded', () => {
  const root = project()
  const result = syncDevCache({ projectRoot: root, features: { superadmin: false }, running: idle })
  assert.equal(result.action, 'recorded')
  assert.equal(existsSync(dev(root)), true)
  assert.equal(state(root).superadmin, false)
})

test('a symlinked .next/dev is not followed or deleted', () => {
  const root = project()
  const target = temp('nextspark-devcache-target-')
  writeFileSync(join(target, 'keep.txt'), 'keep')
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  rmSync(dev(root), { recursive: true })
  symlinkSync(target, dev(root))
  const result = syncDevCache({ projectRoot: root, features: { billing: false }, running: idle })
  assert.equal(result.action, 'kept')
  assert.match(result.line, /symlink/)
  assert.equal(lstatSync(dev(root)).isSymbolicLink(), true)
  assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'keep')
})

test('a symlinked .next is not followed either', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  const real = temp('nextspark-devcache-real-')
  mkdirSync(join(real, 'dev'))
  rmSync(join(root, '.next'), { recursive: true })
  symlinkSync(real, join(root, '.next'))
  assert.equal(syncDevCache({ projectRoot: root, features: { billing: false }, running: idle }).action, 'kept')
  assert.equal(existsSync(join(real, 'dev')), true)
})

test('the warning with a live server says to stop it, not to delete by hand; a symlink says to delete by hand', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  const live = syncDevCache({ projectRoot: root, features: { billing: false }, running: () => true }).line
  assert.match(live, /stop it; the next prepare clears/)
  assert.doesNotMatch(live, /by hand/)
})

test('a running dev server keeps its cache, and the flags stay unrecorded so the next prepare clears it', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  const kept = syncDevCache({ projectRoot: root, features: { billing: false }, running: () => true })
  assert.equal(kept.action, 'kept')
  assert.match(kept.line, /running dev server/)
  assert.equal(existsSync(dev(root)), true)
  assert.equal(syncDevCache({ projectRoot: root, features: { billing: false }, running: idle }).action, 'cleared')
  assert.equal(existsSync(dev(root)), false)
})

test('the watcher never deletes or records', () => {
  const root = project()
  syncDevCache({ projectRoot: root, features: {}, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, features: { billing: false }, watching: true, running: idle }).action, 'kept')
  assert.equal(existsSync(dev(root)), true)
  assert.equal(state(root).billing, true)
})

test('devServerRunning reads the lock of Next: a live pid, a dead pid, a lock without one, no lock', () => {
  const root = project()
  assert.equal(devServerRunning(root), false)
  writeFileSync(join(dev(root), 'lock'), JSON.stringify({ pid: process.pid, appUrl: 'http://localhost:3000' }))
  assert.equal(devServerRunning(root), true)
  assert.equal(devServerRunning(root, { alive: () => false }), false)
  writeFileSync(join(dev(root), 'lock'), JSON.stringify({ appUrl: 'http://localhost:3000' }))
  assert.equal(devServerRunning(root), true)
})

test('prepare (the CLI): a flag turned off deletes .next/dev and prints the line; the same flags leave it', { timeout: 300_000 }, () => {
  const root = temp('nextspark-devcache-cli-')
  try {
    const put = (path, content) => {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), content)
    }
    put('nextspark.config.ts', 'export default { plugins: [] }\n')
    put('package.json', JSON.stringify({ name: 'devcache', dependencies: { next: '16.4.2' } }))
    put('templates/pricing/page.tsx', 'export default function Pricing() { return null }\n')
    const prepare = () => spawnSync(process.execPath, [join(import.meta.dirname, '../prepare-cli.mjs')], { cwd: root, encoding: 'utf8', timeout: 240_000 })
    const first = prepare()
    assert.equal(first.status, 0, first.stderr)
    assert.deepEqual(state(root), { billing: true, superadmin: true })
    mkdirSync(join(root, '.next', 'dev'), { recursive: true })
    const same = prepare()
    assert.equal(same.status, 0, same.stderr)
    assert.equal(existsSync(dev(root)), true)
    assert.doesNotMatch(same.stdout, /deleted \.next\/dev/)
    put('nextspark.config.ts', 'export default { plugins: [], features: { billing: false } }\n')
    const changed = prepare()
    assert.equal(changed.status, 0, changed.stderr)
    assert.match(changed.stdout, /Info: features\.billing changed: deleted \.next\/dev/)
    assert.equal(existsSync(dev(root)), false)
    assert.equal(state(root).billing, false)
    // A record that cannot be written (a directory where the file goes) is one line, not a stack after the generation
    rmSync(join(root, FEATURES_STATE_FILE))
    mkdirSync(join(root, FEATURES_STATE_FILE))
    const broken = prepare()
    assert.equal(broken.status, 0, broken.stderr)
    assert.match(broken.stdout, /Warning: could not compare \.next\/dev with the features flags/)
    assert.doesNotMatch(broken.stderr, /at \w/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
