import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'

import { hasCoreRouteManifest, loadCoreRouteManifest, resolvePackageExport } from '../core-routes.mjs'
import { GENERATION_DIAGNOSTICS, GENERATION_FILE, LOCK_FILE, acquireLock, isLegacyGeneratedRegistry, readGeneration, staleLockReason } from '../generation.mjs'
import { PrepareError, checkHost, prepareHost, projectHostConfig, renderHostFiles } from '../prepare.mjs'
import { loadFixtureCoreRoutes } from '../../../../../tests/fixtures/host-conformance/plan.mjs'
import { CORE_ROOT, PAGE, REGISTRY, hostConfig, manyRegistries, read, tempHost, write } from './host-helpers.mjs'

const HERE = import.meta.dirname
const codes = error => error.diagnostics.map(d => d.code)

function runChild(script, args, onLine = () => {}) {
  const child = spawn(process.execPath, [join(HERE, script), ...args], { stdio: ['ignore', 'pipe', 'inherit'] })
  const output = new Promise(resolve => {
    let text = ''
    child.stdout.on('data', chunk => {
      text += chunk
      if (String(chunk).includes('\n')) onLine(text.trim())
    })
    child.on('close', () => resolve(text.trim()))
  })
  return { child, output }
}

test('lock: under contention, with a stale lock present or not, exactly one process holds it', { timeout: 900_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-lock-race-'))
  const trials = Number(process.env.LOCK_RACE_TRIALS) || 20
  const holders = {}
  const outcomes = {}
  try {
    for (let trial = 0; trial < trials; trial += 1) {
      rmSync(join(root, '.nextspark'), { recursive: true, force: true })
      rmSync(join(root, 'release'), { force: true })
      mkdirSync(join(root, '.nextspark'), { recursive: true })
      // Half the trials start from a stale lock of a process that is gone.
      if (trial % 2 === 0) writeFileSync(join(root, LOCK_FILE), JSON.stringify({ pid: 99999999, host: hostname(), startedAt: new Date().toISOString(), token: 'stale' }))
      const start = String(Date.now() + 300)
      // The holder keeps the lock until every child has answered: all 12 attempts overlap it.
      let answered = 0
      const onAnswer = () => {
        answered += 1
        if (answered === 12) writeFileSync(join(root, 'release'), '')
      }
      const results = await Promise.all(Array.from({ length: 12 }, () => runChild('lock-race-child.mjs', [root, start], onAnswer).output))
      const acquired = results.filter(result => result === 'acquired').length
      holders[acquired] = (holders[acquired] ?? 0) + 1
      for (const result of results) outcomes[result] = (outcomes[result] ?? 0) + 1
      assert.deepEqual(readdirSync(join(root, '.nextspark')), [], `trial ${trial}: no lock, claim or takeover file left behind`)
    }
    assert.deepEqual(holders, { 1: trials }, `holders per trial: ${JSON.stringify(holders)}; outcomes ${JSON.stringify(outcomes)}`)
    assert.deepEqual(Object.keys(outcomes).sort(), ['acquired', `refused:${GENERATION_DIAGNOSTICS.LOCKED}`])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('lock: a live holder on this machine is never taken over, however old; one on another machine is after the timeout', () => {
  const host = tempHost({})
  try {
    const path = join(host.hostRoot, LOCK_FILE)
    mkdirSync(join(host.hostRoot, '.nextspark'), { recursive: true })
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), startedAt: old, token: 'live' }))
    assert.equal(staleLockReason(path), null)
    assert.throws(() => acquireLock(host.hostRoot), error => codes(error)[0] === GENERATION_DIAGNOSTICS.LOCKED)
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).token, 'live', 'the live lock is untouched')
    writeFileSync(path, JSON.stringify({ pid: process.pid, host: 'another-machine', startedAt: old, token: 'remote' }))
    assert.match(staleLockReason(path), /another machine/)
    acquireLock(host.hostRoot)()
    assert.equal(existsSync(path), false)
  } finally {
    host.cleanup()
  }
})

/**
 * Publish `count` registries in a child and SIGKILL it as soon as the record is pending with the
 * first file new and the last one still old. Waits on that observable state, never on a sleep;
 * returns false when the child finished first (a machine faster than `count` allows).
 */
