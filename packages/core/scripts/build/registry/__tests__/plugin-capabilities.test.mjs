import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'

import { discoverPlugins } from '../discovery/plugins.mjs'
import { mergeEntities } from '../discovery/all-entities.mjs'
import {
  LEGACY_CAPABILITIES,
  PLUGIN_DIAGNOSTICS,
  CLIENT_SAFE_CORE_API,
  PluginCapabilityError,
  assertNoPluginCollisions,
  capabilitiesOf,
  checkPluginContributions,
  exportsTarget,
  pluginCollisions,
  pluginsFor,
  readPluginDeclaration,
  serverOnlySpecifier,
  withDeclaredCapabilities,
} from '../discovery/plugin-capabilities.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { generatePluginCatalog } from '../generators/plugin-catalog.mjs'
import { generatePluginRegistry, generatePluginRegistryClient } from '../generators/plugin-registry.mjs'
import { planHost } from '../host/plan.mjs'
import { PrepareError, renderHostFiles } from '../host/prepare.mjs'

const PAGE = 'export default function Page() { return null }\n'
const ROUTE = 'export async function GET() { return Response.json({}) }\n'

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-plugin-caps-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const config = (name, capabilities) =>
  `import { definePlugin } from '@nextsparkjs/core/types/plugin'\nexport const ${name}PluginConfig = definePlugin({ name: '${name}', capabilities: ${capabilities} })\nexport default ${name}PluginConfig\n`

const legacyConfig = name => `export const ${name}PluginConfig = { name: '${name}', displayName: '${name}', version: '1.0.0', enabled: true }\n`

const sourceOf = (root, name) => ({ name, sourceDir: join(root, 'plugins', name), importBase: `@/plugins/${name}`, kind: 'local' })

async function check(files, name = 'demo') {
  const { root, cleanup } = project(files)
  try {
    const ts = await loadTypeScriptFor(root)
    const declaration = readPluginDeclaration(ts, { plugin: name, configFile: join(root, 'plugins', name, 'plugin.config.ts'), exportName: `${name}PluginConfig` })
    const plugin = { ...sourceOf(root, name), capabilities: declaration.capabilities ?? [...LEGACY_CAPABILITIES] }
    return { declaration, diagnostics: checkPluginContributions(ts, { plugin, plugins: [plugin], projectRoot: root }), root }
  } finally {
    cleanup()
  }
}

const codes = diagnostics => diagnostics.map(d => d.code)

test('definePlugin declarations are read statically', async () => {
  const cases = [
    [config('demo', "['server', 'web']"), true, ['server', 'web']],
    [config('demo', "['web', 'web', 'mobile']"), true, ['web', 'mobile']],
    [legacyConfig('demo'), false, null],
    ["export const demoPluginConfig = { name: 'demo', capabilities: ['build'] }\n", true, ['build']],
    ["export const demoPluginConfig: PluginConfig = definePlugin({ name: 'demo', capabilities: ['server'] as const })\n", true, ['server']],
  ]
  for (const [source, declared, expected] of cases) {
    const { declaration } = await check({ 'plugins/demo/plugin.config.ts': source })
    assert.equal(declaration.declared, declared, source)
    assert.deepEqual(declaration.capabilities, expected, source)
    assert.deepEqual(declaration.diagnostics, [])
  }
})

test('an invalid declaration is a diagnostic naming the plugin', async () => {
  for (const capabilities of ["['edge']", '[]', 'CAPS', "[...OTHERS, 'web']", '"server"']) {
    const { declaration } = await check({ 'plugins/demo/plugin.config.ts': `const CAPS = ['web']\nexport const demoPluginConfig = definePlugin({ name: 'demo', capabilities: ${capabilities} })\n` })
    assert.equal(declaration.diagnostics.length, 1, capabilities)
    assert.equal(declaration.diagnostics[0].code, PLUGIN_DIAGNOSTICS.INVALID)
    assert.equal(declaration.diagnostics[0].plugin, 'demo')
    assert.match(declaration.diagnostics[0].message, /plugins\/demo\/plugin\.config\.ts/)
  }
  const { declaration } = await check({ 'plugins/demo/plugin.config.ts': "export const demoPluginConfig = definePlugin({ name: 'demo' })\n" })
  assert.match(declaration.diagnostics[0].message, /requires a literal `capabilities` array/)
})

test('a legacy plugin is server + web + build and a declared one only what it lists', () => {
  assert.deepEqual(capabilitiesOf({}), ['server', 'web', 'build'])
  assert.deepEqual(capabilitiesOf({ capabilities: ['web'] }), ['web'])
  const plugins = [{ name: 'a', capabilities: ['web'] }, { name: 'b', capabilities: ['server', 'build'] }, { name: 'c' }]
  assert.deepEqual(pluginsFor(plugins, 'server').map(p => p.name), ['b', 'c'])
  assert.deepEqual(pluginsFor(plugins, 'web').map(p => p.name), ['a', 'c'])
  assert.deepEqual(pluginsFor(plugins, 'mobile').map(p => p.name), [])
})

test('a file in a surface the plugin did not declare names the plugin, the capability and the file', async () => {
  const cases = [
    ['web', { 'plugins/demo/api/hello/route.ts': ROUTE }, 'server', 'api/hello/route.ts'],
    ['server', { 'plugins/demo/templates/hello/page.tsx': PAGE }, 'web', 'templates/hello/page.tsx'],
    ['server', { 'plugins/demo/components/Widget.tsx': PAGE }, 'web', 'components/Widget.tsx'],
    ['server', { 'plugins/demo/lib/panel.tsx': `'use client'\n${PAGE}` }, 'web', 'lib/panel.tsx'],
    ['server', { 'plugins/demo/messages/en.json': '{}' }, 'web', 'messages/en.json'],
    ['web', { 'plugins/demo/entities/tasks/tasks.config.ts': 'export const tasksConfig = {}\n' }, 'server', 'entities/tasks/tasks.config.ts'],
    ['web', { 'plugins/demo/plugin.pages.server.ts': 'export const devtoolsPage = null\n' }, 'server', 'plugin.pages.server.ts'],
    ['server', { 'plugins/demo/mobile/index.ts': 'export const screen = 1\n' }, 'mobile', 'mobile/index.ts'],
    ['server', { 'plugins/demo/build/codemod.ts': 'export const run = 1\n' }, 'build', 'build/codemod.ts'],
  ]
  for (const [declared, files, capability, file] of cases) {
    const { diagnostics } = await check({ 'plugins/demo/plugin.config.ts': config('demo', `['${declared}']`), ...files })
    const hit = diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.UNDECLARED)
    assert.equal(hit.length, 1, `${declared} + ${file}: ${JSON.stringify(diagnostics)}`)
    assert.equal(hit[0].plugin, 'demo')
    assert.equal(hit[0].capability, capability)
    assert.equal(hit[0].file, file)
    assert.match(hit[0].message, new RegExp(`plugins/demo/${file.replace(/[.]/g, '\\.')}`))
    assert.match(hit[0].message, new RegExp(`"${capability}"`))
  }
})

test('declaring the capability makes the same files valid; tests, docs and node_modules are not contributions', async () => {
  const { diagnostics } = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web', 'build', 'mobile']"),
    'plugins/demo/api/hello/route.ts': ROUTE,
    'plugins/demo/templates/hello/page.tsx': PAGE,
    'plugins/demo/mobile/index.ts': 'export const screen = 1\n',
    'plugins/demo/build/codemod.ts': 'export const run = 1\n',
  })
  assert.deepEqual(diagnostics, [])
  const quiet = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server']"),
    'plugins/demo/api/hello/route.ts': ROUTE,
    'plugins/demo/__tests__/panel.test.tsx': `'use client'\n${PAGE}`,
    'plugins/demo/docs/notes.tsx': `'use client'\n${PAGE}`,
    'plugins/demo/node_modules/dep/index.js': "'use client'\n",
    'plugins/demo/lib/panel.test.tsx': `'use client'\n${PAGE}`,
  })
  assert.deepEqual(quiet.diagnostics, [])
})

