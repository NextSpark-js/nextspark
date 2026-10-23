/**
 * Tests for the root-providers generator (#341): `providers.scope` of app.config decides whether the generated
 * root-providers.ts imports React Query and the toaster at all.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/root-providers.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { readProvidersScope, generateProvidersScope, generateRootProviders } from '../generators/root-providers.mjs'

function project(appConfig) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-providers-scope-'))
  if (appConfig !== undefined) {
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config', 'app.config.ts'), appConfig)
  }
  return root
}
const scopeOf = appConfig => {
  const root = project(appConfig)
  try {
    return readProvidersScope(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

test('the scope is root without a config file, without the setting, and for auth.providers', () => {
  assert.equal(scopeOf(undefined), 'root')
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = { app: { name: 'x' } }`), 'root')
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = { auth: { providers: { google: { enabled: true } } } }`), 'root')
})

test('the scope is read from the literal, in either quote style', () => {
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = { providers: { scope: 'groups' } }`), 'groups')
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = {\n  providers: {\n    scope: "groups" as const,\n  },\n}`), 'groups')
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = { providers: { scope: 'root' } }`), 'root')
})

test('a setting in a comment does not count', () => {
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = {\n  // providers: { scope: 'groups' },\n  /* providers: { scope: 'groups' } */\n  app: { url: 'https://example.com' },\n}`), 'root')
  assert.equal(scopeOf(`export const APP_CONFIG_OVERRIDES = { app: { url: 'https://example.com' }, providers: { scope: 'groups' } }`), 'groups')
})

test('a scope that is not a literal stops the generation instead of being read as root', () => {
  assert.throws(() => scopeOf(`export const APP_CONFIG_OVERRIDES = { providers: { scope: process.env.SCOPE } }`), /must be the literal 'root' or 'groups'/)
  assert.throws(() => scopeOf(`export const APP_CONFIG_OVERRIDES = { providers: { scope: 'everywhere' } }`), /must be the literal/)
})

test('with the root scope root-providers.ts re-exports the query provider and the toaster', () => {
  const out = generateRootProviders('root', { isNpmMode: true })
  assert.match(out, /export \{ QueryProvider as RootQueryProvider \} from '@nextsparkjs\/core\/providers\/query-provider'/)
  assert.match(out, /export \{ Toaster as RootToaster \} from '@nextsparkjs\/core\/components\/ui\/sonner'/)
  assert.match(generateProvidersScope('root'), /PROVIDERS_SCOPE: 'root' \| 'groups' = 'root'/)
})

test('with the groups scope root-providers.ts imports neither of them', () => {
  const out = generateRootProviders('groups', { isNpmMode: true })
  assert.match(out, /export const RootQueryProvider = null/)
  assert.match(out, /export const RootToaster = null/)
  assert.doesNotMatch(out, /query-provider|sonner|react-query/)
  assert.match(generateProvidersScope('groups'), /= 'groups'/)
})
