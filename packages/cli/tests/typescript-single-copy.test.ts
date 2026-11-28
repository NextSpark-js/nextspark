/**
 * next-intl takes typescript as a peer, so pnpm installs one copy of it per TypeScript version in the
 * tree. The TypeScript range core declares and the one the wizard writes into a project have to pick
 * the same release, or a new project carries two copies of next-intl and the dashboard routes that
 * import it from the app ship its provider twice (#584).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import semver from 'semver'

const core = JSON.parse(fs.readFileSync(new URL('../../core/package.json', import.meta.url), 'utf8'))
const generator = fs.readFileSync(new URL('../src/wizard/generators/index.ts', import.meta.url), 'utf8')
const templateRange = generator.match(/^\s*'typescript': '([^']+)'/m)?.[1]

test('core and the project template resolve the same TypeScript release', () => {
  assert.ok(templateRange, "the wizard's devDependencies list a typescript range")
  // what the registry offers: pnpm takes the newest one a range allows
  const published = ['5.7.3', '5.8.3', '5.9.3', '6.0.3']
  assert.equal(
    semver.maxSatisfying(published, core.dependencies.typescript),
    semver.maxSatisfying(published, templateRange),
  )
})
