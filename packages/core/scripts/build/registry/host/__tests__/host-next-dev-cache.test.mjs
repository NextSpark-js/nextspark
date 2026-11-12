/**
 * `prepare` clears .next/dev when a generated route is gone (#445, #453)
 */
import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { after, test } from 'node:test'

import { ROUTES_STATE_FILE, devServerRunning, syncDevCache } from '../next-dev-cache.mjs'

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
const state = root => JSON.parse(readFileSync(join(root, ROUTES_STATE_FILE), 'utf8')).routes
const files = (...names) => names.map(name => ({ path: `src/app/${name}/page.tsx` }))
const BASE = files('a', 'b', 'dashboard/billing')
const LESS = files('a', 'b')
const MORE = files('a', 'b', 'dashboard/billing', 'c')

test('a route that is gone deletes .next/dev, only that, says so and records the new flags', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  const result = syncDevCache({ projectRoot: root, files: LESS, running: idle })
  assert.equal(result.action, 'cleared')
  assert.match(result.line, /1 generated route file left src\/app \(src\/app\/dashboard\/billing\/page\.tsx\): deleted \.next\/dev/)
  assert.equal(existsSync(dev(root)), false)
  assert.equal(readFileSync(join(root, '.next', 'BUILD_ID'), 'utf8'), 'keep')
  assert.deepEqual(state(root), LESS.map(f => f.path))
})

test('the same routes delete nothing, in any order, and non-route files do not count', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, files: [...BASE].reverse().concat({ path: 'src/app/dev/generation-status.tsx' }, { path: 'src/lib/registries/x.ts' }), running: idle }).action, 'unchanged')
  assert.equal(existsSync(dev(root)), true)
})

test('routes that are only added delete nothing and are recorded', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, files: MORE, running: idle }).action, 'recorded')
  assert.equal(existsSync(dev(root)), true)
  assert.deepEqual(state(root), MORE.map(f => f.path).sort())
  assert.equal(syncDevCache({ projectRoot: root, files: LESS, running: idle }).action, 'cleared')
})

test('the features-state.json of #445 is ignored: no deletion, no failure, the routes are recorded', () => {
  const root = project()
  mkdirSync(join(root, '.nextspark'), { recursive: true })
  writeFileSync(join(root, '.nextspark', 'features-state.json'), '{"billing":true,"superadmin":true}\n')
  assert.equal(syncDevCache({ projectRoot: root, files: LESS, running: idle }).action, 'recorded')
  assert.equal(existsSync(dev(root)), true)
  assert.deepEqual(state(root), LESS.map(f => f.path))
})

test('without a record nothing is deleted, and the routes are recorded', () => {
  const root = project()
  const result = syncDevCache({ projectRoot: root, files: LESS, running: idle })
  assert.equal(result.action, 'recorded')
  assert.equal(existsSync(dev(root)), true)
  assert.deepEqual(state(root), LESS.map(f => f.path))
})

test('a symlinked .next/dev is not followed or deleted', () => {
  const root = project()
  const target = temp('nextspark-devcache-target-')
  writeFileSync(join(target, 'keep.txt'), 'keep')
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  rmSync(dev(root), { recursive: true })
  symlinkSync(target, dev(root))
  const result = syncDevCache({ projectRoot: root, files: LESS, running: idle })
  assert.equal(result.action, 'kept')
  assert.match(result.line, /symlink/)
  assert.equal(lstatSync(dev(root)).isSymbolicLink(), true)
  assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'keep')
})

test('a symlinked .next is not followed either', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  const real = temp('nextspark-devcache-real-')
  mkdirSync(join(real, 'dev'))
  rmSync(join(root, '.next'), { recursive: true })
  symlinkSync(real, join(root, '.next'))
  assert.equal(syncDevCache({ projectRoot: root, files: LESS, running: idle }).action, 'kept')
  assert.equal(existsSync(join(real, 'dev')), true)
})

test('the warning with a live server says to stop it, not to delete by hand; a symlink says to delete by hand', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  const live = syncDevCache({ projectRoot: root, files: LESS, running: () => true }).line
  assert.match(live, /stop it; the next prepare clears/)
  assert.doesNotMatch(live, /by hand/)
})

test('a running dev server keeps its cache, and the routes stay unrecorded so the next prepare clears it', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  const kept = syncDevCache({ projectRoot: root, files: LESS, running: () => true })
  assert.equal(kept.action, 'kept')
  assert.match(kept.line, /running dev server/)
  assert.equal(existsSync(dev(root)), true)
  assert.equal(syncDevCache({ projectRoot: root, files: LESS, running: idle }).action, 'cleared')
  assert.equal(existsSync(dev(root)), false)
})

test('the watcher never deletes or drops a recorded route', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, files: LESS, watching: true, running: idle }).action, 'kept')
  assert.equal(existsSync(dev(root)), true)
  assert.deepEqual(state(root), BASE.map(f => f.path))
})

test('a route the watcher sees added is recorded, so the prepare after the server stops finds it missing (#453)', () => {
  const root = project()
  syncDevCache({ projectRoot: root, files: BASE, running: idle })
  assert.equal(syncDevCache({ projectRoot: root, files: MORE, watching: true, running: idle }).action, 'recorded')
  assert.equal(existsSync(dev(root)), true)
  assert.deepEqual(state(root), MORE.map(f => f.path).sort())
  // Added and removed again during the same session: the watcher keeps the union
  syncDevCache({ projectRoot: root, files: BASE, watching: true, running: idle })
  assert.deepEqual(state(root), MORE.map(f => f.path).sort())
  const result = syncDevCache({ projectRoot: root, files: BASE, running: idle })
  assert.equal(result.action, 'cleared')
  assert.equal(existsSync(dev(root)), false)
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

test('prepare (the CLI): a route removed deletes .next/dev and prints the line; the same routes leave it', { timeout: 300_000 }, () => {
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
    assert.ok(state(root).length > 0)
    assert.ok(state(root).some(path => /pricing\/page\.tsx$/.test(path)), state(root).join('\n'))
    mkdirSync(join(root, '.next', 'dev'), { recursive: true })
    const same = prepare()
    assert.equal(same.status, 0, same.stderr)
    assert.equal(existsSync(dev(root)), true)
    assert.doesNotMatch(same.stdout, /deleted \.next\/dev/)
    // A template removed (a plugin or an entity leaves the same way) ...
    rmSync(join(root, 'templates', 'pricing'), { recursive: true })
    const changed = prepare()
    assert.equal(changed.status, 0, changed.stderr)
    assert.match(changed.stdout, /Info: 1 generated route file left src\/app \(src\/app\/.*pricing\/page\.tsx\): deleted \.next\/dev/)
    assert.equal(existsSync(dev(root)), false)
    // ... and a core feature turned off (the case of #445) is the same thing
    mkdirSync(dev(root), { recursive: true })
    put('nextspark.config.ts', 'export default { plugins: [], features: { billing: false } }\n')
    const flag = prepare()
    assert.equal(flag.status, 0, flag.stderr)
    assert.match(flag.stdout, /Info: \d+ generated route files? left src\/app .*: deleted \.next\/dev/)
    assert.equal(existsSync(dev(root)), false)
    // A record that cannot be written (a directory where the file goes) is one line, not a stack after the generation
    rmSync(join(root, ROUTES_STATE_FILE))
    mkdirSync(join(root, ROUTES_STATE_FILE))
    const broken = prepare()
    assert.equal(broken.status, 0, broken.stderr)
    assert.match(broken.stdout, /Warning: could not compare \.next\/dev with the generated routes/)
    assert.doesNotMatch(broken.stderr, /at \w/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
