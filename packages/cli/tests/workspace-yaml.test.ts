import { test } from 'node:test'
import assert from 'node:assert/strict'

import { addPackageEntries, setPackageEntries } from '../src/wizard/generators/workspace-yaml.js'

/** How many times the file declares the key. Two is a file pnpm refuses. */
const packageKeys = (yaml: string) => (yaml.match(/^packages:/gm) || []).length

const WITH_ALLOW_BUILDS = `# what create-nextspark-app wrote
allowBuilds:
  '@nextsparkjs/core': true
`

test('adds entries to a block list', () => {
  const out = addPackageEntries("packages:\n  - 'apps/*'\n", ['packages/widgets/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
  assert.match(out, /- 'packages\/widgets\/\*'/)
})

test('rewrites an inline list as a block, keeping what it had', () => {
  const out = addPackageEntries("packages: ['apps/*']\n", ['packages/widgets/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
  assert.match(out, /- 'packages\/widgets\/\*'/)
})

// A comment after the key is part of neither form's value: reading it as a
// different key prepends a second `packages:`, and pnpm then refuses the file
// for a duplicated mapping key.
test('a trailing comment does not hide the key', () => {
  for (const source of ["packages: ['apps/*'] # keep\n", 'packages: # keep\n  - \'apps/*\'\n']) {
    const out = addPackageEntries(source, ['packages/widgets/*'])

    assert.equal(packageKeys(out), 1, `two keys for: ${source}`)
    assert.match(out, /- 'apps\/\*'/)
  }
})

test('a file with no packages key gets one', () => {
  const out = addPackageEntries(WITH_ALLOW_BUILDS, ['packages/widgets/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /allowBuilds:/)
})

test('everything else in the file survives', () => {
  const out = addPackageEntries(`packages: ['apps/*'] # keep\n\n${WITH_ALLOW_BUILDS}`, ['packages/widgets/*'])

  assert.match(out, /# what create-nextspark-app wrote/)
  assert.match(out, /'@nextsparkjs\/core': true/)
})

test('an entry already there is not repeated', () => {
  const out = addPackageEntries("packages:\n  - 'packages/widgets/*'\n", ['packages/widgets/*'])

  assert.equal((out.match(/packages\/widgets/g) || []).length, 1)
})

test('setting entries replaces the list and keeps the rest', () => {
  const out = setPackageEntries(`packages: ['apps/*'] # keep\n\n${WITH_ALLOW_BUILDS}`, ['web', 'mobile'])

  assert.equal(packageKeys(out), 1)
  assert.doesNotMatch(out, /apps\/\*/)
  assert.match(out, /- 'web'/)
  assert.match(out, /- 'mobile'/)
  assert.match(out, /allowBuilds:/)
})

// Every shape below is a file pnpm accepts today, so none of them may come back
// with a second `packages:` key — the one thing pnpm refuses outright.
test('a YAML anchor on the key does not hide it', () => {
  const out = addPackageEntries("packages: &workspace\n  - 'apps/*'\n", ['packages/widgets/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
})

test('a flow sequence written across lines is one list', () => {
  const out = addPackageEntries("packages: [\n  'apps/*',\n  'web'\n]\n", ['packages/widgets/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
  assert.match(out, /- 'web'/)
  assert.doesNotMatch(out, /\[/)
})

// `packages/{a,b}` is one glob. Splitting it on the comma yields two that match
// nothing, and the workspace quietly loses those packages.
test('a brace expansion survives as a single entry', () => {
  const out = addPackageEntries("packages: ['packages/{a,b}']\n", ['packages/widgets/*'])

  assert.match(out, /- 'packages\/\{a,b\}'/)
  assert.doesNotMatch(out, /- 'b\}'/)
})

test('setting entries replaces a multi-line flow sequence whole', () => {
  const out = setPackageEntries("packages: [\n  'apps/*'\n]\n\nallowBuilds:\n  'x': true\n", ['web'])

  assert.equal(packageKeys(out), 1)
  assert.doesNotMatch(out, /apps\/\*/)
  assert.doesNotMatch(out, /\[/)
  assert.match(out, /allowBuilds:/)
})