test('a web entry must not reach server-only code, directly or transitively', async () => {
  const cases = [
    ['a server-only marker', "import 'server-only'\nexport const x = 1\n", /server-only module "server-only"/],
    ['a Node built-in', "import { readFileSync } from 'node:fs'\nexport const x = readFileSync\n", /Node built-in "node:fs"/],
    ['a bare Node built-in', "import path from 'path'\nexport const x = path\n", /Node built-in "path"/],
    ['next/headers', "import { cookies } from 'next/headers'\nexport const x = cookies\n", /"next\/headers"/],
    ['the core database module', "import { queryWithRLS } from '@nextsparkjs/core/lib/db'\nexport const x = queryWithRLS\n", /core\/lib\/db/],
  ]
  for (const [name, serverModule, pattern] of cases) {
    const { diagnostics } = await check({
      'plugins/demo/plugin.config.ts': config('demo', "['web']"),
      'plugins/demo/components/Widget.tsx': "import { helper } from '../lib/helper'\nexport default function Widget() { return helper }\n",
      'plugins/demo/lib/helper.ts': "export { x as helper } from './server-part'\n",
      'plugins/demo/lib/server-part.ts': serverModule,
    })
    const hit = diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT)
    assert.equal(hit.length, 1, `${name}: ${JSON.stringify(diagnostics)}`)
    assert.equal(hit[0].plugin, 'demo')
    assert.equal(hit[0].capability, 'web')
    assert.equal(hit[0].file, 'plugins/demo/lib/server-part.ts')
    assert.match(hit[0].message, pattern)
    assert.match(hit[0].message, /plugins\/demo\/components\/Widget\.tsx -> plugins\/demo\/lib\/helper\.ts/)
  }
})

test("a web entry importing the plugin's own api/ or *.server module is a violation; type-only imports are not", async () => {
  const { diagnostics } = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web']"),
    'plugins/demo/api/hello/route.ts': `${ROUTE}export const shape = 1\n`,
    'plugins/demo/lib/store.server.ts': 'export const store = {}\n',
    'plugins/demo/components/Widget.tsx': "import { shape } from '../api/hello/route'\nimport { store } from '../lib/store.server'\nimport type { Thing } from '../lib/types-only'\nimport { type Other } from '../lib/other-types'\nexport default function Widget() { return [shape, store] }\n",
    'plugins/demo/lib/types-only.ts': "import 'server-only'\nexport type Thing = {}\n",
    'plugins/demo/lib/other-types.ts': "import 'server-only'\nexport type Other = {}\n",
  })
  const hit = diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT)
  assert.deepEqual(hit.map(d => d.file), ['plugins/demo/api/hello/route.ts', 'plugins/demo/lib/store.server.ts'])
})

test("a 'use client' file and the config of a web plugin are web entries; the config of a server-only plugin is not", async () => {
  const web = await check({
    'plugins/demo/plugin.config.ts': `import { secret } from './lib/secret'\n${config('demo', "['server', 'web']")}`,
    'plugins/demo/lib/secret.ts': "import 'server-only'\nexport const secret = 1\n",
  })
  assert.deepEqual(codes(web.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
  assert.equal(web.diagnostics[0].file, 'plugins/demo/lib/secret.ts')
  const client = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web']"),
    'plugins/demo/lib/panel.tsx': "'use client'\nimport { secret } from './secret'\nexport default () => secret\n",
    'plugins/demo/lib/secret.ts': "import 'server-only'\nexport const secret = 1\n",
  })
  assert.deepEqual(codes(client.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
  const server = await check({
    'plugins/demo/plugin.config.ts': `import { secret } from './lib/secret'\n${config('demo', "['server']")}`,
    'plugins/demo/lib/secret.ts': "import 'server-only'\nexport const secret = 1\n",
    'plugins/demo/api/hello/route.ts': "import { secret } from '../../lib/secret'\nexport async function GET() { return Response.json({ secret }) }\n",
  })
  assert.deepEqual(server.diagnostics, [])
})

test('a mobile plugin cannot reach server code; a mobile entry over shared code is fine', async () => {
  const bad = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['mobile']"),
    'plugins/demo/mobile/index.ts': "import { db } from '../lib/db'\nexport const screen = db\n",
    'plugins/demo/lib/db.ts': "import { Pool } from 'pg'\nexport const db = Pool\n",
  })
  assert.deepEqual(codes(bad.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
  assert.equal(bad.diagnostics[0].capability, 'mobile')
  assert.equal(bad.diagnostics[0].file, 'plugins/demo/lib/db.ts')
  const good = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['mobile']"),
    'plugins/demo/mobile/index.ts': "import { format } from '../lib/format'\nexport const screen = format\n",
    'plugins/demo/lib/format.ts': 'export const format = String\n',
  })
  assert.deepEqual(good.diagnostics, [])
})

test('build-only code never enters a runtime bundle', async () => {
  const bad = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web', 'build']"),
    'plugins/demo/api/hello/route.ts': "import { generate } from '../../build/generate'\nexport async function GET() { return Response.json(generate()) }\n",
    'plugins/demo/build/generate.ts': 'export const generate = () => ({})\n',
    'plugins/demo/components/Widget.tsx': "import { generate } from '../build/generate'\nexport default () => generate()\n",
  })
  const hit = bad.diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.BUILD_IN_RUNTIME)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].capability, 'build')
  assert.equal(hit[0].file, 'plugins/demo/build/generate.ts')
  assert.match(hit[0].message, /plugins\/demo\/(api\/hello\/route\.ts|components\/Widget\.tsx)/)
  const good = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'build']"),
    'plugins/demo/api/hello/route.ts': ROUTE,
    'plugins/demo/build/generate.ts': "import { readFileSync } from 'node:fs'\nexport const generate = () => readFileSync\n",
  })
  assert.deepEqual(good.diagnostics, [])
  const buildOnly = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['build']"),
    'plugins/demo/build/generate.ts': "import 'server-only'\nexport const generate = 1\n",
  })
  assert.deepEqual(buildOnly.diagnostics, [])
})

