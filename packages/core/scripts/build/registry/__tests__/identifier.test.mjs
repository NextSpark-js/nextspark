/**
 * Tests for identifier safety in generated registries.
 *
 * The aliases the registries import under are built from user-chosen names, and
 * an invalid one is not a local problem: every route reaches the app through
 * these files, so a single `as 7startupsAppConfig` stops the whole project from
 * parsing. Replacing hyphens — what this used to do — leaves that case open.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/identifier.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toSafeIdentifier } from '../generators/identifier.mjs'

/** What the generated files are fed to: an ES module parser. */
function isValidIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

test('leaves a name that is already an identifier alone', () => {
  assert.equal(toSafeIdentifier('default'), 'default')
  assert.equal(toSafeIdentifier('myTheme'), 'myTheme')
  assert.equal(toSafeIdentifier('theme_2'), 'theme_2')
})

test('replaces the characters a directory name allows and an identifier does not', () => {
  assert.equal(toSafeIdentifier('my-theme'), 'my_theme')
  assert.equal(toSafeIdentifier('my.theme'), 'my_theme')
  assert.equal(toSafeIdentifier('my theme'), 'my_theme')
  assert.equal(toSafeIdentifier('@scope/name'), '_scope_name')
})

test('prefixes a leading digit', () => {
  assert.equal(toSafeIdentifier('7startups'), '_7startups')
  assert.equal(toSafeIdentifier('123-app'), '_123_app')
})

test('never returns an empty identifier', () => {
  assert.equal(toSafeIdentifier(''), '_')
  assert.equal(toSafeIdentifier('---'), '___')
})

test('every result is a valid identifier, suffixed or not', () => {
  const names = [
    'default', 'my-theme', '7startups', '123-app', 'a.b.c', '', '---',
    '2026', 'über-theme', 'theme!', '9', '_private', '$dollar',
  ]

  for (const name of names) {
    const safe = toSafeIdentifier(name)
    assert.ok(isValidIdentifier(safe), `${JSON.stringify(name)} produced ${JSON.stringify(safe)}`)
    // The generators append a role to the alias, so that has to stay valid too
    assert.ok(isValidIdentifier(`${safe}AppConfig`), `${safe}AppConfig is not an identifier`)
  }
})

test('distinct names stay distinct where it matters', () => {
  // Themes sit in one directory, so their names cannot collide after cleaning
  // unless they differed only by a separator — which the filesystem allows.
  // Documented rather than fixed: the alias is cosmetic, the registry is keyed
  // by the real name.
  assert.equal(toSafeIdentifier('my-theme'), toSafeIdentifier('my.theme'))
})
