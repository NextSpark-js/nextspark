import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCompatShims } from '../src/doctor/checks/compat-shims.js'
import { addCompatRewrites } from '../src/utils/migrate-extras.js'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core')

const NEXTSPARK_CONFIG = "export default { plugins: [], template: { name: 'starter', version: '0.0.0' } }\n"
const ROUTE = (options: string) => `import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport async function POST(request) {\n  await authenticateRequest(request, ${options})\n  return Response.json({ ok: true })\n}\n`
// What migrate writes into next.config (its own function, so the fixture cannot drift from it)
const edited = addCompatRewrites('export default { reactStrictMode: true }\n', 'next.config.mjs', [{ source: '/api/v1/theme/acme/:path*', destination: '/api/:path*' }])
assert.ok('source' in edited)
const PLAIN_PACKAGE = '{ "name": "p", "private": true, "dependencies": { "next": "16.0.0" } }\n'
const NEXT_CONFIG = edited.source

const CLEAN = { 'next.config.mjs': 'export default { reactStrictMode: true }\n', 'api/ok/route.ts': ROUTE("{ requiredScope: 'reports:read' }") }
const MIGRATED = {
  'next.config.mjs': NEXT_CONFIG,
  'api/intake/route.ts': ROUTE('{ allowAnyScope: true }'),
  '.env': 'DATABASE_URL=x\nNEXT_PUBLIC_ACTIVE_THEME=acme\n',
  'package.json': '{\n  "name": "p",\n  "private": true,\n  "dependencies": { "next": "16.0.0" },\n  "scripts": {\n    "dev": "NEXT_PUBLIC_ACTIVE_THEME=acme next dev"\n  }\n}\n',
}

type Results = Awaited<ReturnType<typeof checkCompatShims>>

