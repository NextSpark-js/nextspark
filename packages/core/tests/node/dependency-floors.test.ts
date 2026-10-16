/**
 * Which dependencies a project declares below what core needs, and the pnpm add that moves them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addCommands, dependenciesBelowCore } from '../../scripts/maintenance/dependency-floors.mjs'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// The semver package of the CLI, as update-core resolves it
const semver = createRequire(path.join(CORE_DIR, '../cli/package.json'))('semver')

const core = {
  dependencies: { 'better-auth': '~1.7.7', '@better-fetch/fetch': '1.3.2', zod: '^4.5.4', '@nextsparkjs/ui': '0.1.0-beta.199' },
  peerDependencies: { next: '~16.4.2', react: '^18.2.0 || ^19.0.0' },
}

test('a .198 project is behind on all three dependencies core raised', () => {
  const project = { dependencies: { 'better-auth': '~1.6.33', '@better-fetch/fetch': '1.3.1', zod: '^4.1.5', '@nextsparkjs/ui': '0.1.0-beta.198' } }
  const below = dependenciesBelowCore(project, core, semver)
  assert.deepEqual(below.map(({ name, declared, required }) => [name, declared, required]), [
    ['@better-fetch/fetch', '1.3.1', '1.3.2'],
    ['better-auth', '~1.6.33', '~1.7.7'],
    ['zod', '^4.1.5', '^4.5.4'],
  ])
  assert.deepEqual(addCommands(below), ["pnpm add '@better-fetch/fetch@1.3.2' 'better-auth@~1.7.7' 'zod@^4.5.4'"])
})

test('an aligned project, or one ahead of core, lists nothing', () => {
  assert.deepEqual(dependenciesBelowCore({ dependencies: { 'better-auth': '~1.7.7', '@better-fetch/fetch': '1.3.2', zod: '^4.5.4' } }, core, semver), [])
  assert.deepEqual(dependenciesBelowCore({ dependencies: { 'better-auth': '~1.8.0', zod: '^5.0.0' } }, core, semver), [])
})

test('peer dependencies count, and a package the project does not declare does not', () => {
  const below = dependenciesBelowCore({ dependencies: { next: '16.3.5', react: '^19.0.0' } }, core, semver)
  assert.deepEqual(below.map(({ name }) => name), ['next'])
  assert.deepEqual(dependenciesBelowCore({ dependencies: {} }, core, semver), [])
})

test('a spec that is not a version range is not compared', () => {
  const project = { dependencies: { zod: 'workspace:*', 'better-auth': 'latest', '@better-fetch/fetch': 'npm:other@1.0.0' } }
  assert.deepEqual(dependenciesBelowCore(project, core, semver), [])
})

test('a dev dependency gets its own pnpm add -D line', () => {
  const below = dependenciesBelowCore({ dependencies: { zod: '^4.1.5' }, devDependencies: { 'better-auth': '~1.6.33' } }, core, semver)
  assert.deepEqual(addCommands(below), ["pnpm add 'zod@^4.5.4'", "pnpm add -D 'better-auth@~1.7.7'"])
})

test('an optional dependency gets its own pnpm add -O line', () => {
  const below = dependenciesBelowCore({ dependencies: { zod: '^4.1.5' }, optionalDependencies: { 'better-auth': '~1.6.33' } }, core, semver)
  assert.deepEqual(addCommands(below), ["pnpm add 'zod@^4.5.4'", "pnpm add -O 'better-auth@~1.7.7'"])
})
