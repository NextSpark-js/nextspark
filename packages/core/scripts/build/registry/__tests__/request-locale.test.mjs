/**
 * Tests for the request-locale generator (#390): `i18n.requestLocale` of app.config decides the constants of the
 * generated request-locale.ts, which the group layouts and the public pages read.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/request-locale.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { readRequestLocale, generateRequestLocale } from '../generators/request-locale.mjs'

function read(appConfig) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-request-locale-'))
  try {
    if (appConfig !== undefined) {
      mkdirSync(join(root, 'config'))
      writeFileSync(join(root, 'config', 'app.config.ts'), appConfig)
    }
    return readRequestLocale(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}
const OFF = { auth: false, public: false }

test('both groups are off without a config file, without the setting, and for an unrelated one', () => {
  assert.deepEqual(read(undefined), OFF)
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { i18n: { defaultLocale: 'en' } }`), OFF)
})

test('each group is read on its own', () => {
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { auth: true } } }`), { auth: true, public: false })
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { public: true } } }`), { auth: false, public: true })
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = {\n  i18n: {\n    requestLocale: {\n      auth: true,\n      public: false,\n    },\n  },\n}`), { auth: true, public: false })
})

test('a setting in a comment or a string does not count', () => {
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = {\n  // requestLocale: { auth: true },\n  /* requestLocale: { public: true } */\n  a: 1,\n}`), OFF)
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { note: "requestLocale: { auth: true }" }`), OFF)
})

test('a value that is not the literal true or false, and an unknown group, stop the generation', () => {
  assert.throws(() => read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { auth: 'yes' } } }`), /requestLocale\.auth .* literal true or false \(found 'yes'\)/)
  assert.throws(() => read(`const on = true\nexport const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { public: on } } }`), /requestLocale\.public .* literal true or false/)
  assert.throws(() => read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { dashboard: true } } }`), /unknown group "dashboard"/)
  assert.throws(() => read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { ...shared } } }`), /cannot read/)
})

test('the generated file holds the two settings, and says the public pages keep the default locale only on a Cache Components host', () => {
  assert.match(generateRequestLocale(OFF, true), /REQUEST_LOCALE_AUTH: boolean = false\nexport const REQUEST_LOCALE_PUBLIC: boolean = false\nexport const PUBLIC_IN_DEFAULT_LOCALE: boolean = true/)
  assert.match(generateRequestLocale({ auth: true, public: false }, true), /REQUEST_LOCALE_AUTH: boolean = true/)
  assert.match(generateRequestLocale({ auth: false, public: true }, true), /REQUEST_LOCALE_PUBLIC: boolean = true\nexport const PUBLIC_IN_DEFAULT_LOCALE: boolean = false/)
  assert.match(generateRequestLocale(OFF, false), /PUBLIC_IN_DEFAULT_LOCALE: boolean = false/)
  // the auth group the same way (#401)
  assert.match(generateRequestLocale(OFF, true), /AUTH_IN_DEFAULT_LOCALE: boolean = true/)
  assert.match(generateRequestLocale({ auth: true, public: false }, true), /AUTH_IN_DEFAULT_LOCALE: boolean = false/)
  assert.match(generateRequestLocale(OFF, false), /AUTH_IN_DEFAULT_LOCALE: boolean = false/)
})

test('true as const is accepted, a variable is ignored, and a spread or a quoted key stops the generation', () => {
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { auth: true as const, public: false as const } } }`), { auth: true, public: false })
  assert.deepEqual(read(`const shared = { auth: true }\nexport const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: shared } }`), OFF)
  assert.throws(() => read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { ...R } } }`), /cannot read/)
  assert.throws(() => read(`export const APP_CONFIG_OVERRIDES = { i18n: { requestLocale: { 'auth': true } } }`), /cannot read/)
})

test('requestLocale is read inside the i18n block, not elsewhere in the file', () => {
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { other: { requestLocale: { auth: true } }, i18n: { defaultLocale: 'en' } }`), OFF)
  assert.deepEqual(read(`export const APP_CONFIG_OVERRIDES = { i18n: { cookie: { a: 1 }, requestLocale: { public: true } }, other: { requestLocale: { auth: true } } }`), { auth: false, public: true })
})