test('a plugin reaching another plugin server code from a web entry names both', async () => {
  const { root, cleanup } = project({
    'plugins/a/plugin.config.ts': config('a', "['web']"),
    'plugins/a/components/Widget.tsx': "import { store } from '@/plugins/b/lib/store'\nexport default () => store\n",
    'plugins/b/plugin.config.ts': config('b', "['server']"),
    'plugins/b/lib/store.ts': "import 'server-only'\nexport const store = {}\n",
  })
  try {
    const ts = await loadTypeScriptFor(root)
    const a = { ...sourceOf(root, 'a'), capabilities: ['web'] }
    const b = { ...sourceOf(root, 'b'), capabilities: ['server'] }
    const diagnostics = checkPluginContributions(ts, { plugin: a, plugins: [a, b] })
    assert.deepEqual(codes(diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
    assert.equal(diagnostics[0].plugin, 'a')
    assert.equal(diagnostics[0].file, 'plugins/b/lib/store.ts')
    assert.match(diagnostics[0].message, /plugins\/a\/components\/Widget\.tsx -> plugins\/b\/lib\/store\.ts/)
  } finally {
    cleanup()
  }
})

const corePackage = extra => ({
  'node_modules/@nextsparkjs/core/package.json': JSON.stringify({
    name: '@nextsparkjs/core',
    type: 'module',
    exports: { './lib/*': { types: './dist/lib/*.d.ts', import: './dist/lib/*.js' }, './hooks/*': { types: './dist/hooks/*.d.ts', import: './dist/hooks/*.js' } },
  }),
  'node_modules/@nextsparkjs/core/dist/lib/locale.js': "import { headers } from 'next/headers'\nexport const getLocale = () => headers()\n",
  'node_modules/@nextsparkjs/core/dist/lib/locale.d.ts': 'export declare const getLocale: () => unknown\n',
  'node_modules/@nextsparkjs/core/dist/lib/format.js': 'export const format = String\n',
  'node_modules/@nextsparkjs/core/dist/lib/format.d.ts': 'export declare const format: StringConstructor\n',
  'node_modules/@nextsparkjs/core/dist/lib/barrel.js': "export * from './locale.js'\nexport { format } from './format.js'\n",
  'node_modules/@nextsparkjs/core/dist/lib/barrel.d.ts': 'export {}\n',
  ...extra,
})

test('a web entry reaching server-only code through a core module is a violation (transitive, from dist)', async () => {
  const web = "import { getLocale } from '@nextsparkjs/core/lib/locale'\nexport default function Widget() { return getLocale() }\n"
  const { diagnostics } = await check({
    ...corePackage(),
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': web,
  })
  const hit = diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT)
  assert.equal(hit.length, 1, JSON.stringify(diagnostics))
  assert.equal(hit[0].plugin, 'demo')
  assert.equal(hit[0].capability, 'web')
  assert.match(hit[0].message, /next\/headers/)
  assert.match(hit[0].message, /plugins\/demo\/components\/Widget\.tsx -> @nextsparkjs\/core\/dist\/lib\/locale\.js/)
  // a re-export barrel is followed too
  const barrel = await check({ ...corePackage(), 'plugins/demo/plugin.config.ts': config('demo', "['web']"), 'plugins/demo/components/Widget.tsx': "import { format } from '@nextsparkjs/core/lib/barrel'\nexport default () => format\n" })
  assert.deepEqual(codes(barrel.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
  // and the same import is fine for a server plugin, and a client-safe core module is fine for web
  const server = await check({ ...corePackage(), 'plugins/demo/plugin.config.ts': config('demo', "['server']"), 'plugins/demo/api/hello/route.ts': "import { getLocale } from '@nextsparkjs/core/lib/locale'\nexport const GET = () => getLocale()\n" })
  assert.deepEqual(server.diagnostics, [])
  const clean = await check({ ...corePackage(), 'plugins/demo/plugin.config.ts': config('demo', "['web']"), 'plugins/demo/components/Widget.tsx': "import { format } from '@nextsparkjs/core/lib/format'\nexport default () => format\n" })
  assert.deepEqual(clean.diagnostics, [])
})

test('core lib/api: the client-safe modules (entities) are fine for a web entry, the rest of lib/api is server-only', async () => {
  const core = corePackage({
    'node_modules/@nextsparkjs/core/dist/lib/api/entities.js': "export const fetchWithTeam = (...args) => fetch(...args)\n",
    'node_modules/@nextsparkjs/core/dist/lib/api/entities.d.ts': 'export declare const fetchWithTeam: typeof fetch\n',
    'node_modules/@nextsparkjs/core/dist/lib/api/auth/dual-auth.js': "import { headers } from 'next/headers'\nexport const authenticate = () => headers()\n",
    'node_modules/@nextsparkjs/core/dist/lib/api/auth/dual-auth.d.ts': 'export declare const authenticate: () => unknown\n',
  })
  const web = await check({ ...core, 'plugins/demo/plugin.config.ts': config('demo', "['web']"), 'plugins/demo/components/Form.tsx': "import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'\nexport default () => fetchWithTeam\n" })
  assert.deepEqual(web.diagnostics, [], 'lib/api/entities imports only client modules')
  // a legacy plugin (no capabilities) is checked as web too: the false positive of the 0.x -> 1.0 migration
  const legacy = await check({ ...core, 'plugins/demo/plugin.config.ts': legacyConfig('demo'), 'plugins/demo/components/Form.tsx': "import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'\nexport default () => fetchWithTeam\n" })
  assert.deepEqual(legacy.diagnostics, [])
  const server = await check({ ...core, 'plugins/demo/plugin.config.ts': config('demo', "['web']"), 'plugins/demo/components/Form.tsx': "import { authenticate } from '@nextsparkjs/core/lib/api/auth/dual-auth'\nexport default () => authenticate\n" })
  assert.deepEqual(codes(server.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
})

test("guard: every core lib/api module a core 'use client' file imports is classified client-safe", () => {
  const src = join(import.meta.dirname, '../../../../src')
  const files = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name)) files.push(path)
    }
  }
  walk(src)
  const importOf = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/g
  const found = new Map() // lib/api module -> a client file importing it
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(text)) continue
    for (const [, specifier] of text.matchAll(importOf)) {
      const module = specifier.startsWith('@nextsparkjs/core/') ? specifier.slice('@nextsparkjs/core/'.length) : specifier.startsWith('.') ? relative(src, resolve(dirname(file), specifier)).split('\\').join('/') : null
      const match = module && /^lib\/api\/(.+)$/.exec(module)
      if (match) found.set(match[1], relative(src, file))
    }
  }
  assert.ok(found.has('entities'), 'the scan finds the imports core\'s client components make (the guard is not vacuous)')
  for (const [module, file] of found) {
    assert.equal(serverOnlySpecifier(`@nextsparkjs/core/lib/api/${module}`), null, `${file} is 'use client' and imports lib/api/${module}: add it to CLIENT_SAFE_CORE_API`)
    assert.ok(CLIENT_SAFE_CORE_API.includes(module))
  }
  assert.ok(serverOnlySpecifier('@nextsparkjs/core/lib/api'), 'the barrel re-exports server code')
  assert.ok(serverOnlySpecifier('@nextsparkjs/core/lib/api/auth/dual-auth'))
})