async function inProject(files: Record<string, string>): Promise<Results> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-compat-'))
  for (const [file, content] of Object.entries({ 'package.json': PLAIN_PACKAGE, 'nextspark.config.ts': NEXTSPARK_CONFIG, ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  fs.mkdirSync(path.join(dir, 'node_modules/@nextsparkjs'), { recursive: true })
  fs.symlinkSync(CORE, path.join(dir, 'node_modules/@nextsparkjs/core'), 'dir')
  const previous = process.cwd()
  process.chdir(dir)
  try {
    return await checkCompatShims()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const codes = (results: Results) => results.map(result => result.code)

test('a migrated project lists the three shims, each with where it is and how to remove it', async () => {
  const results = await inProject(MIGRATED)
  assert.deepEqual(codes(results), ['NS_COMPAT_API_REWRITE', 'NS_COMPAT_ALLOW_ANY_SCOPE', 'NS_COMPAT_THEME_LEFTOVER'])
  for (const result of results) {
    assert.equal(result.status, 'warn')
    assert.ok(result.fix, result.name)
  }
  const [rewrite, scope, theme] = results
  assert.match(rewrite.message, /next\.config\.mjs:\d+ rewrites the old API URLs \(\/api\/v1\/theme\/acme\/:path\*\)/)
  assert.match(rewrite.message, /installed mobile apps/)
  assert.match(rewrite.fix ?? '', /delete the nextspark-compat-rewrites block/)
  assert.match(scope.message, /api\/intake\/route\.ts:3 POST authenticateRequest\(request, \{ allowAnyScope: true \}\)/)
  assert.match(scope.fix ?? '', /requiredScope/)
  assert.match(theme.message, /\.env:2, package\.json:6 \(script dev\)/)
  assert.match(theme.message, /NEXT_PUBLIC_ACTIVE_THEME in code is not/)
})

test('a project created by the wizard shows none', async () => {
  const results = await inProject(CLEAN)
  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'pass')
  assert.match(results[0].message, /^No 0\.x compatibility shims/)
})

test('removing one shim stops listing it and keeps the others', async () => {
  const withoutRewrite = await inProject({ ...MIGRATED, 'next.config.mjs': 'export default {}\n' })
  assert.deepEqual(codes(withoutRewrite), ['NS_COMPAT_ALLOW_ANY_SCOPE', 'NS_COMPAT_THEME_LEFTOVER'])
  const withoutScope = await inProject({ ...MIGRATED, 'api/intake/route.ts': ROUTE("{ requiredScope: 'reports:read' }") })
  assert.deepEqual(codes(withoutScope), ['NS_COMPAT_API_REWRITE', 'NS_COMPAT_THEME_LEFTOVER'])
  const withoutTheme = await inProject({ ...MIGRATED, '.env': 'DATABASE_URL=x\n', 'package.json': PLAIN_PACKAGE })
  assert.deepEqual(codes(withoutTheme), ['NS_COMPAT_API_REWRITE', 'NS_COMPAT_ALLOW_ANY_SCOPE'])
})

test('a rewrite merged by hand is recognized by its paths and says it could not be sure', async () => {
  const config = "export default { async rewrites() { return [{ source: '/api/v1/theme/acme/:path*', destination: '/api/:path*' }] } }\n"
  const results = await inProject({ ...CLEAN, 'next.config.mjs': config })
  assert.deepEqual(codes(results), ['NS_COMPAT_API_REWRITE'])
  assert.match(results[0].message, /merged by hand/)
})

test('routes that cannot be read are said, not guessed', async () => {
  const results = await inProject({ ...CLEAN, 'src/app/page.tsx': 'export default function Page() { return null }\n' })
  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'warn')
  assert.match(results[0].message, /^Routes with allowAnyScope not checked: src\/app is a committed app tree/)
  assert.match(results[0].fix ?? '', /^Fix what the reason says/)
})

test('a rewrite listed with routes that could not be read keeps the note, as a result of its own', async () => {
  const results = await inProject({ ...CLEAN, 'next.config.mjs': NEXT_CONFIG, 'src/app/page.tsx': 'export default function Page() { return null }\n' })
  assert.deepEqual(results.map(result => result.name), ['Compat: rewrite', 'Compat: API keys'])
  assert.match(results[1].message, /^Routes with allowAnyScope not checked: src\/app is a committed app tree/)
})

test('ROOT_FIRST_PROJECT in code is listed with file and line; generated code, dependencies and NEXT_PUBLIC_ACTIVE_THEME in code are not', async () => {
  const results = await inProject({
    ...CLEAN,
    'lib/theme.ts': 'export const a = 1\nexport const theme = process.env.ROOT_FIRST_PROJECT\n',
    'src/app/page.tsx': 'const x = "ROOT_FIRST_PROJECT"\n',
    'node_modules/dep/index.js': 'ROOT_FIRST_PROJECT\n',
    'build/x.js': 'ROOT_FIRST_PROJECT\n',
    'out/x.js': 'ROOT_FIRST_PROJECT\n',
    'coverage/x.js': 'ROOT_FIRST_PROJECT\n',
    '.turbo/x.js': 'ROOT_FIRST_PROJECT\n',
    'lib/other.ts': 'const y = process.env.NEXT_PUBLIC_ACTIVE_THEME\n',
  })
  // (the src/app of the fixture also makes the routes unreadable, which is its own result)
  const theme = results.filter(result => result.code === 'NS_COMPAT_THEME_LEFTOVER')
  assert.equal(theme.length, 1)
  assert.match(theme[0].message, /lib\/theme\.ts:2/)
  assert.doesNotMatch(theme[0].message, /src\/app|node_modules|lib\/other|build|out\/|coverage|\.turbo/)
  assert.match(theme[0].message, /git grep -n -e NEXT_PUBLIC_ACTIVE_THEME -e ROOT_FIRST_PROJECT/)
})

test('a commented line of an .env file does not count', async () => {
  const results = await inProject({ ...CLEAN, '.env': '# NEXT_PUBLIC_ACTIVE_THEME=acme\n  # ROOT_FIRST_PROJECT=1\nDATABASE_URL=x\n' })
  assert.equal(results[0].status, 'pass')
})

test('the allowAnyScope message does not blame a migration', async () => {
  const results = await inProject({ ...CLEAN, 'api/intake/route.ts': ROUTE('{ allowAnyScope: true }') })
  assert.deepEqual(codes(results), ['NS_COMPAT_ALLOW_ANY_SCOPE'])
  assert.match(results[0].message, /0\.x routes did this by default, and a migrated project keeps them/)
})