async function killMidPublish(host, count) {
  await prepareHost(hostConfig(host.root, { registries: manyRegistries(count, 'old') }), { mode: 'production' })
  const { child } = runChild('publish-crash-child.mjs', [host.root, String(count)])
  let closed = false
  const done = new Promise(resolve => child.on('close', () => { closed = true; resolve() }))
  const first = join(host.hostRoot, '.nextspark/registries/r00000.ts')
  const last = join(host.hostRoot, `.nextspark/registries/r${String(count - 1).padStart(5, '0')}.ts`)
  let observed = false
  while (!observed && !closed) {
    try {
      const record = JSON.parse(readFileSync(join(host.hostRoot, GENERATION_FILE), 'utf8'))
      if (record.pending && readFileSync(first, 'utf8').includes('(new)') && readFileSync(last, 'utf8').includes('(old)')) {
        child.kill('SIGKILL')
        observed = true
      }
    } catch {
      // mid-rename: look again
    }
    await new Promise(resolve => setImmediate(resolve))
  }
  await done
  return observed
}

test('crash mid-publish (SIGKILL): --check reports the host as not fresh, and the next prepare completes it deterministically', { timeout: 900_000 }, async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  let count = 3000
  try {
    let observed = await killMidPublish(host, count)
    while (!observed && count < 48_000) {
      count *= 2
      observed = await killMidPublish(host, count)
    }
    assert.ok(observed, 'the child was killed with the record pending and the tree half old, half new')
    assert.equal(readGeneration(host.hostRoot).pending, true)

    const fresh = hostConfig(host.root, { registries: manyRegistries(count, 'new') })
    const checked = await checkHost(fresh)
    assert.equal(checked.ok, false)
    assert.ok(checked.problems.some(problem => problem.path === GENERATION_FILE && /did not finish/.test(problem.detail)), JSON.stringify(checked.problems.slice(0, 3)))

    // The lock of the killed process is recovered (its pid is gone) and the publication completes
    const repaired = await prepareHost(fresh, { mode: 'production' })
    assert.equal(readGeneration(host.hostRoot).pending, undefined)
    assert.deepEqual(await checkHost(fresh), { ok: true, problems: [] })
    assert.equal(read(host.hostRoot, '.nextspark/registries/r00000.ts').includes('(new)'), true)
    assert.equal(read(host.hostRoot, `.nextspark/registries/r${String(count - 1).padStart(5, '0')}.ts`).includes('(new)'), true)
    assert.ok(repaired.written.length > 0 && repaired.written.length < count, `only what the crash left old is rewritten (${repaired.written.length})`)
    // Deterministic: a second run changes nothing
    const again = await prepareHost(fresh, { mode: 'production' })
    assert.deepEqual([again.written, again.deleted], [[], []])
  } finally {
    host.cleanup()
  }
})

test('registries: a file in place of a generated registry is adopted only when a NextSpark registry build wrote it', async () => {
  const cases = [
    ['byte-identical', REGISTRY, 'adopted'],
    ['legacy registry build output', "/**\n * Auto-generated Unified Registry\n *\n * Generated at: 2026-09-01T10:00:00.000Z\n */\nexport const OLD = {}\n", 'adopted'],
    ['legacy single-line stamp', '// AUTO-GENERATED FILE - DO NOT EDIT\n// Generated at: 2026-09-01T10:00:00.000Z\nexport const OLD = 1\n', 'adopted'],
    ['the fixture generator', "// Generated by NextSpark. Do not edit: regenerated on every build.\nexport const OLD = {}\n", 'adopted'],
    ['hand-written', '// my own registry\nexport const MINE = 1\n', 'refused'],
    ['a stamp further down, not in the header', `${'// line\n'.repeat(40)}// Generated at: 2026-09-01T10:00:00.000Z\n`, 'refused'],
  ]
  for (const [label, content, expected] of cases) {
    const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
    try {
      write(host.hostRoot, '.nextspark/registries/example.ts', content)
      if (expected === 'adopted') {
        await prepareHost(host.config)
        assert.equal(read(host.hostRoot, '.nextspark/registries/example.ts'), REGISTRY, label)
      } else {
        await assert.rejects(prepareHost(host.config), error => {
          assert.ok(error instanceof PrepareError, label)
          assert.deepEqual(codes(error), [GENERATION_DIAGNOSTICS.FOREIGN_REGISTRY], label)
          assert.match(error.message, /\.nextspark\/registries\/example\.ts/)
          return true
        })
        assert.equal(read(host.hostRoot, '.nextspark/registries/example.ts'), content, `${label}: untouched`)
        assert.equal(existsSync(join(host.hostRoot, 'src')), false, `${label}: nothing written`)
      }
    } finally {
      host.cleanup()
    }
  }
  assert.equal(isLegacyGeneratedRegistry('export const x = 1\n'), false)

  // Once owned, a registry is simply regenerated, whatever was edited into it
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config)
    write(host.hostRoot, '.nextspark/registries/example.ts', '// edited by hand\n')
    await prepareHost(host.config)
    assert.equal(read(host.hostRoot, '.nextspark/registries/example.ts'), REGISTRY)
  } finally {
    host.cleanup()
  }
})

