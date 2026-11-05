/**
 * The ranges create-nextspark-app installs next to core cannot be read from core (it installs in the same
 * `pnpm add`), so they are written here: none may start below the range @nextsparkjs/core declares (#397).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import semver from 'semver'

import { ESSENTIAL_DEPENDENCIES } from '../src/create.js'

const core = JSON.parse(fs.readFileSync(new URL('../../core/package.json', import.meta.url), 'utf8'))

test('no dependency create-nextspark-app installs starts below the range core declares', () => {
  for (const specifier of ESSENTIAL_DEPENDENCIES) {
    const at = specifier.lastIndexOf('@')
    const [name, range] = at > 0 ? [specifier.slice(0, at), specifier.slice(at + 1)] : [specifier, undefined]
    const theirs = core.dependencies?.[name] ?? core.peerDependencies?.[name]
    if (!range || !theirs || !semver.validRange(theirs)) continue
    assert.ok(
      semver.gte(semver.minVersion(range)!, semver.minVersion(theirs)!),
      `${name}@${range} is below core's ${theirs}`,
    )
  }
})
