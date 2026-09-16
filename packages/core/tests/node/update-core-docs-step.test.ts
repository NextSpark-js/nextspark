/**
 * update-core.mjs regenerates every registry - the docs registry included -
 * through a single `registry.mjs --build` call; there is no separate docs
 * build step to shell out to. A failed registry rebuild must flip the exit
 * code and must not be reported as a successful update.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rebuildRegistries } from '../../scripts/maintenance/rebuild-registries.mjs'

const UPDATE_CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/maintenance/update-core.mjs')
const source = fs.readFileSync(UPDATE_CORE, 'utf8')

test('does not shell out to the removed docs.mjs build step', () => {
  assert.doesNotMatch(source, /docs:build/)
  assert.doesNotMatch(source, /docs\.mjs/)
})

test('rebuildRegistries runs the real registry build command and reports success', () => {
  const calls = []
  const result = rebuildRegistries(command => { calls.push(command) })

  assert.equal(result, true)
  assert.deepEqual(calls, ['node core/scripts/build/registry.mjs --build'])
})

test('rebuildRegistries reports a failed rebuild instead of swallowing it', () => {
  const messages = []
  const originalConsoleError = console.error
  console.error = (...args) => messages.push(args.join(' '))

  let result
  try {
    result = rebuildRegistries(() => {
      throw new Error('registry.mjs exited with code 1')
    })
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(result, false)
  assert.ok(messages.some(message => message.includes('Registry rebuild failed')))
})

test('a failed registry rebuild is not reported as a successful update', () => {
  const finalReport = source.slice(source.indexOf('// Final report'), source.indexOf('// ==================== CLI ENTRY POINT'))
  assert.match(finalReport, /if \(registryRebuildSucceeded\)/)

  const elseBranch = finalReport.slice(finalReport.indexOf('} else {'))
  assert.match(elseBranch, /process\.exitCode = 1/)
  assert.doesNotMatch(elseBranch, /Update Complete!/)
})

test('a failed registry rebuild does not write core.version.json', () => {
  const lines = source.split('\n')
  const versionCallIndex = lines.findIndex(line => line.includes('await updateVersionFile(releaseInfo, previousVersion)'))
  assert.ok(versionCallIndex > -1, 'update-core.mjs still calls updateVersionFile')

  // The nearest preceding `if (` above the call is the condition that guards
  // it; a failed rebuild must not reach this line at all.
  const guard = lines.slice(0, versionCallIndex).reverse().find(line => /^\s*if \(/.test(line))
  assert.match(guard ?? '', /registryRebuildSucceeded/)
})
