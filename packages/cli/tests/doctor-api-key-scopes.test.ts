import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkApiKeyScopes } from '../src/doctor/checks/api-key-scopes.js'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core')

const NEXTSPARK_CONFIG = "export default { plugins: [], template: { name: 'starter', version: '0.0.0' } }\n"
const INTAKE = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function POST(request) {\n  await authenticateRequest(request)\n  return Response.json({ ok: true })\n}\n"
const REPORTS = "import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function GET(request) {\n  await authenticateRequest(request, { requiredScope: 'reports:read' })\n  return Response.json({})\n}\n"
const DECLARED = "export const APP_CONFIG_OVERRIDES = { api: { scopes: { 'reports:read': 'Read reports' } } }\n"

/** A project dir whose installed core is the real one (a link to packages/core), or none, with `files`. */
async function inProject<T>(files: Record<string, string>, core: 'real' | 'old', run: () => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-scopes-'))
  for (const [file, content] of Object.entries({ 'package.json': '{ "name": "scopes-project", "private": true, "dependencies": { "next": "16.0.0" } }\n', 'nextspark.config.ts': NEXTSPARK_CONFIG, ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  fs.mkdirSync(path.join(dir, 'node_modules/@nextsparkjs'), { recursive: true })
  if (core === 'real') fs.symlinkSync(CORE, path.join(dir, 'node_modules/@nextsparkjs/core'), 'dir')
  else fs.mkdirSync(path.join(dir, 'node_modules/@nextsparkjs/core/scripts'), { recursive: true })
  const previous = process.cwd()
  process.chdir(dir)
  try {
    return await run()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('a route that authenticates keys and declares no scope warns with the file, the line and the call, and the fix', async () => {
  const result = await inProject({ 'api/intake/route.ts': INTAKE }, 'real', checkApiKeyScopes)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_API_KEY_ROUTE_WITHOUT_SCOPE')
  assert.match(result.message, /api\/intake\/route\.ts:3 POST authenticateRequest\(request\)/)
  assert.match(result.message, /SCOPE_NOT_DECLARED/)
  assert.match(result.fix ?? '', /^Pass \{ requiredScope: '<scope>' \}.*allowAnyScope: true/)
})

test('a route that requires a scope nothing declares warns; declaring it in api.scopes clears it', async () => {
  const undeclared = await inProject({ 'api/reports/route.ts': REPORTS }, 'real', checkApiKeyScopes)
  assert.equal(undeclared.status, 'warn')
  assert.equal(undeclared.code, 'NS_API_KEY_SCOPE_NOT_DECLARED')
  assert.match(undeclared.message, /api\/reports\/route\.ts:3 GET requires 'reports:read'/)
  assert.match(undeclared.fix ?? '', /^Declare each scope in api\.scopes/)
  const declared = await inProject({ 'api/reports/route.ts': REPORTS, 'config/app.config.ts': DECLARED }, 'real', checkApiKeyScopes)
  assert.equal(declared.status, 'pass')
})

test('both findings are listed, the routes that refuse every key first', async () => {
  const result = await inProject({ 'api/intake/route.ts': INTAKE, 'api/reports/route.ts': REPORTS }, 'real', checkApiKeyScopes)
  assert.equal(result.code, 'NS_API_KEY_ROUTE_WITHOUT_SCOPE')
  assert.match(result.message, /intake.*reports:read/)
})

test('a project without such a route passes', async () => {
  const result = await inProject({ 'api/plain/route.ts': 'export async function GET() { return Response.json({}) }\n' }, 'real', checkApiKeyScopes)
  assert.equal(result.status, 'pass')
})

test('a committed src/app that nextspark migrate has not converted is not checked, and says why', async () => {
  const result = await inProject({ 'api/intake/route.ts': INTAKE, 'src/app/page.tsx': 'export default function Page() { return null }\n' }, 'real', checkApiKeyScopes)
  assert.equal(result.status, 'pass')
  assert.match(result.message, /^Not checked: src\/app is a committed app tree.*nextspark migrate/)
})

test('a core without the search is not checked, and says so', async () => {
  const result = await inProject({ 'api/intake/route.ts': INTAKE }, 'old', checkApiKeyScopes)
  assert.equal(result.status, 'pass')
  assert.match(result.message, /^Not checked/)
})

test('an apiScopes of an enabled plugin that is not a literal is reported, naming the plugin and the file', async () => {
  const config = "export default { plugins: ['shop'], template: { name: 'starter', version: '0.0.0' } }\n"
  const plugin = "import { definePlugin } from '@nextsparkjs/core/types/plugin'\nexport const shopPluginConfig = definePlugin({ name: 'shop', capabilities: ['server'], apiScopes: SCOPES })\nexport default shopPluginConfig\n"
  const result = await inProject({ 'nextspark.config.ts': config, 'plugins/shop/plugin.config.ts': plugin, 'plugins/shop/api/ping/route.ts': 'export async function GET() { return Response.json({}) }\n' }, 'real', checkApiKeyScopes)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_PLUGIN_API_SCOPES_INVALID')
  assert.match(result.message, /apiScopes of shop \(plugins\/shop\/plugin\.config\.ts: .*literal object/)
  assert.match(result.fix ?? '', /^Write apiScopes in the plugin's plugin\.config\.ts/)
})
