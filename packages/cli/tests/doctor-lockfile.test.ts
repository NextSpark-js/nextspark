import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkDuplicateDependencies, checkZodBelowCore } from '../src/doctor/checks/lockfile.js'
import { checkQueryClients } from '../src/doctor/checks/query-client.js'
import { checkNextThemesImports } from '../src/doctor/checks/next-themes.js'

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

test('NS_NEXT_THEMES_IMPORT reports each file:line that loads next-themes, and skips commented, generated and installed code', async () => {
  const result = await inProject(null, {
    'components/Navbar.tsx': "'use client'\nimport { useTheme } from 'next-themes'\n",
    'lib/theme.ts': 'export {\n  useTheme,\n} from "next-themes"\n',
    'lib/lazy.ts': "export const load = () => import('next-themes')\n",
    'components/ok.tsx': "import { useTheme } from '@nextsparkjs/core/providers/theme-provider'\n// import { useTheme } from 'next-themes'\n",
    'src/app/generated.tsx': "import { useTheme } from 'next-themes'\n",
    'node_modules/pkg/index.js': "import { useTheme } from 'next-themes'\n",
  }, checkNextThemesImports)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_NEXT_THEMES_IMPORT')
  for (const where of ['components/Navbar.tsx:2', 'lib/theme.ts:3', 'lib/lazy.ts:1']) assert.ok(result.message.includes(where), where)
  assert.ok(!result.message.includes('ok.tsx') && !result.message.includes('generated') && !result.message.includes('pkg'))
  const clean = await inProject(null, { 'components/ok.tsx': "import { useTheme } from '@nextsparkjs/core/providers/theme-provider'\n" }, checkNextThemesImports)
  assert.equal(clean.status, 'pass')
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