test('--check targets the production host: a dev generation is fresh only for --check --dev, and the other way round', async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config, { devStatus: true })
    const plain = await checkHost(host.config)
    assert.equal(plain.ok, false)
    assert.match(plain.problems[0].detail, /development host nextspark dev writes/)
    assert.deepEqual(await checkHost(host.config, { dev: true }), { ok: true, problems: [] })

    await prepareHost(host.config, { mode: 'production' })
    assert.deepEqual(await checkHost(host.config), { ok: true, problems: [] })
    const asDev = await checkHost(host.config, { dev: true })
    assert.equal(asDev.ok, false)
    assert.match(asDev.problems[0].detail, /not the development host/)
  } finally {
    host.cleanup()
  }
})

test('an npm-installed core ships only dist/: the manifest, variants and route modules resolve through its exports map', async () => {
  const core = mkdtempSync(join(tmpdir(), 'nextspark-packed-core-'))
  try {
    // The layout of the published package (stage 2's exports): no src/routes at all
    write(core, 'package.json', JSON.stringify({
      name: '@nextsparkjs/core',
      exports: {
        './routes/manifest.json': './dist/routes/manifest.json',
        './routes/variants.json': './dist/routes/variants.json',
        './routes/*': { types: './dist/routes/*.d.ts', import: './dist/routes/*.js' },
      },
    }))
    write(core, 'dist/routes/manifest.json', JSON.stringify([
      { kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout' },
      { kind: 'page', target: '(auth)/login/page.tsx', specifier: '@nextsparkjs/core/routes/(auth)/login/page' },
    ]))
    write(core, 'dist/routes/variants.json', JSON.stringify({ cacheComponents: [{ kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout.ppr' }] }))
    for (const module of ['layout', 'layout.ppr', '(auth)/login/page']) write(core, `dist/routes/${module}.js`, 'export default function Route() { return null }\n')
    write(core, 'dist/routes/layout.d.ts', 'export {}\n')

    assert.equal(hasCoreRouteManifest(core), true)
    assert.equal(resolvePackageExport(core, './routes/(auth)/login/page'), join(core, 'dist/routes/(auth)/login/page.js'), 'a pattern export, conditions skipping types')
    const off = await loadCoreRouteManifest({ coreRoot: core, isProtected: () => false })
    assert.equal(off.path, join(core, 'dist/routes/manifest.json'))
    assert.deepEqual(off.routes.map(route => route.file.slice(core.length)), ['/dist/routes/layout.js', '/dist/routes/(auth)/login/page.js'])
    const on = await loadCoreRouteManifest({ coreRoot: core, cacheComponents: true, isProtected: () => false })
    assert.equal(on.routes[0].file, join(core, 'dist/routes/layout.ppr.js'))

    // A source checkout (the monorepo) has src/routes too: the source wins over its build output
    write(core, 'src/routes/manifest.json', JSON.stringify([{ kind: 'layout', target: 'layout.tsx', specifier: '@nextsparkjs/core/routes/layout' }]))
    write(core, 'src/routes/layout.tsx', 'export default function Layout() { return null }\n')
    const source = await loadCoreRouteManifest({ coreRoot: core, isProtected: () => false })
    assert.equal(source.path, join(core, 'src/routes/manifest.json'))
    assert.equal(source.routes[0].file, join(core, 'src/routes/layout.tsx'))

    // Neither: no manifest, the core cannot generate the host
    const bare = mkdtempSync(join(tmpdir(), 'nextspark-bare-core-'))
    write(bare, 'package.json', JSON.stringify({ name: '@nextsparkjs/core', exports: { '.': './dist/index.js' } }))
    assert.equal(hasCoreRouteManifest(bare), false)
    assert.equal(await loadCoreRouteManifest({ coreRoot: bare }), null)
    rmSync(bare, { recursive: true, force: true })
  } finally {
    rmSync(core, { recursive: true, force: true })
  }
})

test('the project config is read again for every generation: enabling a plugin in nextspark.config.ts adds its routes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-config-reload-'))
  try {
    write(root, 'package.json', JSON.stringify({ name: 'reload', dependencies: { next: '16.3.5' } }))
    write(root, 'nextspark.config.ts', 'export default { plugins: [] }\n')
    write(root, 'plugins/search/plugin.config.ts', 'export const searchPluginConfig = {}\n')
    write(root, 'plugins/search/templates/search/page.tsx', PAGE('Search'))
    const config = projectHostConfig({ projectRoot: root })
    config.loadCoreRoutes = loadFixtureCoreRoutes
    assert.ok(config.watch.files.includes(join(root, 'nextspark.config.ts')), 'the watcher regenerates on a config change')

    const targets = async () => (await renderHostFiles(config)).routes.map(route => route.target)
    assert.equal((await targets()).includes('search/page.tsx'), false)
    write(root, 'nextspark.config.ts', "export default { plugins: ['search'] }\n")
    assert.deepEqual(config.plugins.map(plugin => plugin.name), ['search'])
    assert.equal((await targets()).includes('search/page.tsx'), true)
    assert.ok(Object.keys(config.inputs({}).files).includes('plugins/search/templates/search/page.tsx'), 'and its sources are inputs')

    write(root, 'nextspark.config.ts', 'export default { plugins: [] }\n')
    assert.equal((await targets()).includes('search/page.tsx'), false)
    write(root, 'nextspark.config.ts', "export default { plugins: ['nowhere/../x'] }\n")
    await assert.rejects(renderHostFiles(config), error => error instanceof PrepareError && codes(error)[0] === 'NS_HOST_PROJECT_CONFIG')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a failed dev regeneration writes its browser diagnostic under its own lock: no newer generation can land in between', async () => {
  const { DEV_DIAGNOSTIC_FILE } = await import('../render.mjs')
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config, { devStatus: true })
    let failRegistries
    const gate = new Promise((_, reject) => { failRegistries = reject })
    gate.catch(() => {}) // rejected before prepareHost may await it
    const failing = { ...host.config, registries: () => gate }
    const failed = prepareHost(failing, { devStatus: true, reportFailure: true }).catch(error => error)
    await new Promise(resolve => setImmediate(resolve))

    // While the failing regeneration runs, no other writer gets in
    await assert.rejects(prepareHost(host.config, { devStatus: true }), error => codes(error)[0] === GENERATION_DIAGNOSTICS.LOCKED)

    const lockSeen = []
    failRegistries(new PrepareError([{ code: 'NS_TEST_FAILURE', message: 'registry build failed on purpose' }]))
    const error = await failed
    lockSeen.push(existsSync(join(host.hostRoot, LOCK_FILE)))
    assert.equal(error.statusWritten, true)
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /registry build failed on purpose/, 'written before the lock was released')
    assert.deepEqual(lockSeen, [false], 'and the lock is released once the caller sees the failure')

    // The next successful generation clears it; a failure can never be written after it
    await prepareHost(host.config, { devStatus: true })
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /generationDiagnostic = ""/)

    // A failure while another writer holds the lock writes nothing (that writer's generation wins)
    const release = acquireLock(host.hostRoot)
    const locked = await prepareHost(failing, { devStatus: true, reportFailure: true }).catch(e => e)
    release()
    assert.equal(codes(locked)[0], GENERATION_DIAGNOSTICS.LOCKED)
    assert.notEqual(locked.statusWritten, true)
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /generationDiagnostic = ""/)
  } finally {
    host.cleanup()
  }
})

