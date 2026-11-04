import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkDuplicateDependencies, checkZodBelowCore } from '../src/doctor/checks/lockfile.js'
import { checkQueryClients } from '../src/doctor/checks/query-client.js'
import { checkNextThemesImports } from '../src/doctor/checks/next-themes.js'
import { nextThemesImportLines } from '../src/utils/next-themes-imports.js'

type Importers = Record<string, Record<string, string>>

/** A v9 lockfile: importers map package -> resolved version; `extra` are resolved packages nobody declares (transitive). */
function lockfile(importers: Importers, extra: string[] = [], version = '9.0', field = 'dependencies') {
  const resolved = new Set<string>(extra)
  let text = `lockfileVersion: '${version}'\n\nimporters:\n\n`
  for (const [importer, deps] of Object.entries(importers)) {
    text += `  ${importer}:\n    ${field}:\n`
    for (const [pkg, v] of Object.entries(deps)) {
      resolved.add(`${pkg}@${v}`)
      text += `      ${pkg}:\n        specifier: x\n        version: ${v}(react@19.2.4)\n`
    }
  }
  text += '\npackages:\n\n'
  for (const key of resolved) text += `  ${key}:\n    resolution: {integrity: x}\n\n`
  return text
}

/** A project dir with the lockfile, an installed core whose zod range is ^4.5.4, and extra files. */
async function inProject<T>(lock: string | null, files: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-lock-'))
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  if (lock) write('pnpm-lock.yaml', lock)
  write('node_modules/@nextsparkjs/core/package.json', JSON.stringify({ dependencies: { zod: '^4.5.4' } }))
  for (const [file, content] of Object.entries(files)) write(file, content)
  const previous = process.cwd()
  process.chdir(dir)
  try {
    return await run()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const peerPlugin = { 'plugins/crm/package.json': JSON.stringify({ peerDependencies: { next: '~16.3.8', zod: '4.3.6' } }) }

test('two next versions warn NS_DUPLICATE_DEPENDENCY, naming the importers; the fix leaves out the highest one', async () => {
  const lock = lockfile({ '.': { next: '16.4.2', [ '@nextsparkjs/core' ]: '0.1.0' }, 'plugins/crm': { next: '16.3.8' } })
  const result = await inProject(lock, peerPlugin, checkDuplicateDependencies)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_DUPLICATE_DEPENDENCY')
  assert.match(result.message, /next 16\.3\.8 \(plugins\/crm\) and 16\.4\.2 \(\.\)/)
  assert.equal(result.fix, "Run: pnpm add --filter ./plugins/crm --save-peer next@'^16.4.2'")
})

test('one version of next, better-auth and zod passes', async () => {
  assert.equal((await inProject(lockfile({ '.': { next: '16.4.2', zod: '4.6.7' } }), {}, checkDuplicateDependencies)).status, 'pass')
})

test('a transitive next of the same major as the project\'s warns; a transitive zod 3 next to zod 4 does not', async () => {
  const warned = await inProject(lockfile({ '.': { next: '16.4.2' } }, ['next@16.3.8']), {}, checkDuplicateDependencies)
  assert.equal(warned.status, 'warn')
  assert.match(warned.message, /16\.3\.8 \(a transitive dependency\)/)
  const lock = lockfile({ '.': { zod: '4.6.7' } }, ['zod@3.25.76'])
  assert.equal((await inProject(lock, {}, checkDuplicateDependencies)).status, 'pass')
  assert.equal((await inProject(lock, {}, checkZodBelowCore)).status, 'pass')
})

/** The lockfile of a project with zod 4.6.7 whose core reaches a pinned zod 4.1.11 through two packages; `also` adds a second root that reaches it. */
function pinnedZodLock(also = false) {
  const importer = also ? { zod: '4.6.7', '@nextsparkjs/core': '0.1.0', 'other-tool': '1.0.0' } : { zod: '4.6.7', '@nextsparkjs/core': '0.1.0' }
  let text = lockfile({ '.': importer }, ['zod@4.1.11', '@vercel/blob@2.8.2', '@vercel/cli-config@0.3.1', 'other-tool@1.0.0'])
  text += 'snapshots:\n\n'
  text += "  '@nextsparkjs/core@0.1.0(react@19.2.4)':\n    dependencies:\n      '@vercel/blob': 2.8.2\n      zod: 4.6.7\n\n"
  text += "  '@vercel/blob@2.8.2':\n    dependencies:\n      '@vercel/cli-config': 0.3.1\n\n"
  text += "  '@vercel/cli-config@0.3.1':\n    dependencies:\n      zod: 4.1.11\n\n"
  text += '  other-tool@1.0.0:\n    dependencies:\n' + (also ? "      '@vercel/cli-config': 0.3.1\n\n" : '      zod: 4.6.7\n\n')
  text += '  zod@4.1.11: {}\n\n  zod@4.6.7: {}\n'
  return text
}

test('a zod copy only core\'s own dependencies pin is not reported; one the project also reaches is (#394)', async () => {
  assert.equal((await inProject(pinnedZodLock(), {}, checkDuplicateDependencies)).status, 'pass')
  const warned = await inProject(pinnedZodLock(true), {}, checkDuplicateDependencies)
  assert.equal(warned.status, 'warn')
  assert.match(warned.message, /zod 4\.1\.11 \(a transitive dependency\)/)
})

test('an importer outside the project is not aligned: its next is not reported', async () => {
  const lock = lockfile({ '.': { next: '16.4.2', '@nextsparkjs/core': '0.1.0' }, 'apps/other': { next: '15.1.0' } })
  assert.equal((await inProject(lock, {}, checkDuplicateDependencies)).status, 'pass')
})

test('a peer dependency is fixed with --save-peer, and attributed even when the lockfile does not list it', async () => {
  const lock = lockfile({ '.': { next: '16.4.2', zod: '4.6.7' }, 'plugins/crm': { zod: '4.3.6' } }, ['next@16.3.8'])
  const dup = await inProject(lock, peerPlugin, checkDuplicateDependencies)
  assert.match(dup.message, /next 16\.3\.8 \(plugins\/crm\) and 16\.4\.2 \(\.\)/)
  assert.match(dup.fix ?? '', /pnpm add --filter \.\/plugins\/crm --save-peer next@'\^16\.4\.2'/)
  const zod = await inProject(lock, peerPlugin, checkZodBelowCore)
  assert.equal(zod.fix, "Run: pnpm add --filter ./plugins/crm --save-peer zod@'^4.5.4'")
})

test('a lockfile of another version is not passed in silence', async () => {
  const old = lockfile({ '.': { next: '16.4.2' } }, [], '6.0')
  for (const check of [checkDuplicateDependencies, checkZodBelowCore]) {
    const result = await inProject(old, {}, check)
    assert.equal(result.status, 'warn')
    assert.match(result.message, /Not checked: lockfile v6\.0/)
  }
})

test('zod below the range of core fails NS_ZOD_BELOW_CORE: 4.5.3 fails, 4.5.4 passes', async () => {
  const failed = await inProject(lockfile({ '.': { zod: '4.6.7' }, 'plugins/crm': { zod: '4.5.3' } }), {}, checkZodBelowCore)
  assert.equal(failed.status, 'fail')
  assert.equal(failed.code, 'NS_ZOD_BELOW_CORE')
  assert.match(failed.message, /zod 4\.5\.3 is below core's \^4\.5\.4/)
  assert.equal(failed.fix, "Run: pnpm add --filter ./plugins/crm zod@'^4.5.4'")
  assert.equal((await inProject(lockfile({ '.': { zod: '4.5.4' } }), {}, checkZodBelowCore)).status, 'pass')
})

test('only the dependency fields of an importer count', async () => {
  const lock = lockfile({ '.': { zod: '4.3.6' } }, [], '9.0', 'somethingElse')
  assert.equal((await inProject(lock, {}, checkZodBelowCore)).status, 'pass')
})

test('NS_QUERY_CLIENT_NOT_REGISTERED reports file:line, and skips registered, commented, test, generated and installed code', async () => {
  const unregistered = "import { QueryClient } from '@tanstack/react-query'\nexport const client = new QueryClient()\n"
  const registered = unregistered + 'registerQueryCache(() => client.clear())\n'
  const result = await inProject(null, {
    'components/cache.tsx': unregistered,
    'components/ok.tsx': registered,
    'components/commented.tsx': '// const client = new QueryClient()\n * new QueryClient()\n',
    'components/cache.test.tsx': unregistered,
    'components/cache.spec.ts': unregistered,
    'tests/helper.tsx': unregistered,
    'cypress/support.ts': unregistered,
    '.storybook/main.ts': unregistered,
    'src/app/generated.tsx': unregistered,
    'node_modules/pkg/index.js': unregistered,
  }, checkQueryClients)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_QUERY_CLIENT_NOT_REGISTERED')
  assert.match(result.message, /\(components\/cache\.tsx:2\)/)
  assert.equal((await inProject(null, { 'components/ok.tsx': registered }, checkQueryClients)).status, 'pass')
})

/** The installed core's code migrations, which decide what the next-themes check looks at */
const CODE_MIGRATIONS = fs.readFileSync(new URL('../../core/scripts/maintenance/code-migrations.mjs', import.meta.url), 'utf8')
const withCore = (files: Record<string, string>) => ({ 'node_modules/@nextsparkjs/core/scripts/maintenance/code-migrations.mjs': CODE_MIGRATIONS, ...files })

test('NS_NEXT_THEMES_IMPORT reports each file:line that loads next-themes, and skips commented, generated, test and installed code', async () => {
  const result = await inProject(null, withCore({
    'components/Navbar.tsx': "'use client'\nimport { useTheme } from 'next-themes'\n",
    'lib/theme.ts': 'export {\n  useTheme,\n} from "next-themes"\n',
    'lib/lazy.cjs': "module.exports = () => require('next-themes')\n",
    'components/ok.tsx': "import { useTheme } from '@nextsparkjs/core/providers/theme-provider'\n// import { useTheme } from 'next-themes'\nconst s = \"import { useTheme } from 'next-themes'\"\n",
    'components/Navbar.test.tsx': "import { useTheme } from 'next-themes'\n",
    'src/app/generated.tsx': "import { useTheme } from 'next-themes'\n",
    'node_modules/pkg/index.js': "import { useTheme } from 'next-themes'\n",
  }), checkNextThemesImports)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_NEXT_THEMES_IMPORT')
  for (const where of ['components/Navbar.tsx:2', 'lib/theme.ts:3', 'lib/lazy.cjs:1']) assert.ok(result.message.includes(where), where)
  for (const not of ['ok.tsx', 'Navbar.test', 'generated', 'pkg']) assert.ok(!result.message.includes(not), not)
  const clean = await inProject(null, withCore({ 'components/ok.tsx': "import { useTheme } from '@nextsparkjs/core/providers/theme-provider'\n" }), checkNextThemesImports)
  assert.equal(clean.status, 'pass')
  // A core older than its own theme provider has no code migrations: next-themes is still the one to use
  const older = await inProject(null, { 'components/Navbar.tsx': "import { useTheme } from 'next-themes'\n" }, checkNextThemesImports)
  assert.equal(older.status, 'pass')
})

test('a workspace package the project links to is part of the project, along the whole chain, with no peer and no core', async () => {
  const lock = lockfile({
    '.': { next: '16.4.2', '@nextsparkjs/core': '0.1.0', '@x/kit': 'link:packages/kit' },
    'packages/kit': { next: '16.4.2', '@x/shared': 'link:../shared' },
    'packages/shared': { next: '16.3.8', 'better-auth': '1.6.33' },
    'apps/other': { next: '15.1.0' },
  }, ['better-auth@1.7.7'])
  const result = await inProject(lock, {}, checkDuplicateDependencies)
  assert.equal(result.status, 'warn')
  assert.match(result.message, /next 16\.3\.8 \(packages\/shared\) and 16\.4\.2 \(\., packages\/kit\)/)
  assert.doesNotMatch(result.message, /15\.1\.0/)
})

test('the printed range is the one core declares for the package', async () => {
  const lock = lockfile({ '.': { next: '16.4.2', '@nextsparkjs/core': '0.1.0' }, 'plugins/crm': { next: '16.3.8' } })
  const files = { ...peerPlugin, 'node_modules/@nextsparkjs/core/package.json': JSON.stringify({ peerDependencies: { next: '~16.4.2' } }) }
  const result = await inProject(lock, files, checkDuplicateDependencies)
  assert.equal(result.fix, "Run: pnpm add --filter ./plugins/crm --save-peer next@'~16.4.2'")
})

test('a peer is attributed to every version its range accepts', async () => {
  const lock = lockfile({ '.': { next: '16.4.2' } }, ['next@16.3.8', 'next@16.3.9']).replace('importers:\n', 'importers:\n\n  plugins/crm: {}\n')
  const files = { 'plugins/crm/package.json': JSON.stringify({ peerDependencies: { next: '~16.3.8' } }) }
  const result = await inProject(lock, files, checkDuplicateDependencies)
  assert.match(result.message, /16\.3\.8 \(plugins\/crm\)/)
  assert.match(result.message, /16\.3\.9 \(plugins\/crm\)/)
})

test('NS_NEXT_THEMES_IMPORT does not fail on a directory the project cannot read', { skip: process.getuid?.() === 0 ? 'root reads every file' : false }, async () => {
  const result = await inProject(null, withCore({ 'components/Navbar.tsx': "import { useTheme } from 'next-themes'\n", 'pgdata/inside.ts': '' }), async () => {
    fs.chmodSync('pgdata', 0o000)
    try {
      return await checkNextThemesImports()
    } finally {
      fs.chmodSync('pgdata', 0o755)
    }
  })
  assert.equal(result.status, 'warn')
  assert.match(result.message, /components\/Navbar\.tsx:1/)
})

test('the prepare notice is empty, with no error, for a core without code migrations', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-notice-'))
  try {
    fs.writeFileSync(path.join(dir, 'a.ts'), "import { useTheme } from 'next-themes'\n")
    assert.deepEqual(await nextThemesImportLines(dir, path.join(dir, 'no-core')), [])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
