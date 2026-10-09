/**
 * A project's proxy that never names /superadmin or /devtools (#203, S21): core still refuses those pages on the server,
 * but only the proxy can answer a signed-in user without the role with a 307, so `nextspark prepare` warns
 * (NS_PROXY_PROTECTED_AREA_MISSING), naming each area missing and what core's proxy template does for it.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-proxy-areas.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PROXY_AREA_WARNING, PROXY_SESSION_WARNING, PROXY_SESSION_CACHED_WARNING, missingProxyAreas, withoutComments, proxyAreaNotice, proxyAreaNotices, proxySessionNotice, proxySessionCachedNotice } from '../proxy-areas.mjs'
import { predictHost } from '../prepare.mjs'
import { PAGE, tempHost, write } from './host-helpers.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const PASS_THROUGH = "import { NextResponse } from 'next/server'\nexport function proxy() { return NextResponse.next() }\n"

test("core's proxy template protects both areas", () => {
  assert.deepEqual(missingProxyAreas(readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), [])
})

test('an area counts only when the proxy names its path; a look-alike prefix or a comment word does not', () => {
  assert.deepEqual(missingProxyAreas(PASS_THROUGH).map(area => area.path), ['/superadmin', '/devtools'])
  assert.deepEqual(missingProxyAreas("const PROTECTED = ['/dashboard', '/superadmin']").map(area => area.path), ['/devtools'])
  assert.deepEqual(missingProxyAreas('if (pathname.startsWith(`/devtools`)) {} // superadmin later').map(area => area.path), ['/superadmin'])
  assert.deepEqual(missingProxyAreas("const docs = '/superadmin-guide'; const tips = \"/devtools-tips\"").map(area => area.path), ['/superadmin', '/devtools'])
})

test("a proxy that re-exports core's template has the check; a re-export of anything else does not", () => {
  assert.deepEqual(missingProxyAreas("export { proxy } from '../../../packages/core/templates/proxy'\nexport const config = { matcher: [] }"), [])
  assert.deepEqual(missingProxyAreas("export { proxy } from '@nextsparkjs/core/templates/proxy'"), [])
  assert.deepEqual(missingProxyAreas("export { proxy } from './my-proxy'").map(area => area.path), ['/superadmin', '/devtools'])
  assert.deepEqual(missingProxyAreas("export { other } from '@nextsparkjs/core/templates/proxy'").map(area => area.path), ['/superadmin', '/devtools'])
  const both = ['/superadmin', '/devtools']
  assert.deepEqual(missingProxyAreas("export { proxy as coreProxy } from '@nextsparkjs/core/templates/proxy'\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { other as proxy } from '@nextsparkjs/core/templates/proxy'").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { proxy } from './vendor/core/templates/proxy'").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("// export { proxy } from '@nextsparkjs/core/templates/proxy'\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("/*\nexport { proxy } from '@nextsparkjs/core/templates/proxy'\n*/\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { config, proxy } from '@nextsparkjs/core/templates/proxy.ts'"), [])
})

