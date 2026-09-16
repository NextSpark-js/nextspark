import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { effectiveBundler, resolveBundlerArgs, pickBundler } from '../src/utils/next-bundler.js'

/** A project root whose installed Next reports `version`. */
function projectOn(version: string): string {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-bundler-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', dependencies: { next: version } }))
  const nextDir = join(root, 'node_modules', 'next')
  mkdirSync(nextDir, { recursive: true })
  writeFileSync(join(nextDir, 'package.json'), JSON.stringify({ name: 'next', version, main: 'index.js' }))
  writeFileSync(join(nextDir, 'index.js'), 'module.exports = {}')
  return root
}

test('with no flag, the bundler reported is the one that major runs', () => {
  assert.equal(effectiveBundler(undefined, projectOn('15.5.24')), 'webpack')
  assert.equal(effectiveBundler(undefined, projectOn('16.3.5')), 'turbopack')
})

test('a flag wins over the version default', () => {
  assert.equal(effectiveBundler('webpack', projectOn('16.3.5')), 'webpack')
  assert.equal(effectiveBundler('turbopack', projectOn('15.5.24')), 'turbopack')
})

test('an unreadable project falls back to Webpack', () => {
  assert.equal(effectiveBundler(undefined, join(tmpdir(), 'nextspark-not-a-project')), 'webpack')
})

test('the flag is spelled the way each major understands it', () => {
  assert.deepEqual(resolveBundlerArgs('webpack', projectOn('16.3.5')), ['--webpack'])
  assert.deepEqual(resolveBundlerArgs('turbopack', projectOn('16.3.5')), [])
  assert.deepEqual(resolveBundlerArgs('turbopack', projectOn('15.5.24')), ['--turbopack'])
  assert.deepEqual(resolveBundlerArgs('webpack', projectOn('15.5.24')), [])
})

test('both bundler flags together is an error', () => {
  assert.throws(() => pickBundler({ webpack: true, turbopack: true }), /pick one bundler/)
})
