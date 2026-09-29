import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FIRST_DEFINE_PLUGIN_CORE, checkAllPlugins, checkPluginCorePeer, compareVersions, importsCoreAtRuntime, minimumOfRange, parseVersion } from '../../../../scripts/packages/plugin-core-peer.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function plugin(files, peers) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-plugin-peer-'))
  const dir = join(root, 'demo')
  const all = { 'package.json': JSON.stringify({ name: '@x/plugin-demo', ...(peers ? { peerDependencies: peers } : {}) }), ...files }
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return { root, dir, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const IMPORT = "import { definePlugin } from '@nextsparkjs/core/types/plugin'\nexport default definePlugin({ name: 'demo', capabilities: ['web'] })\n"

test('the floor is a historical fact: the current core is at or above it, and the current core exports definePlugin', () => {
  // version.sh advances package versions but does not rewrite a fixed floor, so the floor never has to equal the current version.
  const core = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/core/package.json'), 'utf8'))
  assert.ok(compareVersions(parseVersion(core.version), parseVersion(FIRST_DEFINE_PLUGIN_CORE)) >= 0, `core ${core.version} is below the definePlugin floor ${FIRST_DEFINE_PLUGIN_CORE}`)
  assert.match(readFileSync(join(REPO_ROOT, 'packages/core/src/types/plugin.ts'), 'utf8'), /export function definePlugin\(/)
})

test('the floor and the plugins keep passing when the release moves on (0.1.0-beta.193, 0.1.1, 0.2.0)', () => {
  for (const next of ['0.1.0-beta.193', '0.1.0-beta.200', '0.1.0', '0.1.1', '0.2.0']) {
    assert.ok(compareVersions(parseVersion(next), parseVersion(FIRST_DEFINE_PLUGIN_CORE)) >= 0, next)
    // a plugin's fixed floor stays valid against the moved release; nothing in the check reads the current version
    const floor = minimumOfRange('>=0.1.0-beta.192')
    assert.ok(compareVersions(floor, parseVersion(next)) <= 0, next)
  }
  assert.deepEqual(checkAllPlugins(join(REPO_ROOT, 'plugins')), [])
})

test('versions and ranges compare like semver', () => {
  const v = text => parseVersion(text)
  assert.equal(compareVersions(v('0.1.0-beta.192'), v('0.1.0-beta.188')), 1)
  assert.equal(compareVersions(v('0.1.0-beta.9'), v('0.1.0-beta.10')), -1)
  assert.equal(compareVersions(v('0.1.0'), v('0.1.0-beta.192')), 1)
  assert.equal(compareVersions(v('0.1.0-0'), v('0.1.0-beta.192')), -1)
  assert.equal(compareVersions(v('1.0.0'), v('1.0.0')), 0)
  assert.deepEqual(minimumOfRange('>=0.1.0-beta.192').core, [0, 1, 0])
  assert.equal(compareVersions(minimumOfRange('^0.1.0-beta.200 || >=0.2.0'), v('0.1.0-beta.200')), 0)
  for (const range of ['*', 'latest', 'workspace:*', '<1.0.0', '1.x']) assert.equal(minimumOfRange(range), null, range)
})

test('runtime imports of core are told apart from type-only ones', () => {
  assert.equal(importsCoreAtRuntime("import { definePlugin } from '@nextsparkjs/core/types/plugin'"), true)
  assert.equal(importsCoreAtRuntime("import core from '@nextsparkjs/core'"), true)
  assert.equal(importsCoreAtRuntime("import '@nextsparkjs/core/styles'"), true)
  assert.equal(importsCoreAtRuntime("const x = await import('@nextsparkjs/core/lib/db')"), true)
  assert.equal(importsCoreAtRuntime("import type { PluginConfig } from '@nextsparkjs/core/types/plugin'"), false)
  assert.equal(importsCoreAtRuntime("import { type PluginConfig } from '@nextsparkjs/core/types/plugin'"), false)
  assert.equal(importsCoreAtRuntime("import { z } from 'zod'"), false)
})

test('a plugin importing core must declare a peer that starts at the definePlugin release', () => {
  const cases = [
    [undefined, /declares no @nextsparkjs\/core peerDependency/],
    ['>=0.1.0-0', /accepts releases older than 0.1.0-beta.192/],
    ['>=0.1.0-beta.188', /accepts releases older than/],
    ['*', /no readable minimum/],
    ['>=0.1.0-beta.192', null],
    ['>=0.1.0-beta.200', null],
    ['^0.2.0', null],
  ]
  for (const [range, expected] of cases) {
    const { dir, cleanup } = plugin({ 'plugin.config.ts': IMPORT }, range ? { '@nextsparkjs/core': range } : undefined)
    try {
      const problems = checkPluginCorePeer(dir)
      if (expected) {
        assert.equal(problems.length, 1, String(range))
        assert.match(problems[0], expected)
        assert.match(problems[0], /@x\/plugin-demo/)
      } else assert.deepEqual(problems, [], String(range))
    } finally {
      cleanup()
    }
  }
})

test('a plugin with only type imports, or with tests importing core, needs no peer', () => {
  const { dir, cleanup } = plugin({
    'plugin.config.ts': "import type { PluginConfig } from '@nextsparkjs/core/types/plugin'\nexport const c: PluginConfig = {} as PluginConfig\n",
    '__tests__/a.test.ts': IMPORT,
    'lib/b.test.ts': IMPORT,
  })
  try {
    assert.deepEqual(checkPluginCorePeer(dir), [])
  } finally {
    cleanup()
  }
})

test('every plugin in plugins/ that imports core declares a satisfying core peer', () => {
  assert.deepEqual(checkAllPlugins(join(REPO_ROOT, 'plugins')), [])
})
