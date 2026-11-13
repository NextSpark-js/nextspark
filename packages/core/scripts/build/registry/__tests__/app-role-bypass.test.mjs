/**
 * `teams.appRoleBypass` of app.config is validated when the registries are generated: a wrong value fails the build
 * (#457), instead of throwing at runtime on every permission check.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/app-role-bypass.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateAppRoleBypass } from '../discovery/permissions.mjs'

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const ERROR = /teams\.appRoleBypass in config\/app\.config\.ts must be one of 'none', 'developer', 'developer-and-superadmin'; got 'superadmin'/

/** A minimal root-first project, with this app.config.ts when given. */
function project(appConfig) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-app-role-bypass-'))
  writeFileSync(join(root, 'nextspark.config.ts'), 'export default {}\n')
  writeFileSync(join(root, 'package.json'), '{"dependencies":{"next":"16.4.2"}}')
  mkdirSync(join(root, 'src', 'app'), { recursive: true })
  if (appConfig !== undefined) {
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config', 'app.config.ts'), appConfig)
  }
  return root
}

function withProject(appConfig, fn) {
  const root = project(appConfig)
  try {
    return fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const config = value => `export const APP_CONFIG_OVERRIDES = {\n  teams: {\n    mode: 'multi-tenant' as const,\n    options: { allowCreateTeams: true },\n    appRoleBypass: ${value},\n  },\n}\n`

test('each valid value is accepted, with or without as const', () => {
  for (const value of ['none', 'developer', 'developer-and-superadmin']) {
    assert.equal(withProject(config(`'${value}'`), validateAppRoleBypass), value)
    assert.equal(withProject(config(`"${value}" as const`), validateAppRoleBypass), value)
  }
})

test('no file, no setting, a commented-out setting or a variable: nothing to check at build', () => {
  assert.equal(withProject(undefined, validateAppRoleBypass), null)
  assert.equal(withProject(`export const APP_CONFIG_OVERRIDES = { teams: { mode: 'single-user' } }`, validateAppRoleBypass), null)
  assert.equal(withProject(`export const APP_CONFIG_OVERRIDES = { teams: { // appRoleBypass: 'everyone',\n mode: 'single-user' } }`, validateAppRoleBypass), null)
  assert.equal(withProject(config('shared'), validateAppRoleBypass), null)
})

test('a wrong value throws with the valid ones', () => {
  assert.throws(() => withProject(config(`'superadmin'`), validateAppRoleBypass), ERROR)
  assert.throws(() => withProject(config(`''`), validateAppRoleBypass), /got ''/)
})

test('the registry build fails on a wrong value and succeeds on a valid one', () => {
  const build = root => spawnSync('node', [join(CORE_DIR, 'scripts', 'build', 'registry.mjs')], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    input: '{}',
  })
  withProject(config(`'superadmin'`), root => {
    const result = build(root)
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, ERROR)
  })
  withProject(config(`'developer-and-superadmin'`), root => {
    const result = build(root)
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
  })
})
