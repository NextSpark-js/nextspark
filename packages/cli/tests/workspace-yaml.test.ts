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
  const out = addPackageEntries("packages:\n  - 'apps/*'\n", ['contents/themes/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
  assert.match(out, /- 'contents\/themes\/\*'/)
})

test('rewrites an inline list as a block, keeping what it had', () => {
  const out = addPackageEntries("packages: ['apps/*']\n", ['contents/themes/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /- 'apps\/\*'/)
  assert.match(out, /- 'contents\/themes\/\*'/)
})

// A comment after the key is part of neither form's value: reading it as a
// different key prepends a second `packages:`, and pnpm then refuses the file
// for a duplicated mapping key.
test('a trailing comment does not hide the key', () => {
  for (const source of ["packages: ['apps/*'] # keep\n", 'packages: # keep\n  - \'apps/*\'\n']) {
    const out = addPackageEntries(source, ['contents/themes/*'])

    assert.equal(packageKeys(out), 1, `two keys for: ${source}`)
    assert.match(out, /- 'apps\/\*'/)
  }
})

test('a file with no packages key gets one', () => {
  const out = addPackageEntries(WITH_ALLOW_BUILDS, ['contents/themes/*'])

  assert.equal(packageKeys(out), 1)
  assert.match(out, /allowBuilds:/)
})

test('everything else in the file survives', () => {
  const out = addPackageEntries(`packages: ['apps/*'] # keep\n\n${WITH_ALLOW_BUILDS}`, ['contents/themes/*'])

  assert.match(out, /# what create-nextspark-app wrote/)
  assert.match(out, /'@nextsparkjs\/core': true/)
})

test('an entry already there is not repeated', () => {
  const out = addPackageEntries("packages:\n  - 'contents/themes/*'\n", ['contents/themes/*'])

  assert.equal((out.match(/contents\/themes/g) || []).length, 1)
})

test('setting entries replaces the list and keeps the rest', () => {
  const out = setPackageEntries(`packages: ['apps/*'] # keep\n\n${WITH_ALLOW_BUILDS}`, ['web', 'mobile'])

  assert.equal(packageKeys(out), 1)
  assert.doesNotMatch(out, /apps\/\*/)
  assert.match(out, /- 'web'/)
  assert.match(out, /- 'mobile'/)
  assert.match(out, /allowBuilds:/)
})