test('writeOwnedFile crash (SIGKILL after the file is replaced, before the record is finalized): --check is not fresh, the next prepare recovers', { timeout: 900_000 }, async () => {
  const { DEV_DIAGNOSTIC_FILE, devDiagnosticModule } = await import('../render.mjs')
  const { renderRecord, sha256 } = await import('../generation.mjs')
  const failed = devDiagnosticModule('NextSpark could not regenerate src/app (crash test)')
  // A large record makes the finalizing rewrite slow enough to be observed; grow it until the kill
  // lands inside the window (waiting on observable state, never on a sleep).
  for (let padding = 50_000; padding <= 1_600_000; padding *= 2) {
    const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
    try {
      await prepareHost(host.config, { devStatus: true })
      const healthy = read(host.hostRoot, DEV_DIAGNOSTIC_FILE)
      const record = readGeneration(host.hostRoot)
      const padded = { ...record, files: { ...record.files } }
      for (let i = 0; i < padding; i += 1) padded.files[`.nextspark/registries/pad${String(i).padStart(7, '0')}.ts`] = '0'.repeat(64)
      writeFileSync(join(host.hostRoot, GENERATION_FILE), renderRecord(padded))

      const { child } = runChild('diag-write-child.mjs', [host.hostRoot, failed])
      let closed = false
      const done = new Promise(resolve => child.on('close', () => { closed = true; resolve() }))
      let killed = false
      while (!killed && !closed) {
        try {
          if (read(host.hostRoot, DEV_DIAGNOSTIC_FILE) === failed) {
            child.kill('SIGKILL')
            killed = true
          }
        } catch {
          // mid-rename: look again
        }
        await new Promise(resolve => setImmediate(resolve))
      }
      await done
      const after = readGeneration(host.hostRoot)
      if (!killed || !after.pending) continue // finished before the kill: a bigger record next time

      // The crash window: new bytes on disk, the record pending and accepting both versions
      assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), failed)
      assert.equal(after.files[DEV_DIAGNOSTIC_FILE], sha256(failed))
      assert.deepEqual(after.previousFiles[DEV_DIAGNOSTIC_FILE], [sha256(healthy)])

      const checked = await checkHost(host.config, { dev: true })
      assert.equal(checked.ok, false)
      assert.ok(checked.problems.some(problem => problem.path === GENERATION_FILE && /did not finish/.test(problem.detail)))
      assert.equal(checked.problems.some(problem => problem.state === 'foreign'), false, 'NextSpark\'s own write is never foreign')

      // The killed process's lock-free write left no lock; the next prepare recovers and owns everything
      const repaired = await prepareHost(host.config, { devStatus: true })
      assert.ok(repaired.written.includes(DEV_DIAGNOSTIC_FILE), 'the diagnostic is restored to the healthy module')
      assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), healthy)
      assert.equal(readGeneration(host.hostRoot).pending, undefined)
      assert.deepEqual(await checkHost(host.config, { dev: true }), { ok: true, problems: [] })
      return
    } finally {
      host.cleanup()
    }
  }
  assert.fail('never killed writeOwnedFile inside its crash window')
})

