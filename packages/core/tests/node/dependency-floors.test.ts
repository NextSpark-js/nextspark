/**
 * Which dependencies a project declares below what core needs, and the pnpm add that moves them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addCommands, dependenciesBelowCore, floorsToRaise, workspaceAddCommands, workspaceFloors } from '../../scripts/maintenance/dependency-floors.mjs'

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

test('floorsToRaise keeps core\'s peer dependencies and the fixed list, and leaves other dependencies to be listed', () => {
  const manifest = { ...core, dependencies: { ...core.dependencies, stripe: '^18.5.0' } }
  const project = { dependencies: { 'better-auth': '~1.6.33', zod: '^4.1.5', next: '~16.3.0', react: '^18.0.0', stripe: '^17.0.0' } }
  const below = dependenciesBelowCore(project, manifest, semver)
  assert.deepEqual(floorsToRaise(below, manifest).map(({ name }) => name), ['better-auth', 'next', 'react', 'zod'])
  assert.deepEqual(below.map(({ name }) => name), ['better-auth', 'next', 'react', 'stripe', 'zod'])
})

// #374: the floors in the other packages of the workspace

test('workspaceFloors raises a dependency by its lowest version, in all four fields', () => {
  const manifest = {
    dependencies: { zod: '4.3.6' },
    devDependencies: { 'better-auth': '~1.6.33' },
    optionalDependencies: { next: '~16.3.0' },
    peerDependencies: { react: '^17.0.0' },
  }
  const { below, protocols } = workspaceFloors(manifest, core, semver)
  assert.deepEqual(below.map(({ name, field, declared, required }) => [name, field, declared, required]), [
    ['better-auth', 'devDependencies', '~1.6.33', '~1.7.7'],
    ['next', 'optionalDependencies', '~16.3.0', '~16.4.2'],
    ['react', 'peerDependencies', '^17.0.0', '^18.2.0 || ^19.0.0'],
    ['zod', 'dependencies', '4.3.6', '^4.5.4'],
  ])
  assert.deepEqual(protocols, [])
})

test('workspaceFloors keeps a peer range that allows core\'s version or sits above it, and never lowers one', () => {
  const peers = { next: '>=16', zod: '^4.7.0', react: '*', 'better-auth': '~1.8.0' }
  assert.deepEqual(workspaceFloors({ peerDependencies: peers }, core, semver).below, [])
  // a peer that does not allow core's version and is below it moves
  assert.deepEqual(workspaceFloors({ peerDependencies: { next: '~16.3.8' } }, core, semver).below.map(({ required }) => required), ['~16.4.2'])
})

test('workspaceFloors lists a workspace:, link:, file: or catalog: spec as a protocol and writes nothing for it', () => {
  const manifest = { dependencies: { zod: 'workspace:*', next: 'catalog:', 'better-auth': 'link:../auth', react: 'file:../react' } }
  const { below, protocols } = workspaceFloors(manifest, core, semver)
  assert.deepEqual(below, [])
  assert.deepEqual(protocols.map(({ name, declared }) => [name, declared]), [['better-auth', 'link:../auth'], ['next', 'catalog:'], ['react', 'file:../react'], ['zod', 'workspace:*']])
})

test('workspaceFloors only looks at next, react, react-dom, better-auth and zod, and leaves react out of a package that is not the project\'s', () => {
  const withOptional = { ...core, peerDependencies: { ...core.peerDependencies, nodemailer: '^7.0.0' } }
  const manifest = { peerDependencies: { nodemailer: '^6.0.0', next: '~16.3.0', react: '^17.0.0' }, dependencies: { stripe: '^1.0.0', '@better-fetch/fetch': '1.3.1' } }
  assert.deepEqual(workspaceFloors(manifest, withOptional, semver).below.map(({ name }) => name), ['next', 'react'])
  assert.deepEqual(workspaceFloors(manifest, withOptional, semver, false).below.map(({ name }) => name), ['next'])
})

test('workspaceAddCommands names the target and a flag per field, with --save-peer for a peer', () => {
  const { below } = workspaceFloors({ dependencies: { zod: '4.3.6' }, devDependencies: { 'better-auth': '~1.6.33' }, peerDependencies: { next: '~16.3.0' } }, core, semver)
  assert.deepEqual(workspaceAddCommands('--filter acme-foo', below), [
    "pnpm add --filter acme-foo 'zod@^4.5.4'",
    "pnpm add --filter acme-foo -D 'better-auth@~1.7.7'",
    "pnpm add --filter acme-foo --save-peer 'next@~16.4.2'",
  ])
  assert.deepEqual(workspaceAddCommands('-w', below.filter(({ name }) => name === 'zod')), ["pnpm add -w 'zod@^4.5.4'"])
})