test('the warning names the file, each missing area, its roles and where the check comes from', () => {
  const notice = proxyAreaNotice('src/proxy.ts', "const PROTECTED = ['/superadmin']")
  assert.equal(notice.code, PROXY_AREA_WARNING)
  assert.deepEqual(notice.areas, ['/devtools'])
  assert.match(notice.message, /^src\/proxy\.ts does not protect \/devtools\./)
  assert.match(notice.message, /\/devtools needs developer/)
  assert.match(notice.message, /facade over @nextsparkjs\/core\/proxy \(see NS_PROXY_FACADE_MISSING\)/)
  assert.equal(proxyAreaNotice('src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), null)
})

test('the proxy Next loads is the one checked; a project without one is not warned about', () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-proxy-areas-'))
  try {
    assert.deepEqual(proxyAreaNotices(root), [])
    write(root, 'src/middleware.ts', PASS_THROUGH)
    assert.deepEqual(proxyAreaNotices(root).map(notice => [notice.target, notice.areas]), [['src/middleware.ts', ['/superadmin', '/devtools']]])
    write(root, 'src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8'))
    assert.deepEqual(proxyAreaNotices(root), [], 'src/proxy.ts wins over src/middleware.ts')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// S80 (D1): the session check that fetched /api/auth/get-session from the request's origin, as every proxy.ts copied
// before 0.1.0-beta.196 does. Upgrading core never touches that copy, so prepare says what to change.
const HTTP_SESSION_CHECK = `function getSession(request: NextRequest) {
  return betterFetch<Session>('/api/auth/get-session', {
    baseURL: \`\${request.nextUrl.origin}\${request.nextUrl.basePath}\`,
    headers: { cookie: request.headers.get('cookie') || '' },
  })
}
const PROTECTED = ['/superadmin', '/devtools']
`

test('a proxy that asks its own /api/auth/get-session over HTTP is warned about, with the in-process call to use', () => {
  const notice = proxySessionNotice('src/proxy.ts', HTTP_SESSION_CHECK)
  assert.equal(notice.code, PROXY_SESSION_WARNING)
  assert.match(notice.message, /^src\/proxy\.ts checks the session by fetching \/api\/auth\/get-session/)
  assert.match(notice.message, /X-Forwarded-Proto: https/)
  assert.match(notice.message, /auth\.api\.getSession\(\{ headers: new Headers\(\{ cookie: request\.headers\.get\('cookie'\) \|\| '' \}\), query: \{ disableRefresh: true, disableCookieCache: true \} \}\)/)
  assert.equal(proxySessionNotice('src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), null)
  assert.equal(proxySessionNotice('src/proxy.ts', "// was: betterFetch('/api/auth/get-session')\nexport function proxy() {}"), null)
  assert.equal(proxySessionNotice('src/proxy.ts', "export { proxy } from '@nextsparkjs/core/templates/proxy'"), null)
})

// The S80 review's measured edges: an end-of-line comment, and a '/*' / '*/' pair inside two string literals.
const COMMENT_EDGES = [
  ['an end-of-line comment after code', "const x = 1 // was '/api/auth/get-session'\nexport function proxy() {}", false],
  ['an end-of-line comment after code, no space', "const x = 1// was '/api/auth/get-session'", false],
  ["a '/*' and a '*/' in two strings around the call", "const a = '/api/*'\nbetterFetch('/api/auth/get-session')\nconst b = 'x*/'", true],
  ["a '//' inside a string before the call", "const u = 'https://example.com'; betterFetch('/api/auth/get-session')", true],
  ['a block comment', "/* betterFetch('/api/auth/get-session') */ export function proxy() {}", false],
  ['a quote escaped inside a string', "const q = 'it\\'s'; betterFetch('/api/auth/get-session')", true],
]

test('comments are stripped wherever they start, and never inside a string literal', () => {
  for (const [label, source, warns] of COMMENT_EDGES) {
    assert.equal(proxySessionNotice('src/proxy.ts', source) !== null, warns, label)
  }
  assert.equal(withoutComments("a // b\nc"), 'a \nc')
  assert.equal(withoutComments("'//' /* x */ \"/*\""), "'//'   \"/*\"")
  // Core's proxy (the code every old template copy holds) reads the same with comments gone: every regex literal in it survives.
  const template = readFileSync(join(CORE_ROOT, 'src/proxy/index.ts'), 'utf8')
  assert.match(withoutComments(template), /\.replace\(\/\\\\\/g, '\/'\)\.replace\(\/\\\/\\\/\+\/g, '\/'\)/)
})

test("the proxy Next loads gets the session warning next to the areas one; core's template gets neither", () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-proxy-session-'))
  try {
    write(root, 'src/proxy.ts', HTTP_SESSION_CHECK)
    assert.deepEqual(proxyAreaNotices(root).map(notice => notice.code), [PROXY_SESSION_WARNING])
    write(root, 'src/proxy.ts', `${HTTP_SESSION_CHECK.replace("['/superadmin', '/devtools']", '[]')}`)
    assert.deepEqual(proxyAreaNotices(root).map(notice => notice.code), [PROXY_AREA_WARNING, PROXY_SESSION_WARNING])
    write(root, 'src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8'))
    assert.deepEqual(proxyAreaNotices(root), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("prepare's prediction carries the warning among its notices", async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  const project = mkdtempSync(join(tmpdir(), 'nextspark-proxy-areas-project-'))
  try {
    symlinkSync(join(CORE_ROOT, 'node_modules'), join(project, 'node_modules'), 'dir')
    write(project, 'src/proxy.ts', PASS_THROUGH)
    const result = await predictHost({ ...host.config, projectRoot: project })
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
    assert.deepEqual(result.notices.filter(notice => notice.code === PROXY_AREA_WARNING).map(notice => notice.areas), [['/superadmin', '/devtools']])
  } finally {
    host.cleanup()
    rmSync(project, { recursive: true, force: true })
  }
})

// The in-process session read of the 0.1.0-beta.196 template, without disableCookieCache.
const BETA_196_SESSION_READ = `async function getSession(request: NextRequest): Promise<Session | null> {
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: request.headers.get('cookie') || '' }),
    query: { disableRefresh: true },
  })
  return session as Session | null
}
`

test('a proxy that reads the session in process from the cookie cache is warned about, with the option to add', () => {
  const notice = proxySessionCachedNotice('src/proxy.ts', BETA_196_SESSION_READ)
  assert.equal(notice.code, PROXY_SESSION_CACHED_WARNING)
  assert.match(notice.message, /^src\/proxy\.ts reads the session with auth\.api\.getSession from Better Auth's cookie cache/)
  assert.match(notice.message, /query: \{ disableRefresh: true, disableCookieCache: true \}/)
  assert.equal(proxySessionCachedNotice('src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), null)
  assert.match(notice.message, /role !== 'suspended'/)
  // the cache option alone is not enough: the proxy must also refuse a suspended account's session
  const cacheOnly = BETA_196_SESSION_READ.replace('disableRefresh: true', 'disableRefresh: true, disableCookieCache: true')
  assert.notEqual(proxySessionCachedNotice('src/proxy.ts', cacheOnly), null)
  assert.equal(proxySessionCachedNotice('src/proxy.ts', cacheOnly.replace('return session as Session | null', "return session && (session.user as { role?: unknown }).role !== 'suspended' ? (session as Session) : null")), null)
  // a comment that names the option does not count
  assert.notEqual(proxySessionCachedNotice('src/proxy.ts', `// disableCookieCache\n${BETA_196_SESSION_READ}`), null)
  // no in-process read (the HTTP check has its own warning), no notice
  assert.equal(proxySessionCachedNotice('src/proxy.ts', HTTP_SESSION_CHECK), null)
})