test('writeOwnedFile keeps an unfinished publication pending: its previousFiles survive and the next prepare still completes it', async () => {
  const { DEV_DIAGNOSTIC_FILE, devDiagnosticModule } = await import('../render.mjs')
  const { writeOwnedFile, renderRecord, sha256 } = await import('../generation.mjs')
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config, { devStatus: true })
    const record = readGeneration(host.hostRoot)
    const halfOld = read(host.hostRoot, 'src/app/about/page.tsx')
    // An interrupted publication that meant to change about/page.tsx and had not yet
    const pending = { ...record, pending: true, files: { ...record.files, 'src/app/about/page.tsx': sha256('// new\n') }, previousFiles: { 'src/app/about/page.tsx': [sha256(halfOld)] } }
    writeFileSync(join(host.hostRoot, GENERATION_FILE), renderRecord(pending))

    assert.equal(writeOwnedFile(host.hostRoot, DEV_DIAGNOSTIC_FILE, devDiagnosticModule('failure')), true)
    const after = readGeneration(host.hostRoot)
    assert.equal(after.pending, true, 'still the unfinished publication')
    assert.deepEqual(after.previousFiles['src/app/about/page.tsx'], [sha256(halfOld)], 'its previous hashes are kept')
    assert.equal(after.files[DEV_DIAGNOSTIC_FILE], sha256(devDiagnosticModule('failure')))

    await prepareHost(host.config, { devStatus: true })
    assert.equal(readGeneration(host.hostRoot).pending, undefined)
    assert.deepEqual(await checkHost(host.config, { dev: true }), { ok: true, problems: [] })
  } finally {
    host.cleanup()
  }
})