test('imports resolve with the project tsconfig: paths and baseUrl aliases are followed', async () => {
  const tsconfig = JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@demo/*': ['plugins/demo/*'], '~/*': ['shared/*'] } } })
  for (const alias of ['@demo/lib/secret.server', '~/secret', 'shared/secret']) {
    const { diagnostics } = await check({
      'tsconfig.json': tsconfig,
      'plugins/demo/plugin.config.ts': config('demo', "['web']"),
      'plugins/demo/components/Widget.tsx': `import { secret } from '${alias}'\nexport default () => secret\n`,
      'plugins/demo/lib/secret.server.ts': 'export const secret = 1\n',
      'shared/secret.ts': "import 'server-only'\nexport const secret = 1\n",
    })
    const hit = diagnostics.filter(d => d.code === PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT)
    assert.equal(hit.length, 1, `${alias}: ${JSON.stringify(diagnostics)}`)
    assert.match(hit[0].file, /secret/)
  }
  const clean = await check({
    'tsconfig.json': tsconfig,
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { format } from '@demo/lib/format'\nexport default () => format\n",
    'plugins/demo/lib/format.ts': 'export const format = String\n',
  })
  assert.deepEqual(clean.diagnostics, [])
})

test('an external npm package is not followed, and next/server is server-only', async () => {
  const { diagnostics } = await check({
    'node_modules/somepkg/package.json': JSON.stringify({ name: 'somepkg', main: 'index.js' }),
    'node_modules/somepkg/index.js': "require('fs')\n",
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import x from 'somepkg'\nexport default () => x\n",
    'plugins/demo/components/Response.tsx': "import { NextResponse } from 'next/server'\nexport default () => NextResponse\n",
  })
  assert.deepEqual(diagnostics.map(d => [d.code, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, 'plugins/demo/components/Response.tsx']])
  assert.match(diagnostics[0].message, /"next\/server"/)
})

test('Route Handlers under templates/ are server entries; pages there stay web', async () => {
  const handler = { 'plugins/demo/templates/data/route.ts': "import { readFileSync } from 'node:fs'\nexport const GET = () => Response.json(readFileSync.name)\n" }
  const serverOnly = await check({ 'plugins/demo/plugin.config.ts': config('demo', "['server']"), ...handler })
  assert.deepEqual(serverOnly.diagnostics, [])
  const webOnly = await check({ 'plugins/demo/plugin.config.ts': config('demo', "['web']"), ...handler })
  assert.deepEqual(webOnly.diagnostics.map(d => [d.code, d.capability, d.file]), [[PLUGIN_DIAGNOSTICS.UNDECLARED, 'server', 'templates/data/route.ts']])
  const both = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web']"),
    ...handler,
    'plugins/demo/templates/data/page.tsx': PAGE,
    'plugins/demo/templates/route.isr.ts': ROUTE,
  })
  assert.deepEqual(both.diagnostics, [])
  const pageOnly = await check({ 'plugins/demo/plugin.config.ts': config('demo', "['server']"), 'plugins/demo/templates/data/page.tsx': PAGE })
  assert.deepEqual(pageOnly.diagnostics.map(d => [d.capability, d.file]), [['web', 'templates/data/page.tsx']])
  const client = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'web']"),
    ...handler,
    'plugins/demo/components/Widget.tsx': "import { GET } from '../templates/data/route'\nexport default () => GET\n",
  })
  assert.deepEqual(client.diagnostics.map(d => [d.code, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, 'plugins/demo/templates/data/route.ts']])
})

test("a templates/ Route Handler with server-only imports agrees with the host planner (server), not 'web'", () => {
  const { root, cleanup } = project({ 'plugins/demo/templates/data/route.ts': ROUTE })
  try {
    const of = capabilities => ({ name: 'demo', root: join(root, 'plugins/demo'), importBase: '@/plugins/demo', capabilities })
    const planned = planHost({ coreRoutes: [], plugins: [of(['server'])], project: { root: join(root, 'none') } })
    assert.deepEqual(planned.routes.map(route => route.target), ['data/route.ts'])
    assert.deepEqual(planned.diagnostics, [])
    const web = planHost({ coreRoutes: [], plugins: [of(['web'])], project: { root: join(root, 'none') } })
    assert.deepEqual(web.diagnostics.map(d => [d.plugin, d.capability]), [['demo', 'server']])
  } finally {
    cleanup()
  }
})

test('type-only re-exports are not runtime edges', async () => {
  const { diagnostics } = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { value } from '../lib/barrel'\nexport default () => value\n",
    'plugins/demo/lib/barrel.ts': "export { type Secret } from './secret.server'\nexport type { Other } from './secret.server'\nexport { type A, type B } from './secret.server'\nexport const value = 1\n",
    'plugins/demo/lib/secret.server.ts': "import 'server-only'\nexport type Secret = {}\nexport type Other = {}\nexport type A = {}\nexport type B = {}\n",
  })
  assert.deepEqual(diagnostics, [])
  const mixed = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { value } from '../lib/barrel'\nexport default () => value\n",
    'plugins/demo/lib/barrel.ts': "export { type Secret, secret } from './secret.server'\nexport const value = 1\n",
    'plugins/demo/lib/secret.server.ts': "export type Secret = {}\nexport const secret = 1\n",
  })
  assert.deepEqual(codes(mixed.diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
})

test('.cts and .mts modules are traversed like any other module', async () => {
  for (const ext of ['cts', 'mts', 'cjs']) {
    const { diagnostics } = await check({
      'plugins/demo/plugin.config.ts': config('demo', "['web']"),
      'plugins/demo/components/Widget.tsx': `import { secret } from '../lib/secret.server.${ext}'\nexport default () => secret\n`,
      [`plugins/demo/lib/secret.server.${ext}`]: "import 'server-only'\nexport const secret = 1\n",
    })
    assert.deepEqual(codes(diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT], ext)
  }
  // a plain .cts module (no .server name) that imports server-only, through an extensionless and an index import
  const { diagnostics } = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { a } from '../lib/a'\nimport { b } from '../lib/b'\nexport default () => [a, b]\n",
    'plugins/demo/lib/a.cts': "import 'server-only'\nexport const a = 1\n",
    'plugins/demo/lib/b/index.cts': "import { readFileSync } from 'node:fs'\nexport const b = readFileSync\n",
  })
  assert.deepEqual(diagnostics.map(d => d.file), ['plugins/demo/lib/a.cts', 'plugins/demo/lib/b/index.cts'])
  // and build-only code behind a .cts
  const build = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'build']"),
    'plugins/demo/api/hello/route.ts': "import { x } from '../../lib/x.cts'\nexport const GET = () => x\n",
    'plugins/demo/lib/x.cts': "import { g } from '../build/gen.cts'\nexport const x = g\n",
    'plugins/demo/build/gen.cts': 'export const g = 1\n',
  })
  assert.deepEqual(codes(build.diagnostics), [PLUGIN_DIAGNOSTICS.BUILD_IN_RUNTIME])
})

test('the project api/ and any route file are server surfaces, reached through a tsconfig alias too', async () => {
  const tsconfig = JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } })
  for (const target of ['@/api/internal/route', '@/api/internal/helper', '@/lib/thing/route']) {
    const { diagnostics } = await check({
      'tsconfig.json': tsconfig,
      'plugins/demo/plugin.config.ts': config('demo', "['web']"),
      'plugins/demo/components/Widget.tsx': `import { x } from '${target}'\nexport default () => x\n`,
      'api/internal/route.ts': 'export const x = 1\n',
      'api/internal/helper.ts': 'export const x = 1\n',
      'lib/thing/route.ts': 'export const x = 1\n',
    })
    assert.deepEqual(codes(diagnostics), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT], target)
    assert.match(diagnostics[0].message, /Route Handler|project api\//)
  }
  const clean = await check({
    'tsconfig.json': tsconfig,
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { x } from '@/lib/util'\nexport default () => x\n",
    'lib/util.ts': 'export const x = 1\n',
  })
  assert.deepEqual(clean.diagnostics, [])
})

test('an @nextsparkjs package resolves to its runtime exports target, not its types target', async () => {
  const pkg = (exportsField, extra = {}) => ({
    'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', type: 'module', exports: exportsField }),
    ...extra,
  })
  const files = {
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import { h } from '@nextsparkjs/helper'\nimport { s } from '@nextsparkjs/helper/sub'\nexport default () => [h, s]\n",
  }
  // types live elsewhere than the runtime file; only the runtime file imports server-only
  const separate = await check({
    ...files,
    ...pkg(
      { '.': { types: './types/index.d.ts', import: './dist/index.js', default: './dist/index.cjs' }, './sub': { types: './types/sub.d.ts', import: './dist/sub.js' } },
      {
        'node_modules/@nextsparkjs/helper/types/index.d.ts': 'export declare const h: number\n',
        'node_modules/@nextsparkjs/helper/types/sub.d.ts': 'export declare const s: number\n',
        'node_modules/@nextsparkjs/helper/dist/index.js': "import 'server-only'\nexport const h = 1\n",
        'node_modules/@nextsparkjs/helper/dist/sub.js': "import { readFileSync } from 'node:fs'\nexport const s = readFileSync\n",
      }
    ),
  })
  assert.deepEqual(separate.diagnostics.map(d => d.file).sort(), ['@nextsparkjs/helper/dist/index.js', '@nextsparkjs/helper/dist/sub.js'])
  // wildcard exports and a string export; a clean package stays clean
  const clean = await check({
    ...files,
    'plugins/demo/components/Widget.tsx': "import { h } from '@nextsparkjs/helper'\nimport { s } from '@nextsparkjs/helper/sub'\nexport default () => [h, s]\n",
    ...pkg({ '.': './dist/index.js', './*': { types: './types/*.d.ts', import: './dist/*.js' } }, { 'node_modules/@nextsparkjs/helper/dist/index.js': 'export const h = 1\n', 'node_modules/@nextsparkjs/helper/dist/sub.js': 'export const s = 1\n' }),
  })
  assert.deepEqual(clean.diagnostics, [])
  const wildcard = await check({
    ...files,
    ...pkg({ '.': './dist/index.js', './*': { types: './types/*.d.ts', import: './dist/*.js' } }, { 'node_modules/@nextsparkjs/helper/dist/index.js': 'export const h = 1\n', 'node_modules/@nextsparkjs/helper/dist/sub.js': "import 'server-only'\nexport const s = 1\n" }),
  })
  assert.deepEqual(wildcard.diagnostics.map(d => d.file), ['@nextsparkjs/helper/dist/sub.js'])
  // dist not built in a workspace package: the source stands in
  const unbuilt = await check({
    ...files,
    ...pkg({ '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './sub': './dist/sub.js' }, { 'node_modules/@nextsparkjs/helper/src/index.ts': "import 'server-only'\nexport const h = 1\n", 'node_modules/@nextsparkjs/helper/src/sub.ts': 'export const s = 1\n' }),
  })
  assert.deepEqual(unbuilt.diagnostics.map(d => d.file), ['@nextsparkjs/helper/src/index.ts'])
})

test('package export conditions are resolved per target: web (browser, never node), mobile (react-native first)', async () => {
  const pkg = (exportsField, extra = {}, manifest = {}) => ({
    'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', type: 'module', exports: exportsField, ...manifest }),
    ...extra,
  })
  const dist = {
    'node_modules/@nextsparkjs/helper/dist/server.js': "import { readFileSync } from 'node:fs'\nexport const h = readFileSync\n",
    'node_modules/@nextsparkjs/helper/dist/clean.js': 'export const h = 1\n',
    'node_modules/@nextsparkjs/helper/dist/native.js': "import 'server-only'\nexport const h = 1\n",
  }
  const plugin = capability => ({
    'plugins/demo/plugin.config.ts': config('demo', `['${capability}']`),
    [capability === 'web' ? 'plugins/demo/components/Widget.tsx' : 'plugins/demo/mobile/index.ts']: "import { h } from '@nextsparkjs/helper'\nexport default () => h\n",
  })
  // web: a `browser` export that reaches node:fs is diagnosed (Next selects it)
  const browser = await check({ ...plugin('web'), ...dist, ...pkg({ '.': { browser: './dist/server.js', import: './dist/clean.js' } }) })
  assert.deepEqual(browser.diagnostics.map(d => [d.code, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, '@nextsparkjs/helper/dist/server.js']])
  // web: {node: server, import: clean} is clean (the client build never selects `node`), in either key order
  for (const exportsField of [{ '.': { node: './dist/server.js', import: './dist/clean.js' } }, { '.': { import: './dist/clean.js', node: './dist/server.js' } }, { '.': { node: './dist/server.js', default: './dist/clean.js' } }]) {
    const clean = await check({ ...plugin('web'), ...dist, ...pkg(exportsField) })
    assert.deepEqual(clean.diagnostics, [], JSON.stringify(exportsField))
  }
  // the legacy `browser` field is the web fallback; `main` alone is followed
  const field = await check({ ...plugin('web'), ...dist, ...pkg(undefined, {}, { exports: undefined, main: './dist/clean.js', browser: './dist/server.js' }) })
  assert.deepEqual(field.diagnostics.map(d => d.file), ['@nextsparkjs/helper/dist/server.js'])
  // mobile: `react-native` wins over browser/import/default
  const native = await check({ ...plugin('mobile'), ...dist, ...pkg({ '.': { 'react-native': './dist/native.js', browser: './dist/clean.js', import: './dist/clean.js', default: './dist/clean.js' } }) })
  assert.deepEqual(native.diagnostics.map(d => [d.capability, d.file]), [['mobile', '@nextsparkjs/helper/dist/native.js']])
  const nativeClean = await check({ ...plugin('mobile'), ...dist, ...pkg({ '.': { node: './dist/server.js', 'react-native': './dist/clean.js', default: './dist/server.js' } }) })
  assert.deepEqual(nativeClean.diagnostics, [])
  // the same react-native export is not what a web plugin bundles
  const web = await check({ ...plugin('web'), ...dist, ...pkg({ '.': { 'react-native': './dist/native.js', import: './dist/clean.js' } }) })
  assert.deepEqual(web.diagnostics, [])
})

test('the edge kind picks the export branch: import vs require, per target', async () => {
  const dist = {
    'node_modules/@nextsparkjs/helper/dist/clean.js': 'export const h = 1\n',
    'node_modules/@nextsparkjs/helper/dist/bad.cjs': "import 'server-only'\nexport const h = 1\n",
  }
  const pkg = exportsField => ({ 'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', exports: exportsField }), ...dist })
  const entry = (capability, code) => ({
    'plugins/demo/plugin.config.ts': config('demo', `['${capability}']`),
    [capability === 'web' ? 'plugins/demo/components/Widget.tsx' : 'plugins/demo/mobile/index.ts']: code,
  })
  const REQUIRE = "const h = require('@nextsparkjs/helper')\nexport default () => h\n"
  const IMPORT = "import { h } from '@nextsparkjs/helper'\nexport default () => h\n"
  const DYNAMIC = "export default () => import('@nextsparkjs/helper')\n"
  const EQUALS = "import h = require('@nextsparkjs/helper')\nexport default () => h\n"
  const files = diagnostics => diagnostics.map(d => d.file)
  // mobile: require selects the require branch (Metro), import the import branch, whatever the key order
  for (const exportsField of [{ '.': { import: './dist/clean.js', require: './dist/bad.cjs' } }, { '.': { require: './dist/bad.cjs', import: './dist/clean.js' } }]) {
    assert.deepEqual(files((await check({ ...entry('mobile', REQUIRE), ...pkg(exportsField) })).diagnostics), ['@nextsparkjs/helper/dist/bad.cjs'], 'mobile require')
    assert.deepEqual(files((await check({ ...entry('mobile', EQUALS), ...pkg(exportsField) })).diagnostics), ['@nextsparkjs/helper/dist/bad.cjs'], 'mobile import = require')
    assert.deepEqual((await check({ ...entry('mobile', IMPORT), ...pkg(exportsField) })).diagnostics, [], 'mobile import (require first is not a false positive)')
    assert.deepEqual((await check({ ...entry('mobile', DYNAMIC), ...pkg(exportsField) })).diagnostics, [], 'mobile dynamic import')
  }
  // web: an ESM import takes the import branch; a require is checked against BOTH (webpack and Turbopack differ)
  const requireBad = { '.': { require: './dist/bad.cjs', import: './dist/clean.js' } }
  const importBad = { '.': { import: './dist/bad.cjs', require: './dist/clean.js' } }
  assert.deepEqual((await check({ ...entry('web', IMPORT), ...pkg(requireBad) })).diagnostics, [], 'web import ignores the require branch')
  assert.deepEqual(files((await check({ ...entry('web', IMPORT), ...pkg(importBad) })).diagnostics), ['@nextsparkjs/helper/dist/bad.cjs'])
  assert.deepEqual(files((await check({ ...entry('web', REQUIRE), ...pkg(requireBad) })).diagnostics), ['@nextsparkjs/helper/dist/bad.cjs'], 'web require: the require branch')
  assert.deepEqual(files((await check({ ...entry('web', REQUIRE), ...pkg(importBad) })).diagnostics), ['@nextsparkjs/helper/dist/bad.cjs'], 'web require: the import branch, conservatively')
  assert.deepEqual((await check({ ...entry('web', REQUIRE), ...pkg({ '.': { import: './dist/clean.js', require: './dist/clean.js' } }) })).diagnostics, [])
})

test('the object form of the legacy browser field replaces modules for client targets', async () => {
  const pkg = (browser, extra = {}, manifest = {}) => ({
    'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', main: './server.js', browser, ...manifest }),
    'node_modules/@nextsparkjs/helper/server.js': "import { readFileSync } from 'node:fs'\nexport const h = readFileSync\n",
    'node_modules/@nextsparkjs/helper/clean.js': 'export const h = 1\n',
    ...extra,
  })
  const web = { 'plugins/demo/plugin.config.ts': config('demo', "['web']"), 'plugins/demo/components/Widget.tsx': "import { h } from '@nextsparkjs/helper'\nexport default () => h\n" }
  // the package entry replaced by another file, with and without './' and the extension
  for (const key of ['./server.js', 'server.js', './server']) assert.deepEqual((await check({ ...web, ...pkg({ [key]: './clean.js' }) })).diagnostics, [], key)
  // `false` is an empty module
  assert.deepEqual((await check({ ...web, ...pkg({ './server.js': false }) })).diagnostics, [])
  // a relative import inside the package is replaced too
  assert.deepEqual((await check({ ...web, ...pkg({ './lib/node.js': './lib/browser.js' }, {
    'node_modules/@nextsparkjs/helper/server.js': "export { h } from './lib/node.js'\n",
    'node_modules/@nextsparkjs/helper/lib/node.js': "import 'server-only'\nexport const h = 1\n",
    'node_modules/@nextsparkjs/helper/lib/browser.js': 'export const h = 1\n',
  }) })).diagnostics, [])
  // a bare Node built-in emptied by the package's own map is not a server-only edge
  assert.deepEqual((await check({ ...web, ...pkg({ fs: false, 'node:fs': false }) })).diagnostics, [])
  // a map that does not name the entry changes nothing; and the server target ignores the map
  assert.deepEqual((await check({ ...web, ...pkg({ './other.js': './clean.js' }) })).diagnostics.map(d => d.file), ['@nextsparkjs/helper/server.js'])
  const server = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server']"),
    'plugins/demo/api/hello/route.ts': "import { h } from '@nextsparkjs/helper'\nexport const GET = () => h\n",
    ...pkg({ './server.js': './clean.js' }),
  })
  assert.deepEqual(server.diagnostics, [])
})

test('a bare replacement in a browser map is followed as a package import; an unresolvable one is a diagnostic', async () => {
  const helper = (browser, extra = {}) => ({
    'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', main: './index.js', browser }),
    'node_modules/@nextsparkjs/helper/index.js': "import dep from 'safe-dep'\nexport const h = dep\n",
    ...extra,
  })
  const pkgs = {
    'node_modules/safe-dep/package.json': JSON.stringify({ name: 'safe-dep', main: 'index.js' }),
    'node_modules/safe-dep/index.js': 'export default 1\n',
    'node_modules/unsafe-dep/package.json': JSON.stringify({ name: 'unsafe-dep', main: 'index.js' }),
    'node_modules/unsafe-dep/index.js': "import 'server-only'\nexport default 1\n",
    'node_modules/@nextsparkjs/unsafe-dep/package.json': JSON.stringify({ name: '@nextsparkjs/unsafe-dep', main: 'index.js' }),
    'node_modules/@nextsparkjs/unsafe-dep/index.js': "import 'server-only'\nexport default 1\n",
    'node_modules/@nextsparkjs/safe-dep/package.json': JSON.stringify({ name: '@nextsparkjs/safe-dep', main: 'index.js' }),
    'node_modules/@nextsparkjs/safe-dep/index.js': 'export default 1\n',
  }
  const entry = capability => ({
    'plugins/demo/plugin.config.ts': config('demo', `['${capability}']`),
    [capability === 'web' ? 'plugins/demo/components/Widget.tsx' : 'plugins/demo/mobile/index.ts']: "import { h } from '@nextsparkjs/helper'\nexport default () => h\n",
  })
  // the reviewer's case: { "safe-dep": "unsafe-dep" } sends the import to a package that imports server-only (mobile reads third-party entries)
  const mobile = await check({ ...entry('mobile'), ...pkgs, ...helper({ 'safe-dep': 'unsafe-dep' }) })
  assert.deepEqual(mobile.diagnostics.map(d => [d.code, d.capability, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, 'mobile', 'unsafe-dep/index.js']])
  // the same through a workspace-style @nextsparkjs package for web
  const web = await check({ ...entry('web'), ...pkgs, ...helper({ 'safe-dep': '@nextsparkjs/unsafe-dep' }) })
  assert.deepEqual(web.diagnostics.map(d => [d.code, d.capability, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, 'web', '@nextsparkjs/unsafe-dep/index.js']])
  // a bare replacement to a clean package is clean, and so is a relative one
  for (const [name, browser] of [['bare clean', { 'safe-dep': '@nextsparkjs/safe-dep' }], ['relative', { 'safe-dep': './other.js' }]]) {
    const result = await check({ ...entry('web'), ...pkgs, ...helper(browser, { 'node_modules/@nextsparkjs/helper/other.js': 'export default 1\n' }) })
    assert.deepEqual(result.diagnostics, [], name)
  }
  // a replacement to a Node built-in by name is a server-only edge, not a drop
  const builtin = await check({ ...entry('web'), ...pkgs, ...helper({ 'safe-dep': 'node:fs' }) })
  assert.deepEqual(builtin.diagnostics.map(d => d.code), [PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT])
  // an explicit false still drops the edge
  assert.deepEqual((await check({ ...entry('web'), ...pkgs, ...helper({ 'safe-dep': false }) })).diagnostics, [])
  // an unresolvable replacement is a diagnostic naming the map, never a silent drop
  for (const [name, browser, pattern] of [
    ['missing relative', { 'safe-dep': './missing.js' }, /names no file in the package/],
    ['missing package', { 'safe-dep': 'no-such-package' }, /resolves to no file or package/],
  ]) {
    const result = await check({ ...entry('web'), ...pkgs, ...helper(browser) })
    assert.deepEqual(result.diagnostics.map(d => [d.code, d.capability]), [[PLUGIN_DIAGNOSTICS.UNRESOLVED_REPLACEMENT, 'web']], name)
    assert.match(result.diagnostics[0].message, pattern, name)
    assert.match(result.diagnostics[0].message, /@nextsparkjs\/helper\/index\.js/, name)
  }
  // a file replaced by a missing file (the entry mapped away) is a diagnostic too
  const entryMissing = await check({ ...entry('web'), ...pkgs, ...helper({ './index.js': './gone.js' }) })
  assert.deepEqual(entryMissing.diagnostics.map(d => d.code), [PLUGIN_DIAGNOSTICS.UNRESOLVED_REPLACEMENT])
  // a cycle in the map terminates
  const cycle = await check({ ...entry('web'), ...pkgs, ...helper({ 'safe-dep': 'other-dep', 'other-dep': 'safe-dep' }) })
  assert.ok(Array.isArray(cycle.diagnostics))
})

test('TypeScript `import x = require()` is a runtime edge (type-only forms are not)', async () => {
  const { diagnostics } = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import bridge = require('../lib/bridge.cts')\nexport default () => bridge\n",
    'plugins/demo/lib/bridge.cts': "import fs = require('node:fs')\nexport = fs\n",
  })
  assert.deepEqual(diagnostics.map(d => [d.code, d.file]), [[PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, 'plugins/demo/lib/bridge.cts']])
  const server = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import bridge = require('../lib/store.server.cts')\nexport default () => bridge\n",
    'plugins/demo/lib/store.server.cts': 'export const store = 1\n',
  })
  assert.equal(server.diagnostics.length, 1)
  const build = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['server', 'build']"),
    'plugins/demo/api/hello/route.ts': "import gen = require('../../build/gen.cts')\nexport const GET = () => gen\n",
    'plugins/demo/build/gen.cts': 'export const g = 1\n',
  })
  assert.deepEqual(codes(build.diagnostics), [PLUGIN_DIAGNOSTICS.BUILD_IN_RUNTIME])
  const typeOnly = await check({
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import type secret = require('../lib/secret.server.cts')\nexport default () => null\n",
    'plugins/demo/lib/secret.server.cts': "import 'server-only'\nexport = 1\n",
  })
  assert.deepEqual(typeOnly.diagnostics, [])
})

test('mobile also reads third-party entries for `server-only` (Metro does not fail it); web does not', async () => {
  const files = target => ({
    'node_modules/thirdparty/package.json': JSON.stringify({ name: 'thirdparty', main: 'index.js' }),
    'node_modules/thirdparty/index.js': "require('./inner')\nmodule.exports = 1\n",
    'node_modules/thirdparty/inner.js': "require('server-only')\nrequire('node:fs')\n",
    'plugins/demo/plugin.config.ts': config('demo', `['${target}']`),
    [target === 'web' ? 'plugins/demo/components/Widget.tsx' : 'plugins/demo/mobile/index.ts']: "import x from 'thirdparty'\nexport default () => x\n",
  })
  const mobile = await check(files('mobile'))
  // only `server-only` is reported for third-party code: the Node built-in is Metro's to fail
  assert.equal(mobile.diagnostics.length, 1, JSON.stringify(mobile.diagnostics))
  assert.match(mobile.diagnostics[0].message, /"server-only"/)
  assert.equal(mobile.diagnostics[0].capability, 'mobile')
  const web = await check(files('web'))
  assert.deepEqual(web.diagnostics, [])
})

test('third-party packages are not traversed: the bundlers own that boundary', async () => {
  const { diagnostics } = await check({
    'node_modules/thirdparty/package.json': JSON.stringify({ name: 'thirdparty', exports: { '.': { import: './index.js' } } }),
    'node_modules/thirdparty/index.js': "import { readFileSync } from 'node:fs'\nexport default readFileSync\n",
    'plugins/demo/plugin.config.ts': config('demo', "['web']"),
    'plugins/demo/components/Widget.tsx': "import x from 'thirdparty'\nexport default () => x\n",
  })
  assert.deepEqual(diagnostics, [])
})

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

test('discoverPlugins attaches the declared capabilities and treats an undeclared plugin as legacy', async () => {
  const { root, cleanup } = project({
    'plugins/modern/plugin.config.ts': config('modern', "['server']"),
    'plugins/modern/api/hello/route.ts': ROUTE,
    'plugins/old/plugin.config.ts': legacyConfig('old'),
    'plugins/old/api/hello/route.ts': ROUTE,
    'plugins/old/components/Widget.tsx': PAGE,
  })
  try {
    const plugins = await discoverPlugins({ projectRoot: root, pluginSources: [sourceOf(root, 'old'), sourceOf(root, 'modern')] })
    const byName = Object.fromEntries(plugins.map(p => [p.name, p]))
    assert.deepEqual(byName.modern.capabilities, ['server'])
    assert.equal(byName.modern.capabilitiesDeclared, true)
    assert.deepEqual(byName.old.capabilities, ['server', 'web', 'build'])
    assert.equal(byName.old.capabilitiesDeclared, false)
  } finally {
    cleanup()
  }
})

test('discoverPlugins fails with every diagnostic, naming plugin, capability and file', async () => {
  const { root, cleanup } = project({
    'plugins/webby/plugin.config.ts': config('webby', "['web']"),
    'plugins/webby/api/hello/route.ts': ROUTE,
    'plugins/webby/components/Widget.tsx': "import 'server-only'\nexport default () => null\n",
    'plugins/broken/plugin.config.ts': "export const brokenPluginConfig = definePlugin({ name: 'broken', capabilities: ['nope'] })\n",
  })
  try {
    await assert.rejects(
      discoverPlugins({ projectRoot: root, pluginSources: [sourceOf(root, 'webby'), sourceOf(root, 'broken')] }),
      error => {
        assert.ok(error instanceof PluginCapabilityError)
        assert.deepEqual(codes(error.diagnostics).sort(), [PLUGIN_DIAGNOSTICS.INVALID, PLUGIN_DIAGNOSTICS.SERVER_IN_CLIENT, PLUGIN_DIAGNOSTICS.UNDECLARED].sort())
        const undeclared = error.diagnostics.find(d => d.code === PLUGIN_DIAGNOSTICS.UNDECLARED)
        assert.deepEqual([undeclared.plugin, undeclared.capability, undeclared.file], ['webby', 'server', 'api/hello/route.ts'])
        assert.match(error.message, /plugins\/webby\/api\/hello\/route\.ts/)
        return true
      }
    )
  } finally {
    cleanup()
  }
})

// ---------------------------------------------------------------------------
// Collisions and order independence
// ---------------------------------------------------------------------------

const permutations = items => (items.length <= 1 ? [items] : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(rest => [item, ...rest])))

const entity = (name, plugin) => ({ name, configPath: `@/plugins/${plugin}/entities/${name}/${name}.config`, pluginContext: { pluginName: plugin } })

test('the same entity in two plugins is a diagnostic naming both, whatever their order', () => {
  const plugins = [
    { name: 'gamma', sourceDir: '/p/gamma', entities: [entity('tasks', 'gamma'), entity('notes', 'gamma')] },
    { name: 'alpha', sourceDir: '/p/alpha', entities: [entity('tasks', 'alpha')] },
    { name: 'beta', sourceDir: '/p/beta', entities: [entity('notes', 'beta'), entity('unique', 'beta')] },
  ]
  const expected = pluginCollisions(plugins)
  assert.equal(expected.length, 2)
  assert.deepEqual(expected.map(d => d.entity), ['tasks', 'notes'])
  assert.match(expected[0].message, /entity "tasks" is provided by plugins "alpha".*and "gamma"/)
  assert.match(expected[1].message, /entity "notes" is provided by plugins "beta".*and "gamma"/)
  for (const order of permutations(plugins)) {
    assert.deepEqual(pluginCollisions(order), expected, order.map(p => p.name).join(','))
    assert.throws(() => mergeEntities({ plugins: order, coreEntities: [], themes: [] }), error => error instanceof PluginCapabilityError && error.message === new PluginCapabilityError(expected).message)
  }
})

test('core or the project may still replace a plugin entity', () => {
  const plugins = [{ name: 'alpha', sourceDir: '/p/alpha', entities: [{ ...entity('tasks', 'alpha'), source: 'plugin' }] }]
  const merged = mergeEntities({ plugins, coreEntities: [{ name: 'tasks', source: 'core' }], themes: [{ entities: [{ name: 'tasks', source: 'project' }] }] })
  assert.deepEqual(merged.map(e => e.source), ['project'])
})

test('the same plugin name twice is a diagnostic naming both sources, whatever their order', () => {
  const plugins = [
    { name: 'dup', sourceDir: '/p/second', entities: [] },
    { name: 'dup', sourceDir: '/p/first', entities: [] },
    { name: 'other', sourceDir: '/p/other', entities: [] },
  ]
  const expected = pluginCollisions(plugins)
  assert.equal(expected.length, 1)
  assert.equal(expected[0].code, PLUGIN_DIAGNOSTICS.NAME_COLLISION)
  assert.match(expected[0].message, /"dup" is provided twice: \/p\/first and \/p\/second/)
  for (const order of permutations(plugins)) assert.deepEqual(pluginCollisions(order), expected)
  assert.throws(() => assertNoPluginCollisions(plugins), PluginCapabilityError)
  assert.doesNotThrow(() => assertNoPluginCollisions([plugins[2]]))
})

test('two plugins serving one web route are a collision naming both, and the order of plugins does not matter', () => {
  const { root, cleanup } = project({
    'plugins/a/templates/shared/page.tsx': PAGE,
    'plugins/b/templates/shared/page.tsx': PAGE,
    'plugins/c/templates/shared/page.tsx': PAGE,
    'plugins/a/templates/only-a/page.tsx': PAGE,
  })
  try {
    const plugins = ['a', 'b', 'c'].map(name => ({ name, root: join(root, 'plugins', name), importBase: `@/plugins/${name}`, capabilities: ['web'] }))
    const plan = order => planHost({ coreRoutes: [], plugins: order, project: { root: join(root, 'no-project') } })
    const expected = plan(plugins)
    const collisions = expected.diagnostics.filter(d => d.code === 'NS_HOST_ROUTE_COLLISION')
    assert.equal(collisions.length, 2)
    assert.ok(collisions.every(d => d.target === 'shared/page.tsx'))
    assert.match(collisions[0].message, /two plugins provide this route: plugins\/a\/templates\/shared\/page\.tsx and plugins\/b\/templates\/shared\/page\.tsx/)
    for (const order of permutations(plugins)) assert.deepEqual(plan(order), expected, order.map(p => p.name).join(','))
  } finally {
    cleanup()
  }
})

// ---------------------------------------------------------------------------
// The host planner takes only what a plugin declares
// ---------------------------------------------------------------------------

test('the host planner takes routes only from declared capabilities', () => {
  const { root, cleanup } = project({
    'plugins/serveronly/api/hello/route.ts': ROUTE,
    'plugins/serveronly/templates/page-of-server/page.tsx': PAGE,
    'plugins/webonly/templates/hello/page.tsx': PAGE,
    'plugins/webonly/api/hello/route.ts': ROUTE,
    'plugins/buildonly/api/hello/route.ts': ROUTE,
    'plugins/legacy/api/hello/route.ts': ROUTE,
    'plugins/legacy/templates/legacy/page.tsx': PAGE,
    'plugins/both/api/hello/route.ts': ROUTE,
    'plugins/both/templates/both/page.tsx': PAGE,
    'plugins/both/templates/both/data/route.ts': ROUTE,
  })
  try {
    const of = (name, capabilities) => ({ name, root: join(root, 'plugins', name), importBase: `@/plugins/${name}`, ...(capabilities ? { capabilities } : {}) })
    const { routes, diagnostics } = planHost({
      coreRoutes: [],
      plugins: [of('serveronly', ['server']), of('webonly', ['web']), of('buildonly', ['build']), of('legacy'), of('both', ['server', 'web'])],
      project: { root: join(root, 'no-project') },
    })
    assert.deepEqual(routes.map(route => route.target), [
      'api/plugins/both/hello/route.ts',
      'api/plugins/legacy/hello/route.ts',
      'api/plugins/serveronly/hello/route.ts',
      'both/data/route.ts',
      'both/page.tsx',
      'legacy/page.tsx',
      'hello/page.tsx',
    ].sort())
    assert.deepEqual(diagnostics.map(d => [d.code, d.plugin, d.capability, d.file]).sort(), [
      [PLUGIN_DIAGNOSTICS.UNDECLARED, 'buildonly', 'server', 'plugins/buildonly/api/hello/route.ts'],
      [PLUGIN_DIAGNOSTICS.UNDECLARED, 'serveronly', 'web', 'plugins/serveronly/templates/page-of-server/page.tsx'],
      [PLUGIN_DIAGNOSTICS.UNDECLARED, 'webonly', 'server', 'plugins/webonly/api/hello/route.ts'],
    ].sort())
    assert.match(diagnostics.find(d => d.plugin === 'webonly').message, /plugin "webonly" needs the "server" capability, but it declares \[web\]/)
  } finally {
    cleanup()
  }
})

test('withDeclaredCapabilities reads plugin.config.ts for plugins that carry none, and keeps explicit ones', async () => {
  const { root, cleanup } = project({
    'plugins/a/plugin.config.ts': config('a', "['web']"),
    'plugins/b/plugin.config.ts': legacyConfig('b'),
    'plugins/c/plugin.config.ts': "export const cPluginConfig = definePlugin({ name: 'c', capabilities: ['x'] })\n",
    'plugins/d/README.md': 'no config',
  })
  try {
    const of = name => ({ name, root: join(root, 'plugins', name), importBase: `@/plugins/${name}` })
    const { plugins, diagnostics } = await withDeclaredCapabilities([of('a'), of('b'), of('c'), of('d'), { ...of('e'), capabilities: ['build'] }], { projectRoot: root })
    assert.deepEqual(plugins.map(p => p.capabilities ?? null), [['web'], null, null, null, ['build']])
    assert.deepEqual(diagnostics.map(d => [d.code, d.plugin]), [[PLUGIN_DIAGNOSTICS.INVALID, 'c']])
  } finally {
    cleanup()
  }
})

test('prepare fails generation with the capability diagnostics of a plugin', async () => {
  const { root, cleanup } = project({
    'plugins/webby/plugin.config.ts': config('webby', "['web']"),
    'plugins/webby/templates/hello/page.tsx': PAGE,
    'plugins/webby/api/hello/route.ts': ROUTE,
  })
  try {
    const hostConfig = {
      projectRoot: root,
      loadCoreRoutes: async () => ({ routes: [], hash: 'none' }),
      plugins: [{ name: 'webby', root: join(root, 'plugins/webby'), importBase: '@/plugins/webby' }],
      project: { root: join(root, 'source'), importBase: '@', label: '.' },
    }
    await assert.rejects(renderHostFiles(hostConfig), error => {
      assert.ok(error instanceof PrepareError)
      assert.deepEqual(error.diagnostics.map(d => [d.code, d.plugin, d.capability, d.file]), [[PLUGIN_DIAGNOSTICS.UNDECLARED, 'webby', 'server', 'plugins/webby/api/hello/route.ts']])
      return true
    })
  } finally {
    cleanup()
  }
})

test('the catalog lists every plugin with static metadata; the executable registries keep to their capability', async () => {
  const { root, cleanup } = project({
    'plugins/webby/plugin.config.ts': "import { definePlugin } from '@nextsparkjs/core/types/plugin'\nexport const webbyPluginConfig = definePlugin({ name: 'webby', displayName: 'Webby', version: '3.1.0', description: 'A web plugin', enabled: process.env.X === '1', capabilities: ['web'] })\n",
    'plugins/webby/package.json': JSON.stringify({ version: '9.9.9' }),
    'plugins/webby/components/Widget.tsx': PAGE,
    'plugins/serv/plugin.config.ts': "import { definePlugin } from '@nextsparkjs/core/types/plugin'\nexport const servPluginConfig = definePlugin({ name: 'serv', capabilities: ['server'], enabled: process.env.SERV === '1' })\n",
    'plugins/serv/package.json': JSON.stringify({ version: '1.2.3' }),
    'plugins/serv/api/hello/route.ts': ROUTE,
    'plugins/tool/plugin.config.ts': config('tool', "['build']"),
    'plugins/off/plugin.config.ts': "export const offPluginConfig = { name: 'off', displayName: 'Off', version: '1.0.0', enabled: false, capabilities: ['web'] }\n",
    'plugins/off/components/W.tsx': PAGE,
  })
  try {
    const plugins = await discoverPlugins({ projectRoot: root, outputDir: join(root, 'out'), pluginSources: ['webby', 'serv', 'tool', 'off'].map(name => sourceOf(root, name)) })
    const catalog = generatePluginCatalog(plugins)
    for (const name of ['webby', 'serv', 'tool']) assert.match(catalog, new RegExp(`"${name}": \\{`))
    assert.match(catalog, /displayName: "Webby"/)
    assert.match(catalog, /version: "3\.1\.0"/)
    assert.match(catalog, /description: "A web plugin"/)
    assert.match(catalog, /version: "1\.2\.3"/) // no literal version: the package's
    assert.match(catalog, /capabilities: \["web"\]/)
    const enabledOf = name => catalog.match(new RegExp(`"${name}": \\{[^}]*?enabled: (true|false|null)`))?.[1]
    // a literal is kept, a computed flag is unknown (null), definePlugin without one defaults to true
    assert.deepEqual(['webby', 'serv', 'tool', 'off'].map(enabledOf), ['null', 'null', 'true', 'false'])
    assert.doesNotMatch(catalog, /^import /m)
    const options = { outputDir: join(root, 'out') }
    const server = generatePluginRegistry(pluginsFor(plugins, 'server'), options)
    assert.match(server, /'serv': \{/)
    assert.doesNotMatch(server, /'webby': \{|'tool': \{/)
    const client = generatePluginRegistryClient(pluginsFor(plugins, 'web'), options)
    assert.match(client, /'webby': \{/)
    assert.doesNotMatch(client, /'serv': \{|'tool': \{/)
    // order of discovery does not change the catalog
    assert.equal(generatePluginCatalog([...plugins].reverse()), catalog)
  } finally {
    cleanup()
  }
})

test("package `exports` patterns are ordered as Node's PATTERN_KEY_COMPARE does, not by declaration order", () => {
  const IMPORT = new Set(['import', 'default'])
  const at = (exportsField, subpath) => exportsTarget(exportsField, subpath, IMPORT)
  const both = { './*': { import: './generic/*.js' }, './*.js': { import: './js/*.js' } }
  const reversed = { './*.js': { import: './js/*.js' }, './*': { import: './generic/*.js' } }
  // `./*.js` and `./*` share the base before the star: the longer key is the more specific pattern, whichever comes first
  for (const field of [both, reversed]) {
    assert.equal(at(field, './feature.js'), './js/feature.js')
    assert.equal(at(field, './feature'), './generic/feature.js')
    assert.equal(at(field, './nested/feature.js'), './js/nested/feature.js')
  }
  // a longer base before the star wins over a longer key
  const bases = { './*': './a/*', './lite/*': './b/*', './lite/*.js': './c/*.js' }
  for (const field of [bases, Object.fromEntries(Object.entries(bases).reverse())]) {
    assert.equal(at(field, './lite/x.js'), './c/x.js')
    assert.equal(at(field, './lite/x'), './b/x')
    assert.equal(at(field, './other/x'), './a/other/x')
  }
  // an exact key beats every pattern
  assert.equal(at({ './*': './a/*', './feature.js': './exact.js', './*.js': './b/*.js' }, './feature.js'), './exact.js')
  // the first pattern in that order that MATCHES decides, even when its conditions select nothing (Node does not fall back)
  assert.equal(exportsTarget({ './*': { import: './a/*.js' }, './*.js': { require: './b/*.js' } }, './x.js', IMPORT), null)
  // a key with two stars is not a pattern, a trailing-slash folder key is not a mapping (Node 17+), an empty match is not a match
  assert.equal(at({ './*/*': './a/*', './lib/': './lib/' }, './lib/x.js'), null)
  assert.equal(at({ './*': './a/*.js' }, './'), null)
  // the same subpath through nested conditions and arrays
  assert.equal(at({ './*.js': [{ require: './n.js' }, { import: './js/*.js' }], './*': './generic/*' }, './f.js'), './js/f.js')
})

test('the more specific wildcard export decides which file a plugin import reaches, in either declaration order', async () => {
  const PLUGIN = {
    'plugins/demo/plugin.config.ts': "export const demoPluginConfig = { name: 'demo', capabilities: ['web'] }\n",
    'plugins/demo/components/Widget.tsx': "import { feature } from '@nextsparkjs/helper/feature.js'\nexport default () => feature\n",
    'node_modules/@nextsparkjs/helper/dist/generic/feature.js.js': 'export const feature = 1\n',
    'node_modules/@nextsparkjs/helper/dist/js/feature.js': "import 'server-only'\nexport const feature = 1\n",
  }
  const manifests = [
    { './*': { import: './dist/generic/*.js' }, './*.js': { import: './dist/js/*.js' } },
    { './*.js': { import: './dist/js/*.js' }, './*': { import: './dist/generic/*.js' } },
  ]
  for (const exportsField of manifests) {
    const found = await check({ ...PLUGIN, 'node_modules/@nextsparkjs/helper/package.json': JSON.stringify({ name: '@nextsparkjs/helper', exports: exportsField }) })
    assert.deepEqual(found.diagnostics.map(d => d.file), ['@nextsparkjs/helper/dist/js/feature.js'], JSON.stringify(Object.keys(exportsField)))
  }
})
