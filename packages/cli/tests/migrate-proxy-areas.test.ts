/**
 * S21: migrate warns about a proxy the project keeps when it never names /superadmin or /devtools (the protected-area
 * check of core's proxy template), with the same code and rule as core's prepare (host/proxy-areas.mjs).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { PROXY_AREA_WARNING, PROXY_SESSION_WARNING, PROXY_SESSION_CACHED_WARNING, proxyProtectedAreaWarning, proxySessionWarning, proxySessionCachedWarning } from '../src/commands/migrate'

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

// S80 (D1): a kept proxy that still fetches its own /api/auth/get-session (every copy made before 0.1.0-beta.196)
test('a kept proxy that checks the session over HTTP is warned about, with the same code and message as prepare', async () => {
  const old = "return betterFetch<Session>('/api/auth/get-session', { baseURL: `${request.nextUrl.origin}` })"
  const warning = proxySessionWarning('src/proxy.ts', old)
  assert.match(warning ?? '', new RegExp(`^\\[${PROXY_SESSION_WARNING}\\] src/proxy\\.ts checks the session by fetching /api/auth/get-session`))
  assert.equal(proxySessionWarning('src/proxy.ts', CORE_TEMPLATE), null)
  assert.equal(proxySessionWarning('src/proxy.ts', "/* old: '/api/auth/get-session' */ export function proxy() {}"), null)

  const core = await import('../../core/scripts/build/registry/host/proxy-areas.mjs')
  assert.equal(core.PROXY_SESSION_WARNING, PROXY_SESSION_WARNING)
  assert.equal(warning, `[${PROXY_SESSION_WARNING}] ${core.proxySessionNotice('src/proxy.ts', old).message}`)
  for (const source of [CORE_TEMPLATE, old, "// '/api/auth/get-session'", 'export {}']) {
    assert.equal(proxySessionWarning('src/proxy.ts', source) === null, core.proxySessionNotice('src/proxy.ts', source) === null, source)
  }
})

test('the comment edges the S80 review measured give the same answer here as in prepare', async () => {
  const core = await import('../../core/scripts/build/registry/host/proxy-areas.mjs')
  const cases: Array<[string, boolean]> = [
    ["const x = 1 // was '/api/auth/get-session'\nexport function proxy() {}", false],
    ["const a = '/api/*'\nbetterFetch('/api/auth/get-session')\nconst b = 'x*/'", true],
    ["const u = 'https://example.com'; betterFetch('/api/auth/get-session')", true],
    ["/* betterFetch('/api/auth/get-session') */", false],
  ]
  for (const [source, warns] of cases) {
    assert.equal(proxySessionWarning('src/proxy.ts', source) !== null, warns, source)
    assert.equal(core.proxySessionNotice('src/proxy.ts', source) !== null, warns, source)
  }
})

// S101: a kept proxy copied from the 0.1.0-beta.196 template reads the session in process but from the cookie cache
test('a kept proxy that reads the session from the cookie cache is warned about, with the same code and message as prepare', async () => {
  const beta196 = "const session = await auth.api.getSession({ headers: new Headers({ cookie: '' }), query: { disableRefresh: true } })"
  const warning = proxySessionCachedWarning('src/proxy.ts', beta196)
  assert.match(warning ?? '', new RegExp(`^\\[${PROXY_SESSION_CACHED_WARNING}\\] src/proxy\\.ts reads the session with auth\\.api\\.getSession`))
  assert.equal(proxySessionCachedWarning('src/proxy.ts', CORE_TEMPLATE), null)

  const core = await import('../../core/scripts/build/registry/host/proxy-areas.mjs')
  assert.equal(core.PROXY_SESSION_CACHED_WARNING, PROXY_SESSION_CACHED_WARNING)
  assert.equal(warning, `[${PROXY_SESSION_CACHED_WARNING}] ${core.proxySessionCachedNotice('src/proxy.ts', beta196).message}`)
  for (const source of [CORE_TEMPLATE, beta196, `// disableCookieCache\n${beta196}`, 'export {}']) {
    assert.equal(proxySessionCachedWarning('src/proxy.ts', source) === null, core.proxySessionCachedNotice('src/proxy.ts', source) === null, source)
  }
})