test('a dev regeneration that fails because a source does not parse writes nothing: no module of the graph changes until it parses again', async () => {
  const { DEV_DIAGNOSTIC_FILE } = await import('../render.mjs')
  const { hasParseError } = await import('../prepare.mjs')
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config, { devStatus: true })
    const diagnosticBefore = read(host.hostRoot, DEV_DIAGNOSTIC_FILE)
    const recordBefore = read(host.hostRoot, GENERATION_FILE)

    // Turbopack drops the fix that follows a rewrite of the graph made while a module does not parse
    write(host.source, 'templates/about/page.tsx', 'export default function About() { return null }\nexport const broken = (\n')
    const error = await prepareHost(host.config, { devStatus: true, reportFailure: true }).catch(e => e)
    assert.ok(error instanceof PrepareError)
    assert.ok(codes(error).includes('NS_HOST_PARSE_ERROR'), codes(error).join(', '))
    assert.equal(error.parseError, true)
    assert.notEqual(error.statusWritten, true)
    assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), diagnosticBefore, 'the diagnostic module is not rewritten')
    assert.equal(read(host.hostRoot, GENERATION_FILE), recordBefore, 'nothing is published')

    // Parses again but is still wrong (an error only prepare sees): the browser panel gets it as before
    write(host.source, 'templates/about/page.tsx', 'export default function About() { return null }\nexport const notAllowed = 1\n')
    const invalid = await prepareHost(host.config, { devStatus: true, reportFailure: true }).catch(e => e)
    assert.equal(invalid.parseError, undefined)
    assert.equal(invalid.statusWritten, true)
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /notAllowed/)

    // Fixed: written normally, and the diagnostic is emptied
    write(host.source, 'templates/about/page.tsx', PAGE('AboutFixed'))
    await prepareHost(host.config, { devStatus: true, reportFailure: true })
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /generationDiagnostic = ""/)

    // An entity config that does not parse counts too
    assert.equal(hasParseError({ diagnostics: [{ code: 'NS_HOST_ENTITY_CONFIG_UNREADABLE', parseError: true }] }), true)
    assert.equal(hasParseError({ diagnostics: [{ code: 'NS_HOST_ENTITY_CONFIG_UNREADABLE' }] }), false)
    assert.equal(hasParseError(new Error('plain')), false)
  } finally {
    host.cleanup()
  }
})

