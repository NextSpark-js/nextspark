/**
 * S21: migrate warns about a proxy the project keeps when it never names /superadmin or /devtools (the protected-area
 * check of core's proxy template), with the same code and rule as core's prepare (host/proxy-areas.mjs).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { PROXY_AREA_WARNING, proxyProtectedAreaWarning } from '../src/commands/migrate'

const CORE_TEMPLATE = readFileSync(join(import.meta.dirname, '../../core/templates/proxy.ts'), 'utf8')

test("core's proxy template needs no warning", () => {
  assert.equal(proxyProtectedAreaWarning('src/proxy.ts', CORE_TEMPLATE), null)
})

test('each missing area is named with its roles; look-alike prefixes do not count', () => {
  const both = proxyProtectedAreaWarning('src/proxy.ts', "export function proxy() { return NextResponse.next() } // superadmin, devtools")
  assert.match(both ?? '', new RegExp(`^\\[${PROXY_AREA_WARNING}\\] src/proxy\\.ts does not protect /superadmin or /devtools\\.`))
  assert.match(both ?? '', /\/superadmin needs superadmin or developer, \/devtools needs developer/)

  const devtools = proxyProtectedAreaWarning('src/proxy.ts', "const PROTECTED = ['/dashboard', '/superadmin', '/devtools-tips']")
  assert.match(devtools ?? '', /does not protect \/devtools\. /)
  assert.doesNotMatch(devtools ?? '', /\/superadmin needs/)
})

test('the rule matches core prepare’s detector on the same sources', async () => {
  const core = await import('../../core/scripts/build/registry/host/proxy-areas.mjs')
  assert.equal(core.PROXY_AREA_WARNING, PROXY_AREA_WARNING)
  for (const source of [CORE_TEMPLATE, 'export {}', "const a = '/superadmin'", 'const b = `/devtools`', "const c = '/superadmin-x'"]) {
    const missing = core.missingProxyAreas(source).map((area: { path: string }) => area.path)
    const warning = proxyProtectedAreaWarning('src/proxy.ts', source)
    assert.equal(warning === null, missing.length === 0, source)
    if (warning) assert.match(warning, new RegExp(`does not protect ${missing.join(' or ')}\\.`), source)
  }
})
