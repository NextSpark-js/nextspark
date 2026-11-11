/**
 * API-key scopes the routes of a project declare (#426): a route that authenticates keys without requiredScope or
 * allowAnyScope (every key is refused at runtime), and a route that requires a scope nothing declares. Both are plan
 * notices of `nextspark prepare`, read from the route sources without running them.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-api-key-scopes.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  API_KEY_NO_SCOPE_WARNING,
  API_KEY_UNDECLARED_SCOPE_WARNING,
  CORE_API_SCOPES,
  readDeclaredApiScopes,
  scanApiKeyCalls,
} from '../../../../maintenance/api-key-scopes.mjs'
import { loadTypeScriptFor } from '../../shared/typescript-compiler.mjs'
import { checkHost, predictHost, prepareHost } from '../prepare.mjs'
import { CORE_ROOT, tempHost } from './host-helpers.mjs'

const ts = await loadTypeScriptFor(CORE_ROOT)
const DUAL = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\n"
const scan = (body, header = DUAL) => scanApiKeyCalls({ source: `${header}${body}\n`, file: 'route.ts', ts })
const declaredOf = body => scan(body).map(call => call.declared)

test('a call without options, with an empty object, or whose scope list is empty declares nothing', () => {
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r) }'), ['none'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, {}) }'), ['none'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, undefined) }'), ['none'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { requiredScope: [] }) }'), ['none'])
  assert.deepEqual(declaredOf("export async function GET(r) { await authenticateRequest(r, { requiredScope: '' }) }"), ['none'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { allowAnyScope: false }) }'), ['none'])
})

test('a call that declares nothing in a function that checks the result is a session is a session-only route, not a finding', () => {
  assert.deepEqual(declaredOf("export async function GET(r) { const auth = await authenticateRequest(r); if (auth.type !== 'session') return null }"), ['session'])
  assert.deepEqual(declaredOf("export const GET = limit(async (r) => { const auth = await authenticateRequest(r); if (!auth.success || auth.type !== 'session') return null }, 'api')"), ['session'])
  assert.deepEqual(declaredOf("export async function GET(r) { const auth = await authenticateRequest(r); return auth.type === 'session' ? a() : b() }"), ['session'])
  // the check has to be in the function that makes the call, and on the type of the result
  assert.deepEqual(declaredOf("function other(a) { return a.type === 'session' }\nexport async function GET(r) { await authenticateRequest(r) }"), ['none'])
  assert.deepEqual(declaredOf("export async function GET(r) { await authenticateRequest(r); return r.kind === 'session' }"), ['none'])
  assert.deepEqual(declaredOf("export async function GET(r) { await authenticateRequest(r); return r.type === 'other' }"), ['none'])
})

test('requiredScope as a string or a list, and allowAnyScope: true, declare something', () => {
  const [one] = scan("export async function GET(r) { await authenticateRequest(r, { requiredScope: 'reports:read' }) }")
  assert.deepEqual([one.declared, one.scopes], ['scopes', ['reports:read']])
  const [list] = scan("export async function GET(r) { await authenticateRequest(r, { requiredScope: ['a:read', \"b:read\"] }) }")
  assert.deepEqual(list.scopes, ['a:read', 'b:read'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { allowAnyScope: true }) }'), ['any'])
})

test('options bound to a name in the same file are followed once; what cannot be read declares "unknown", never "none"', () => {
  assert.deepEqual(declaredOf("const AUTH = { requiredScope: 'reports:read' }\nexport async function GET(r) { await authenticateRequest(r, AUTH) }").length, 1)
  assert.equal(scan("const AUTH = { requiredScope: 'reports:read' }\nexport async function GET(r) { await authenticateRequest(r, AUTH) }")[0].declared, 'scopes')
  assert.equal(scan("const AUTH = {}\nexport async function GET(r) { await authenticateRequest(r, AUTH) }")[0].declared, 'none')
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, optionsFromElsewhere) }'), ['unknown'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, buildOptions()) }'), ['unknown'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { ...base }) }'), ['unknown'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { requiredScope: scopeFor(r) }) }'), ['unknown'])
  assert.deepEqual(declaredOf('export async function GET(r) { await authenticateRequest(r, { requiredScope: process.env.SCOPE }) }'), ['unknown'])
  // an explicit scope next to a spread still counts
  assert.equal(scan("export async function GET(r) { await authenticateRequest(r, { ...base, requiredScope: 'a:read' }) }")[0].declared, 'scopes')
})

test('the entry points are found renamed, through a namespace import, and as validateAndAuthenticateRequest; other functions of that name are not', () => {
  const [renamed] = scan('export async function GET(r) { await check(r) }', "import { authenticateRequest as check } from '@nextsparkjs/core/lib/api/auth/dual-auth'\n")
  assert.equal(renamed.entry, 'authenticateRequest')
  const [viaNamespace] = scan('export async function POST(r) { await dual.authenticateRequest(r) }', "import * as dual from '@nextsparkjs/core/lib/api/auth/dual-auth'\n")
  assert.equal(viaNamespace.method, 'POST')
  const [helper] = scan("export const PUT = async (r) => { await validateAndAuthenticateRequest(r, { requiredScope: 'x:read' }) }", "import { validateAndAuthenticateRequest } from '@nextsparkjs/core/lib/api/helpers'\n")
  assert.deepEqual([helper.entry, helper.method, helper.declared], ['validateAndAuthenticateRequest', 'PUT', 'scopes'])
  assert.deepEqual(scan('export async function GET(r) { await authenticateRequest(r) }', "import { authenticateRequest } from '@/lib/my-auth'\n"), [])
  assert.deepEqual(scan('export async function GET(r) { await authenticateRequest(r) }', "import type { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\n"), [])
  assert.deepEqual(scan('export async function GET(r) { await authenticateRequest(r) }', "import { createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'\n"), [])
})

test('every call is reported with its line, method and text', () => {
  const found = scan("export async function GET(r) {\n  await authenticateRequest(r, { requiredScope: 'a:read' })\n}\nexport const POST = withLogging(async (r) => {\n  const result = await authenticateRequest(\n    r,\n  )\n})")
  assert.deepEqual(found.map(call => [call.line, call.method, call.declared]), [[3, 'GET', 'scopes'], [6, 'POST', 'none']])
  assert.equal(found[1].call, 'authenticateRequest( r, )')
})

test('a module TypeScript cannot parse is not read', () => {
  assert.deepEqual(scan('export async function GET(r) { await authenticateRequest(r, { '), [])
})

const config = body => `export const APP_CONFIG_OVERRIDES = ${body}\n`
const declared = (content, files = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-scopes-'))
  try {
    for (const [path, text] of Object.entries(content === null ? files : { 'config/app.config.ts': content, ...files })) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    const { scopes, complete } = readDeclaredApiScopes({ projectRoot: root, ts })
    return { scopes: [...scopes].sort(), complete }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('api.scopes is read when written as literals; a spread, a computed key or a value from elsewhere makes the list incomplete', () => {
  assert.deepEqual(declared(config("{ api: { scopes: { 'reports:read': 'Read', \"reports:write\": 'Write', plain: 'x', ['a:b']: 'y' }, cors: {} } }")), { scopes: ['a:b', 'plain', 'reports:read', 'reports:write'], complete: true })
  assert.deepEqual(declared(config('{ api: { cors: {} } }')), { scopes: [], complete: true })
  assert.deepEqual(declared(null), { scopes: [], complete: true }, 'no app.config.ts: core declares none of its own')
  assert.equal(declared(config("{ api: { scopes: { 'a:b': 'x', ...EXTRA } } }")).complete, false)
  assert.equal(declared(config("{ api: { scopes: { [name]: 'x' } } }")).complete, false)
  assert.equal(declared(config('{ api: { scopes: SCOPES } }')).complete, false)
  assert.equal(declared(config('{ api: API_CONFIG }')).complete, false)
  assert.equal(declared(config('{ ...BASE, userRoles: [] }')).complete, false, 'scopes may come in through the spread')
  assert.equal(declared('export const APP_CONFIG_OVERRIDES = {').complete, false, 'a config that does not parse')
})

const INTAKE = "import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function POST(request) {\n  const authResult = await authenticateRequest(request)\n  if (!authResult.success) return createAuthFailureResponse(authResult)\n  return Response.json({ ok: true })\n}\n"
const REPORTS = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function GET(request) {\n  await authenticateRequest(request, { requiredScope: 'reports:read' })\n  return Response.json({})\n}\n"
const TASKS = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function GET(request) {\n  await authenticateRequest(request, { requiredScope: ['tasks:read', 'tasks:write'] })\n  return Response.json({})\n}\n"
const OPEN = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function GET(request) {\n  await authenticateRequest(request, { allowAnyScope: true })\n  return Response.json({})\n}\n"

async function noticesOf(files) {
  const host = tempHost(files)
  try {
    const { ok, notices } = await predictHost(host.config)
    return { ok, notices: notices.filter(notice => notice.code === API_KEY_NO_SCOPE_WARNING || notice.code === API_KEY_UNDECLARED_SCOPE_WARNING) }
  } finally {
    host.cleanup()
  }
}

test('prepare: a route with no scope declaration and a route requiring an undeclared scope are reported, with file, line and call', async () => {
  const { ok, notices } = await noticesOf({ 'api/intake/route.ts': INTAKE, 'api/reports/route.ts': REPORTS, 'api/tasks/route.ts': TASKS, 'api/open/route.ts': OPEN })
  assert.equal(ok, true)
  assert.deepEqual(notices.map(notice => notice.code), [API_KEY_NO_SCOPE_WARNING, API_KEY_UNDECLARED_SCOPE_WARNING])
  const [noScope, undeclared] = notices
  assert.deepEqual(noScope.findings.map(finding => [finding.url, finding.source, finding.line, finding.method, finding.call]), [['/api/intake', 'api/intake/route.ts', 3, 'POST', 'authenticateRequest(request)']])
  assert.match(noScope.message, /api\/intake\/route\.ts:3 POST authenticateRequest\(request\)/)
  assert.match(noScope.message, /SCOPE_NOT_DECLARED/)
  assert.match(noScope.message, /requiredScope/)
  assert.match(noScope.message, /allowAnyScope/)
  assert.deepEqual(undeclared.findings.map(finding => [finding.source, finding.line, finding.scope]), [['api/reports/route.ts', 3, 'reports:read']])
  assert.match(undeclared.message, /api\/reports\/route\.ts:3 GET requires 'reports:read'/)
  assert.match(undeclared.message, /api\.scopes/)
  assert.match(undeclared.message, /config\/app\.config\.ts/)
})

test('prepare: a scope declared in api.scopes is no finding, and neither is a core scope; the missing declaration stays one', async () => {
  const files = { 'api/intake/route.ts': INTAKE, 'api/reports/route.ts': REPORTS, 'api/tasks/route.ts': TASKS }
  const declared = await noticesOf({ ...files, 'config/app.config.ts': config("{ api: { scopes: { 'reports:read': 'Read reports' } } }") })
  assert.deepEqual(declared.notices.map(notice => notice.code), [API_KEY_NO_SCOPE_WARNING])
  const fixed = await noticesOf({ ...files, 'api/intake/route.ts': INTAKE.replace('authenticateRequest(request)', "authenticateRequest(request, { requiredScope: 'tasks:write' })"), 'config/app.config.ts': config("{ api: { scopes: { 'reports:read': 'Read reports' } } }") })
  assert.deepEqual(fixed.notices, [])
})

test('prepare: an api.scopes the file does not write as literals claims nothing about undeclared scopes, but a route with no declaration is still one', async () => {
  const { notices } = await noticesOf({ 'api/intake/route.ts': INTAKE, 'api/reports/route.ts': REPORTS, 'config/app.config.ts': config('{ api: { scopes: PROJECT_SCOPES } }') })
  assert.deepEqual(notices.map(notice => notice.code), [API_KEY_NO_SCOPE_WARNING])
})

test('prepare: a plugin route is looked at against the scopes of the project', async () => {
  const host = tempHost({ 'plugins/shop/api/orders/route.ts': REPORTS, 'plugins/shop/api/ping/route.ts': INTAKE })
  try {
    const config = { ...host.config, plugins: [{ name: 'shop', root: join(host.source, 'plugins/shop'), importBase: '@/plugins/shop' }] }
    const { ok, notices } = await predictHost(config)
    const found = notices.filter(notice => notice.code === API_KEY_NO_SCOPE_WARNING || notice.code === API_KEY_UNDECLARED_SCOPE_WARNING)
    assert.equal(ok, true)
    assert.deepEqual(found.map(notice => [notice.code, notice.findings[0].url]), [[API_KEY_NO_SCOPE_WARNING, '/api/plugins/shop/ping'], [API_KEY_UNDECLARED_SCOPE_WARNING, '/api/plugins/shop/orders']])
  } finally {
    host.cleanup()
  }
})

test('prepare --check carries the notices, up to date or not, and nothing extra when there are none', async () => {
  const host = tempHost({ 'api/intake/route.ts': INTAKE })
  try {
    await prepareHost(host.config)
    const upToDate = await checkHost(host.config)
    assert.equal(upToDate.ok, true)
    assert.deepEqual(upToDate.notices.map(notice => notice.code), [API_KEY_NO_SCOPE_WARNING])
    writeFileSync(join(host.source, 'api/intake/route.ts'), INTAKE.replace('authenticateRequest(request)', "authenticateRequest(request, { requiredScope: 'tasks:read' })"))
    const stale = await checkHost(host.config)
    assert.equal(stale.ok, false, 'the source changed, so the host is stale')
    assert.equal(stale.notices, undefined, 'the declaration is there now: no notice, and the result keeps its shape')
  } finally {
    host.cleanup()
  }
})

test('prepare: routes that authenticate nothing, and a project with no route, give no notice', async () => {
  assert.deepEqual((await noticesOf({ 'api/plain/route.ts': 'export async function GET() { return Response.json({}) }\n' })).notices, [])
  assert.deepEqual((await noticesOf({})).notices, [])
})

test("the scopes core enforces are listed once here: API_SCOPES of lib/api/keys.ts has exactly these", async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(join(CORE_ROOT, 'src/lib/api/keys.ts'), 'utf8')
  const block = source.slice(source.indexOf('export const API_SCOPES = {'), source.indexOf('} as const', source.indexOf('export const API_SCOPES = {')))
  const keys = [...block.matchAll(/^\s*'([^']+)':/gm)].map(match => match[1])
  assert.deepEqual([...CORE_API_SCOPES].sort(), keys.sort())
})