test('predictHost: the plan, its notices and every diagnostic of a generation, without writing anything (dry runs)', async () => {
  const { predictHost } = await import('../prepare.mjs')
  const clean = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    const result = await predictHost(clean.config)
    assert.equal(result.ok, true)
    assert.deepEqual(result.diagnostics, [])
    assert.deepEqual(result.notices, [])
    assert.ok(result.routes.some(route => route.target === 'about/page.tsx'))
    assert.deepEqual(result.checks, { plan: 'passed', emission: 'passed', grammar: 'passed', ownership: 'passed', contracts: 'none', registries: 'skipped' })
    assert.deepEqual(readdirSync(clean.hostRoot), [], 'nothing written')

    // A hand-written file where the host generates one: prepare would refuse it, so the prediction does too
    write(clean.hostRoot, 'src/app/about/page.tsx', 'export default function Mine() { return null }\n')
    const owned = await predictHost(clean.config)
    assert.equal(owned.ok, false)
    assert.equal(owned.checks.ownership, 'failed')
    assert.equal(read(clean.hostRoot, 'src/app/about/page.tsx'), 'export default function Mine() { return null }\n', 'untouched')
    const prepared = await prepareHost(clean.config).catch(error => error)
    assert.ok(prepared instanceof PrepareError, 'and prepare agrees')
  } finally {
    clean.cleanup()
  }
  const conflicting = tempHost({ 'templates/(a)/x/page.tsx': PAGE('A'), 'templates/(b)/x/page.tsx': PAGE('B'), 'templates/y/page.tsx': 'export const = ;\n' })
  try {
    const result = await predictHost(conflicting.config)
    assert.equal(result.ok, false)
    assert.deepEqual(result.routes, [])
    assert.ok(codes(result).includes('NS_HOST_URL_CONFLICT'), codes(result).join(', '))
    assert.deepEqual(result.checks, { plan: 'failed', emission: 'skipped', grammar: 'skipped', ownership: 'skipped', contracts: 'none', registries: 'skipped' })
    assert.deepEqual(readdirSync(conflicting.hostRoot), [], 'nothing written')
  } finally {
    conflicting.cleanup()
  }
  // The contracts plan runs even when the host plan fails, and its ownership preflight too
  const contracts = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    const target = join(contracts.root, 'contracts')
    const file = { path: 'src/index.ts', content: 'export {}\n' }
    const withContracts = plan => ({ ...contracts.config, contracts: { target: () => ({ root: target, label: 'contracts', kind: 'package' }), plan: async () => plan } })
    const broken = await predictHost(withContracts({ files: [], warnings: [], diagnostics: [{ code: 'NS_CONTRACTS_TEST', message: 'entity config does not parse' }] }))
    assert.equal(broken.checks.contracts, 'failed')
    assert.ok(codes(broken).includes('NS_CONTRACTS_TEST'))
    write(target, 'src/index.ts', '// mine\n')
    const foreign = await predictHost(withContracts({ files: [file], warnings: [], diagnostics: [] }))
    assert.equal(foreign.checks.contracts, 'failed')
    assert.equal(read(target, 'src/index.ts'), '// mine\n', 'untouched')
    rmSync(join(target, 'src/index.ts'))
    const fine = await predictHost(withContracts({ files: [file], warnings: [], diagnostics: [] }))
    assert.equal(fine.checks.contracts, 'passed')
    assert.equal(existsSync(join(target, 'src/index.ts')), false, 'nothing written')
  } finally {
    contracts.cleanup()
  }
})

test('a dev failure while a changed source of the graph does not parse (a config the registries import) writes nothing; nextspark.config.ts is outside the graph and still gets the panel', async () => {
  const { DEV_DIAGNOSTIC_FILE } = await import('../render.mjs')
  const { unparsableSources } = await import('../prepare.mjs')
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  try {
    await prepareHost(host.config, { devStatus: true })
    const diagnosticBefore = read(host.hostRoot, DEV_DIAGNOSTIC_FILE)
    // The registry build fails on it (a config under config/, an entity or plugin config): no NS_HOST_PARSE_ERROR from the host
    const failing = { ...host.config, registries: async () => { throw new PrepareError([{ code: 'NS_HOST_REGISTRY_BUILD_FAILED', message: 'the registry build failed' }]) } }
    write(host.source, 'config/app.config.ts', 'export const APP_CONFIG = {\n')
    const config = join(host.source, 'config/app.config.ts')
    assert.deepEqual(await unparsableSources([config, join(host.source, 'messages/en.json'), join(host.source, 'gone.ts')], CORE_ROOT), [config])

    const error = await prepareHost(failing, { devStatus: true, reportFailure: true, changed: [config] }).catch(e => e)
    assert.equal(error.parseError, true)
    assert.notEqual(error.statusWritten, true)
    assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), diagnosticBefore, 'nothing written while it does not parse')

    // nextspark.config.ts (and next.config.*) are not imported by the app: the panel is the only place the error shows
    write(host.source, 'nextspark.config.ts', 'export default {\n')
    const outside = await prepareHost(failing, { devStatus: true, reportFailure: true, changed: [join(host.source, 'nextspark.config.ts')] }).catch(e => e)
    assert.equal(outside.parseError, undefined)
    assert.equal(outside.statusWritten, true)
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /the registry build failed/)
  } finally {
    host.cleanup()
  }
})
