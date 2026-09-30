import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { GENERATION_FILE } from '../generation.mjs'
import { prepareHost, watchHost } from '../prepare.mjs'
import { DEV_DIAGNOSTIC_FILE } from '../render.mjs'
import { PAGE, ROUTE, read, tempHost, write } from './host-helpers.mjs'

/** Resolve once `condition()` holds after a watcher event, or fail after `ms`. */
function eventually(events, condition, label, ms = 60_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for: ${label}; events: ${JSON.stringify(events.list.map(e => e.kind))}`)), ms)
    const poll = () => {
      let ok = false
      try {
        ok = condition()
      } catch {}
      if (ok) {
        clearTimeout(timer)
        events.listeners.delete(poll)
        resolve()
      }
    }
    events.listeners.add(poll)
    poll()
  })
}

test('nextspark dev watch: routes follow added, renamed and deleted templates; a broken one keeps serving the last valid host and reports the error', { timeout: 600_000 }, async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About'), 'api/notes/route.ts': ROUTE })
  const events = { list: [], listeners: new Set() }
  const emit = event => {
    events.list.push(event)
    for (const listener of [...events.listeners]) listener()
  }
  await prepareHost(host.config, { devStatus: true })
  const watcher = watchHost(host.config, {
    debounceMs: 50,
    onSuccess: result => emit({ kind: 'success', result }),
    onFailure: failure => emit({ kind: 'failure', ...failure }),
  })
  const app = path => join(host.hostRoot, 'src/app', path)
  try {
    // The platform watcher arms asynchronously: touch a non-route file until a regeneration
    // answers, instead of guessing how long arming takes on this machine.
    const armed = events.list.length
    for (let touch = 0; events.list.length === armed; touch += 1) {
      if (touch > 600) throw new Error('the watcher never reported a change')
      write(host.source, 'templates/_armed.txt', String(touch))
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    write(host.source, 'templates/new/page.tsx', PAGE('New'))
    await eventually(events, () => existsSync(app('new/page.tsx')), 'added template generated')
    assert.match(read(host.hostRoot, 'src/app/new/page.tsx'), /@\/templates\/new\/page/)

    renameSync(join(host.source, 'templates/new'), join(host.source, 'templates/renamed'))
    await eventually(events, () => existsSync(app('renamed/page.tsx')) && !existsSync(app('new')), 'renamed template follows')

    unlinkSync(join(host.source, 'templates/renamed/page.tsx'))
    await eventually(events, () => !existsSync(app('renamed')), 'deleted template removed')

    write(host.source, 'api/feed/route.ts', ROUTE)
    await eventually(events, () => existsSync(app('api/feed/route.ts')), 'added api route generated')

    // Break a template: the last valid host stays, the terminal and the browser get the diagnostic
    const aboutBefore = read(host.hostRoot, 'src/app/about/page.tsx')
    const recordBefore = read(host.hostRoot, GENERATION_FILE)
    const failuresBefore = events.list.filter(e => e.kind === 'failure').length
    write(host.source, 'templates/about/page.tsx', 'export default function About() { return null }\nexport const notAllowed = 1\n')
    write(host.source, 'templates/later/page.tsx', PAGE('Later'))
    await eventually(events, () => events.list.filter(e => e.kind === 'failure').length > failuresBefore && read(host.hostRoot, DEV_DIAGNOSTIC_FILE).includes('could not regenerate'), 'failure reported')
    const failure = events.list.filter(e => e.kind === 'failure').at(-1)
    assert.ok(failure.lines.some(line => line.includes('templates/about/page.tsx') && line.includes('notAllowed')), failure.lines.join('\n'))
    assert.equal(failure.statusWritten, true)
    assert.equal(read(host.hostRoot, 'src/app/about/page.tsx'), aboutBefore)
    assert.equal(existsSync(app('later/page.tsx')), false, 'nothing of the failed generation is published')
    // Only the diagnostic module's hash changed in the record (it stays provably owned); nothing else
    const withoutDiagnostic = text => {
      const record = JSON.parse(text)
      delete record.files[DEV_DIAGNOSTIC_FILE]
      return record
    }
    assert.deepEqual(withoutDiagnostic(read(host.hostRoot, GENERATION_FILE)), withoutDiagnostic(recordBefore))
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /generationDiagnostic = "NextSpark could not regenerate src\/app; the dev server keeps serving the previous generation\. Until this is fixed, route files added, moved or removed, exports and segment config changed since then are NOT applied .*templates\/about\/page\.tsx/)
    assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE).includes('throw'), false, 'nothing throws: routes keep rendering')
    assert.match(read(host.hostRoot, 'src/app/layout.tsx'), /export default withGenerationStatus\(NextSparkSourceLayout\)/, 'the dev root layout renders the reporter')

    // Fix it: regenerated, status back to healthy
    write(host.source, 'templates/about/page.tsx', PAGE('AboutFixed'))
    await eventually(events, () => existsSync(app('later/page.tsx')) && read(host.hostRoot, DEV_DIAGNOSTIC_FILE).endsWith('generationDiagnostic = ""\n'), 'recovered')
  } finally {
    watcher.close()
    host.cleanup()
  }
})

test('nextspark dev watch: a source that stopped parsing in an earlier batch keeps the graph untouched until it parses again; tests are not part of the graph', { timeout: 600_000 }, async () => {
  const { PrepareError, unparsableSources } = await import('../prepare.mjs')
  const { CORE_ROOT } = await import('./host-helpers.mjs')
  let failing = false
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  const config = {
    ...host.config,
    registries: async () => {
      if (failing) throw new PrepareError([{ code: 'NS_TEST_FAILURE', message: 'an unrelated failure' }])
      return host.config.registries()
    },
  }
  const events = { list: [], listeners: new Set() }
  const emit = event => {
    events.list.push(event)
    for (const listener of [...events.listeners]) listener()
  }
  await prepareHost(config, { devStatus: true })
  const watcher = watchHost(config, { debounceMs: 50, onSuccess: result => emit({ kind: 'success', result }), onFailure: failure => emit({ kind: 'failure', ...failure }) })
  try {
    const armed = events.list.length
    for (let touch = 0; events.list.length === armed; touch += 1) {
      if (touch > 600) throw new Error('the watcher never reported a change')
      write(host.source, 'templates/_armed.txt', String(touch))
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    const count = kind => events.list.filter(e => e.kind === kind).length
    const diagnosticBefore = read(host.hostRoot, DEV_DIAGNOSTIC_FILE)

    // A helper the templates import stops parsing: not a route, so the regeneration itself succeeds
    const successes = count('success')
    write(host.source, 'templates/helpers.ts', 'export const x = (\n')
    await eventually(events, () => count('success') > successes, 'regenerated with the broken helper')

    // Later, an unrelated failure: the helper still does not parse, so nothing is written
    failing = true
    const failures = count('failure')
    write(host.source, 'templates/_other.txt', 'x')
    await eventually(events, () => count('failure') > failures, 'unrelated failure')
    const kept = events.list.filter(e => e.kind === 'failure').at(-1)
    assert.equal(kept.statusWritten, false)
    assert.equal(kept.error.parseError, true)
    assert.equal(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), diagnosticBefore)

    // It parses again: the next failure reaches the browser panel as before
    const again = count('failure')
    write(host.source, 'templates/helpers.ts', 'export const x = 1\n')
    await eventually(events, () => count('failure') > again, 'failure after the fix')
    assert.equal(events.list.filter(e => e.kind === 'failure').at(-1).statusWritten, true)
    assert.match(read(host.hostRoot, DEV_DIAGNOSTIC_FILE), /an unrelated failure/)
  } finally {
    watcher.close()
    host.cleanup()
  }
  // A test or a spec is not imported by the app: its syntax error does not hold the panel back
  const tests = tempHost({ 'templates/about.test.ts': 'x = (\n', 'templates/__tests__/a.ts': 'x = (\n', 'templates/b.ts': 'x = (\n' })
  try {
    const paths = ['templates/about.test.ts', 'templates/__tests__/a.ts', 'templates/b.ts'].map(path => join(tests.source, path))
    assert.deepEqual(await unparsableSources(paths, CORE_ROOT), [paths[2]])
  } finally {
    tests.cleanup()
  }
})
