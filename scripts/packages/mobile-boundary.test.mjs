import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkMobileBoundary, describeViolations, serverPackageReason } from './mobile-boundary.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'mobile-boundary.mjs')
const REPO_ROOT = join(dirname(SCRIPT), '../..')

/** A tiny repo: the portable packages and a mobile app, with `files` (paths from its root) on top. */
function repo(files = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'nextspark-boundary-')))
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n  - 'apps/dev'\n  - 'plugins/*'\n")
  write('apps/mobile/package.json', JSON.stringify({ name: 'mobile-app', dependencies: { react: '*' } }))
  write('apps/mobile/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*', './src/*'], '@nextsparkjs/ui': ['../../packages/ui/src/index.native.ts'], '@nextsparkjs/mobile': ['../../packages/mobile/src/index.ts'], '@project/contracts': ['../../packages/contracts/src/index.ts'] } } }))
  write('packages/mobile/templates/tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }))
  write('apps/mobile/app/index.tsx', "import { tasksApi } from '@/entities/tasks'\nimport { Task } from '@project/contracts'\nexport default function Home() { return null }\n")
  write('apps/mobile/src/entities/tasks/index.ts', "import { createEntityApi } from '@nextsparkjs/mobile'\nimport type { Task } from '@project/contracts'\nexport const tasksApi = createEntityApi<Task>('tasks')\n")
  write('packages/mobile/src/index.ts', "export * from './client'\n")
  write('packages/mobile/src/client.ts', "export function createEntityApi<T>(path: string) { return path as unknown as T }\n")
  write('packages/mobile/package.json', JSON.stringify({ name: '@nextsparkjs/mobile', dependencies: {}, peerDependencies: { react: '*' } }))
  write('packages/ui/src/index.native.ts', "export * from './button'\n")
  write('packages/ui/src/button.tsx', "import { View } from 'react-native'\nexport const Button = View\n")
  write('packages/ui/src/index.ts', "import 'next/image'\nexport {}\n") // the web entry: not part of the native bundle
  write('packages/ui/package.json', JSON.stringify({ name: '@nextsparkjs/ui', peerDependencies: { react: '*' } }))
  write('packages/contracts/src/index.ts', "import { z } from 'zod'\nexport const taskSchema = z.object({})\nexport type Task = z.infer<typeof taskSchema>\n")
  write('packages/contracts/package.json', JSON.stringify({ name: '@project/contracts', dependencies: { zod: '^4' } }))
  write('packages/core/src/lib/db.ts', "import { Pool } from 'pg'\nexport const pool = new Pool()\n")
  write('apps/dev/lib/registry.ts', 'export const registry = {}\n')
  for (const [path, content] of Object.entries(files)) write(path, content)
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }), write }
}

const ts = (await import('node:module')).createRequire(join(REPO_ROOT, 'package.json'))('typescript')
const check = root => checkMobileBoundary({ repoRoot: root, ts })
const summary = result => result.violations.map(v => `${v.file} -> ${v.specifier}: ${v.reason}`)

test('a mobile app that imports its own files, the portable packages and third-party packages passes', () => {
  const { root, cleanup } = repo()
  try {
    const result = check(root)
    assert.deepEqual(result.violations, [])
    assert.equal(result.filesChecked, 7)
  } finally {
    cleanup()
  }
})

test('Node built-ins are refused, with or without the node: prefix and in subpaths', () => {
  const { root, cleanup } = repo({
    'apps/mobile/src/a.ts': "import fs from 'node:fs'\nimport { join } from 'path'\nimport { readFile } from 'fs/promises'\nexport {}\n",
  })
  try {
    assert.deepEqual(summary(check(root)).sort(), [
      'apps/mobile/src/a.ts -> fs/promises: a Node-only module',
      'apps/mobile/src/a.ts -> node:fs: a Node-only module',
      'apps/mobile/src/a.ts -> path: a Node-only module',
    ])
  } finally {
    cleanup()
  }
})

test('server packages are refused: core, next, the database driver, an ORM, the CLI, a plugin', () => {
  const { root, cleanup } = repo({
    'apps/mobile/src/b.ts': [
      "import core from '@nextsparkjs/core'",
      "import { queryWithRLS } from '@nextsparkjs/core/lib/db'",
      "import Image from 'next/image'",
      "import { Pool } from 'pg'",
      "import { drizzle } from 'drizzle-orm/node-postgres'",
      "import '@nextsparkjs/cli'",
      "import '@nextsparkjs/plugin-langchain'",
      "import { auth } from 'better-auth/node'",
      'export {}',
    ].join('\n'),
  })
  try {
    const found = summary(check(root)).map(line => line.split(': ')[0]).sort()
    assert.deepEqual(found, [
      'apps/mobile/src/b.ts -> @nextsparkjs/cli',
      'apps/mobile/src/b.ts -> @nextsparkjs/core',
      'apps/mobile/src/b.ts -> @nextsparkjs/core/lib/db',
      'apps/mobile/src/b.ts -> @nextsparkjs/plugin-langchain',
      'apps/mobile/src/b.ts -> better-auth/node',
      'apps/mobile/src/b.ts -> drizzle-orm/node-postgres',
      'apps/mobile/src/b.ts -> next/image',
      'apps/mobile/src/b.ts -> pg',
    ])
    assert.equal(serverPackageReason('react-native'), null)
    assert.equal(serverPackageReason('nextjs-toast'), null)
    assert.equal(serverPackageReason('postgres-array'), null)
  } finally {
    cleanup()
  }
})

test('a relative path out of the portable packages is refused, whatever it leads to', () => {
  const { root, cleanup } = repo({
    'apps/mobile/src/c.ts': "import { pool } from '../../../packages/core/src/lib/db'\nimport { registry } from '../../dev/lib/registry'\nexport {}\n",
    'apps/mobile/src/d.ts': "import { migration } from './migrations/001_init'\nimport { r } from '../.nextspark/registries/index'\nexport {}\n",
    'apps/mobile/src/migrations/001_init.ts': 'export const migration = 1\n',
    'apps/mobile/.nextspark/registries/index.ts': 'export const r = 1\n',
  })
  try {
    const found = summary(check(root)).sort()
    assert.deepEqual(found, [
      'apps/mobile/src/c.ts -> ../../../packages/core/src/lib/db: server code (packages/core)',
      'apps/mobile/src/c.ts -> ../../dev/lib/registry: project server code',
      'apps/mobile/src/d.ts -> ./migrations/001_init: database migrations',
      'apps/mobile/src/d.ts -> ../.nextspark/registries/index: generated registries',
    ].sort())
  } finally {
    cleanup()
  }
})

test('the check is transitive: a server import three files down, through a portable package, is found with its chain', () => {
  const { root, cleanup } = repo({
    'packages/mobile/src/client.ts': "import { helper } from './helpers/deep'\nexport function createEntityApi<T>(path: string) { return helper(path) as unknown as T }\n",
    'packages/mobile/src/helpers/deep.ts': "import { load } from './loader'\nexport const helper = load\n",
    'packages/mobile/src/helpers/loader.ts': "import { readFileSync } from 'node:fs'\nexport const load = (p: string) => readFileSync(p)\n",
  })
  try {
    const { violations } = check(root)
    assert.deepEqual(violations.map(v => [v.file, v.specifier]), [['packages/mobile/src/helpers/loader.ts', 'node:fs']])
    assert.deepEqual(violations[0].chain.slice(-3), ['packages/mobile/src/client.ts', 'packages/mobile/src/helpers/deep.ts', 'packages/mobile/src/helpers/loader.ts'])
    assert.match(describeViolations(violations).join('\n'), /reached through .*client\.ts -> .*deep\.ts -> .*loader\.ts/)
  } finally {
    cleanup()
  }
})

test('re-exports, dynamic import() and require() count as imports, and every platform variant in the tree is checked', () => {
  const { root, cleanup } = repo({
    'apps/mobile/src/e.ts': "export * from './e-server'\nexport const lazy = () => import('pg')\nconst x = require('node:os')\n",
    'apps/mobile/src/e-server.ts': "export { pool } from '../../../packages/core/src/lib/db'\n",
    'apps/mobile/src/f.web.ts': "import 'node:fs'\nexport {}\n",
    'apps/mobile/src/g.ts': "import './f'\nexport {}\n",
    'apps/mobile/src/f.native.ts': 'export {}\n',
  })
  try {
    const found = summary(check(root)).sort()
    assert.deepEqual(found, [
      'apps/mobile/src/e-server.ts -> ../../../packages/core/src/lib/db: server code (packages/core)',
      'apps/mobile/src/e.ts -> node:os: a Node-only module',
      'apps/mobile/src/e.ts -> pg: the database driver',
      'apps/mobile/src/f.web.ts -> node:fs: a Node-only module',
    ])
  } finally {
    cleanup()
  }
})

test('the portable packages may not declare a server dependency, and the contracts package may not reach server code', () => {
  const { root, cleanup } = repo({
    'packages/ui/package.json': JSON.stringify({ name: '@nextsparkjs/ui', dependencies: { next: '16' }, peerDependencies: { '@nextsparkjs/core': '*' } }),
    'packages/contracts/src/leak.ts': "import { db } from '../../core/src/lib/db'\nexport {}\n",
  })
  try {
    const found = summary(check(root)).sort()
    assert.deepEqual(found, [
      'packages/contracts/src/leak.ts -> ../../core/src/lib/db: server code (packages/core)',
      'packages/ui/package.json -> @nextsparkjs/core: @nextsparkjs/ui declares it in peerDependencies (the server framework)',
      'packages/ui/package.json -> next: @nextsparkjs/ui declares it in dependencies (Next.js)',
    ])
  } finally {
    cleanup()
  }
})

test('a tsconfig alias is followed like any import: `@server/* -> packages/core/*` cannot smuggle server code in', () => {
  const { root, cleanup } = repo({
    'apps/mobile/tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*', './src/*'], '@server/*': ['../../packages/core/src/*'], '@project/contracts': ['../../packages/contracts/src/index.ts'] } } }),
    'apps/mobile/src/viaAlias.ts': "import { pool } from '@server/lib/db'\nexport const p = pool\n",
  })
  try {
    const { violations } = check(root)
    assert.deepEqual(violations.map(v => [v.file, v.specifier, v.reason]), [['apps/mobile/src/viaAlias.ts', '@server/lib/db', 'server code (packages/core)']])
  } finally {
    cleanup()
  }
})

test('an arbitrary workspace package is followed into its sources: server code behind it is found, with the chain', () => {
  const { root, cleanup } = repo({
    'packages/shared/package.json': JSON.stringify({ name: '@acme/shared', main: 'src/index.ts' }),
    'packages/shared/src/index.ts': "export * from './server-bits'\n",
    'packages/shared/src/server-bits.ts': "import { queryWithRLS } from '@nextsparkjs/core/lib/db'\nexport const q = queryWithRLS\n",
    'packages/other/package.json': JSON.stringify({ name: '@acme/other', exports: { '.': './src/main.ts', './extra': './src/extra.ts' } }),
    'packages/other/src/main.ts': 'export const main = 1\n',
    'packages/other/src/extra.ts': "import '../../../apps/dev/lib/registry'\nexport {}\n",
    'apps/mobile/src/useShared.ts': "import { q } from '@acme/shared'\nimport { main } from '@acme/other'\nimport '@acme/other/extra'\nexport const x = [q, main]\n",
  })
  try {
    const { violations } = check(root)
    assert.deepEqual(violations.map(v => [v.file, v.specifier, v.reason]).sort(), [
      ['packages/other/src/extra.ts', '../../../apps/dev/lib/registry', 'project server code'],
      ['packages/shared/src/server-bits.ts', '@nextsparkjs/core/lib/db', 'the server framework'],
    ])
    const shared = violations.find(v => v.file === 'packages/shared/src/server-bits.ts')
    assert.deepEqual(shared.chain.slice(-3), ['apps/mobile/src/useShared.ts', 'packages/shared/src/index.ts', 'packages/shared/src/server-bits.ts'])
  } finally {
    cleanup()
  }
})

test('every runtime entry of a workspace package is followed, the React Native one first: the top-level `react-native` field and the `react-native` export condition', () => {
  const fixtures = {
    'top-level react-native field': {
      'packages/native/package.json': JSON.stringify({ name: '@acme/native', main: 'src/index.ts', types: 'src/index.ts', 'react-native': 'src/native.ts' }),
    },
    'react-native export condition': {
      'packages/native/package.json': JSON.stringify({ name: '@acme/native', exports: { '.': { types: './src/index.ts', 'react-native': './src/native.ts', default: './src/index.ts' } } }),
    },
    'browser and require conditions, nested': {
      'packages/native/package.json': JSON.stringify({ name: '@acme/native', exports: { '.': { types: './src/index.ts', import: { default: './src/index.ts' }, require: './src/index.ts', browser: './src/native.ts' } } }),
    },
    'a subpath export': {
      'packages/native/package.json': JSON.stringify({ name: '@acme/native', exports: { '.': './src/index.ts', './lite': { types: './src/index.ts', 'react-native': './src/native.ts' } } }),
      'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native/lite'\nexport const x = safe\n",
    },
  }
  for (const [name, files] of Object.entries(fixtures)) {
    const { root, cleanup } = repo({
      ...files,
      'packages/native/src/index.ts': 'export const safe = 1\n',
      'packages/native/src/native.ts': "import { pool } from '../../core/src/lib/db'\nexport const safe = pool\n",
      'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native'\nexport const x = safe\n",
      ...(name === 'a subpath export' ? { 'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native/lite'\nexport const x = safe\n" } : {}),
    })
    try {
      const { violations } = check(root)
      assert.deepEqual(violations.map(v => [v.file, v.specifier, v.reason]), [['packages/native/src/native.ts', '../../core/src/lib/db', 'server code (packages/core)']], name)
      assert.ok(violations[0].chain.includes('apps/mobile/src/useNative.ts'), `${name}: the chain names the importing file`)
    } finally {
      cleanup()
    }
  }
})

test('build output entries are checked as they are: committed dist/*.js is parsed and followed, a missing one is mapped to its source, or reported as unverifiable', () => {
  const manifest = { name: '@acme/native', exports: { '.': { types: './dist/index.d.ts', 'react-native': './dist/native.js', default: './src/index.ts' } } }
  const base = {
    'packages/native/package.json': JSON.stringify(manifest),
    'packages/native/src/index.ts': 'export const safe = 1\n',
    'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native'\nexport const x = safe\n",
  }
  const violationsOf = files => {
    const { root, cleanup } = repo({ ...base, ...files })
    try {
      return check(root).violations.map(v => [v.file, v.specifier, v.reason])
    } finally {
      cleanup()
    }
  }
  // committed build output: JavaScript, parsed like source (CommonJS require and ESM import both)
  assert.deepEqual(violationsOf({ 'packages/native/dist/native.js': "const { pool } = require('../../core/src/lib/db')\nexports.safe = pool\n" }), [['packages/native/dist/native.js', '../../core/src/lib/db', 'server code (packages/core)']])
  assert.deepEqual(violationsOf({ 'packages/native/dist/native.js': "import { pool } from '../../core/src/lib/db'\nexport const safe = pool\n", 'packages/native/src/native.ts': 'export const safe = 1\n' }), [['packages/native/dist/native.js', '../../core/src/lib/db', 'server code (packages/core)']])
  // not built: the entry is mapped to its source counterpart (dist/native.js -> src/native.ts)
  assert.deepEqual(violationsOf({ 'packages/native/src/native.ts': "import { pool } from '../../core/src/lib/db'\nexport const safe = pool\n" }), [['packages/native/src/native.ts', '../../core/src/lib/db', 'server code (packages/core)']])
  // not built and no source counterpart: unverifiable, which is a finding, never a silent pass
  assert.deepEqual(violationsOf({}), [['packages/native/package.json', './dist/native.js', '@acme/native has a runtime entry that is build output which is not on disk and has no source counterpart: it cannot be verified']])
  // typings entries (.d.ts) are not runtime: a missing one is nothing to verify
  assert.deepEqual(violationsOf({ 'packages/native/dist/native.js': 'exports.safe = 1\n' }), [])
})

test('wildcard exports (`./*`) are matched like Node does, longest pattern first, for every condition: the react-native target of `./dist/*.native.js` is checked', () => {
  const manifest = { name: '@acme/native', exports: { './*': { 'react-native': './dist/*.native.js', default: './dist/*.js' }, './lite/*': { 'react-native': './dist/lite/*.native.js', default: './dist/lite/*.js' } } }
  const files = {
    'packages/native/package.json': JSON.stringify(manifest),
    'packages/native/src/x.ts': 'export const safe = 1\n',
    'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native/x'\nexport const value = safe\n",
  }
  const violationsOf = extra => {
    const { root, cleanup } = repo({ ...files, ...extra })
    try {
      return check(root).violations.map(v => [v.file, v.specifier, v.reason])
    } finally {
      cleanup()
    }
  }
  // not built: dist/x.native.js is mapped to src/x.native.ts
  assert.deepEqual(violationsOf({ 'packages/native/src/x.native.ts': "import { pool } from '../../core/src/lib/db'\nexport const safe = pool\n" }), [['packages/native/src/x.native.ts', '../../core/src/lib/db', 'server code (packages/core)']])
  // built: the committed dist/x.native.js is what is followed
  assert.deepEqual(violationsOf({ 'packages/native/dist/x.native.js': "const { pool } = require('../../core/src/lib/db')\nexports.safe = pool\n" }), [['packages/native/dist/x.native.js', '../../core/src/lib/db', 'server code (packages/core)']])
  // the longest pattern wins for a nested subpath
  const { root, cleanup } = repo({ ...files, 'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native/lite/y'\nexport const value = safe\n", 'packages/native/src/lite/y.native.ts': "import '../../../core/src/lib/db'\nexport const safe = 1\n", 'packages/native/src/lite/y.ts': 'export const safe = 1\n' })
  try {
    assert.deepEqual(check(root).violations.map(v => [v.file, v.specifier]), [['packages/native/src/lite/y.native.ts', '../../../core/src/lib/db']])
  } finally {
    cleanup()
  }
  // a target no file matches is reported, not passed
  assert.deepEqual(violationsOf({}), [['packages/native/package.json', './dist/x.native.js', '@acme/native has a runtime entry that is build output which is not on disk and has no source counterpart: it cannot be verified']])
})

test("wildcard exports are ordered as Node orders them: `./*.js` beats `./*` for `feature.js`, whichever is declared first", () => {
  const generic = { 'react-native': './src/safe/*.ts', default: './src/safe/*.ts' }
  const specific = { 'react-native': './dist/native/*.js', default: './src/safe/*.ts' }
  const orders = { 'generic first': { './*': generic, './*.js': specific }, 'specific first': { './*.js': specific, './*': generic } }
  for (const [order, exportsField] of Object.entries(orders)) {
    const { root, cleanup } = repo({
      'packages/native/package.json': JSON.stringify({ name: '@acme/native', exports: exportsField }),
      'packages/native/src/safe/feature.js.ts': 'export const feature = 1\n',
      'packages/native/dist/native/feature.js': "const { pool } = require('../../../core/src/lib/db')\nexports.feature = pool\n",
      'apps/mobile/src/useNative.ts': "import { feature } from '@acme/native/feature.js'\nexport const value = feature\n",
    })
    try {
      assert.deepEqual(check(root).violations.map(v => [v.file, v.specifier, v.reason]), [['packages/native/dist/native/feature.js', '../../../core/src/lib/db', 'server code (packages/core)']], order)
    } finally {
      cleanup()
    }
  }
  // the pattern that does not end in .js still serves the other subpaths
  const { root, cleanup } = repo({
    'packages/native/package.json': JSON.stringify({ name: '@acme/native', exports: { './*': { 'react-native': './src/generic/*.ts' }, './*.js': { 'react-native': './src/js/*.ts' } } }),
    'packages/native/src/generic/plain.ts': "import '../../../core/src/lib/db'\nexport const plain = 1\n",
    'packages/native/src/js/plain.ts': 'export const plain = 1\n',
    'apps/mobile/src/useNative.ts': "import { plain } from '@acme/native/plain'\nexport const value = plain\n",
  })
  try {
    assert.deepEqual(check(root).violations.map(v => v.file), ['packages/native/src/generic/plain.ts'])
  } finally {
    cleanup()
  }
})

test('a `paths` alias into a workspace package does not hide the package\'s other runtime entries', () => {
  const { root, cleanup } = repo({
    'apps/mobile/tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*', './src/*'], '@acme/native': ['../../packages/native/src/index.ts'] } } }),
    'packages/native/package.json': JSON.stringify({ name: '@acme/native', 'react-native': 'src/native.ts', main: 'src/index.ts' }),
    'packages/native/src/index.ts': 'export const safe = 1\n',
    'packages/native/src/native.ts': "import { pool } from '../../core/src/lib/db'\nexport const safe = pool\n",
    'apps/mobile/src/useNative.ts': "import { safe } from '@acme/native'\nexport const x = safe\n",
  })
  try {
    assert.deepEqual(check(root).violations.map(v => [v.file, v.specifier, v.reason]), [['packages/native/src/native.ts', '../../core/src/lib/db', 'server code (packages/core)']])
  } finally {
    cleanup()
  }
})

test('a workspace package that declares a server dependency is refused once its files are reached', () => {
  const { root, cleanup } = repo({
    'packages/shared/package.json': JSON.stringify({ name: '@acme/shared', main: 'src/index.ts', dependencies: { pg: '*' } }),
    'packages/shared/src/index.ts': 'export const shared = 1\n',
    'apps/mobile/src/useShared.ts': "import { shared } from '@acme/shared'\nexport const x = shared\n",
  })
  try {
    assert.deepEqual(summary(check(root)), ['packages/shared/package.json -> pg: @acme/shared declares it in dependencies (the database driver)'])
  } finally {
    cleanup()
  }
})

test('a declared React Native polyfill is not Node-only; the same name undeclared, or with node:, still is', () => {
  const polyfill = {
    'apps/mobile/node_modules/buffer/package.json': JSON.stringify({ name: 'buffer', main: 'index.js' }),
    'apps/mobile/node_modules/buffer/index.js': 'exports.Buffer = class Buffer {}\n',
    'apps/mobile/src/usesBuffer.ts': "import { Buffer } from 'buffer'\nexport const b = Buffer\n",
  }
  const declared = repo({ ...polyfill, 'apps/mobile/package.json': JSON.stringify({ name: 'mobile-app', dependencies: { react: '*', buffer: '^6' } }) })
  try {
    assert.deepEqual(check(declared.root).violations, [])
  } finally {
    declared.cleanup()
  }
  const undeclared = repo(polyfill)
  try {
    assert.deepEqual(summary(check(undeclared.root)), ['apps/mobile/src/usesBuffer.ts -> buffer: a Node-only module'])
  } finally {
    undeclared.cleanup()
  }
  const prefixed = repo({ ...polyfill, 'apps/mobile/package.json': JSON.stringify({ name: 'mobile-app', dependencies: { buffer: '^6' } }), 'apps/mobile/src/usesBuffer.ts': "import { Buffer } from 'node:buffer'\nexport const b = Buffer\n" })
  try {
    assert.deepEqual(summary(check(prefixed.root)), ['apps/mobile/src/usesBuffer.ts -> node:buffer: a Node-only module'])
  } finally {
    prefixed.cleanup()
  }
  // Declared but not installed: it resolves to nothing, so it is Node's
  const notInstalled = repo({ 'apps/mobile/package.json': JSON.stringify({ name: 'mobile-app', dependencies: { buffer: '^6' } }), 'apps/mobile/src/usesBuffer.ts': "import 'buffer'\nexport {}\n" })
  try {
    assert.deepEqual(summary(check(notInstalled.root)), ['apps/mobile/src/usesBuffer.ts -> buffer: a Node-only module'])
  } finally {
    notInstalled.cleanup()
  }
})

test('the template tree is checked with its own @/ alias', () => {
  const { root, cleanup } = repo({
    'packages/mobile/templates/src/x.ts': "import { y } from '@/src/y'\nimport { z } from '@/nope'\nexport {}\n",
    'packages/mobile/templates/src/y.ts': "import 'node:crypto'\nexport const y = 1\n",
  })
  try {
    const found = summary(check(root)).sort()
    assert.deepEqual(found, [
      'packages/mobile/templates/src/x.ts -> @/nope: cannot be resolved',
      'packages/mobile/templates/src/y.ts -> node:crypto: a Node-only module',
    ])
  } finally {
    cleanup()
  }
})

test("inside a declaration file, `./x.js` names the sibling `./x.d.ts` (TypeScript's rule): a built package's chunks are followed, not reported as unresolved", () => {
  const manifest = { name: '@acme/native', types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } } }
  const files = extra => ({
    'packages/native/package.json': JSON.stringify(manifest),
    'packages/native/dist/index.js': "export * from './storage-abc.js'\n",
    'packages/native/dist/index.d.ts': "export * from './storage-abc.js'\nexport { x } from './sub/index.js'\n",
    'packages/native/dist/sub/index.d.ts': 'export declare const x: number\n',
    'apps/mobile/src/useNative.ts': "import * as native from '@acme/native'\nexport const y = native\n",
    ...extra,
  })
  const violationsOf = extra => {
    const { root, cleanup } = repo(files(extra))
    try {
      return check(root).violations.map(v => [v.file, v.specifier, v.reason])
    } finally {
      cleanup()
    }
  }
  // the chunk exists as .d.ts (and as .js): nothing to report
  assert.deepEqual(violationsOf({ 'packages/native/dist/storage-abc.js': 'export const s = 1\n', 'packages/native/dist/storage-abc.d.ts': 'export declare const s: number\n' }), [])
  // only the typings chunk exists (a bundler hashes the .d.ts chunks apart from the .js ones): the .js entry's own chunk is not on disk
  assert.deepEqual(violationsOf({ 'packages/native/dist/storage-abc.d.ts': 'export declare const s: number\n' }).filter(([file]) => file.endsWith('.d.ts')), [])
  // the chunk's typings reach server code: still found, through the sibling .d.ts
  assert.deepEqual(violationsOf({ 'packages/native/dist/storage-abc.js': 'export const s = 1\n', 'packages/native/dist/storage-abc.d.ts': "export * from '../../core/src/lib/db'\n" }), [['packages/native/dist/storage-abc.d.ts', '../../core/src/lib/db', 'server code (packages/core)']])
  // a specifier with no file at all is still reported, from the typings as from the runtime entry
  assert.deepEqual(violationsOf({}).map(([file]) => file).sort(), ['packages/native/dist/index.d.ts', 'packages/native/dist/index.js'])
})

test('this repository passes, from the script and the API alike', () => {
  const result = checkMobileBoundary({ repoRoot: REPO_ROOT, ts })
  assert.deepEqual(describeViolations(result.violations), [])
  assert.ok(result.filesChecked > 100, `${result.filesChecked} files checked`)
  const ran = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
  assert.equal(ran.status, 0, ran.stderr)
  assert.match(ran.stdout, /Mobile boundary: \d+ files checked/)
})

test('the script exits 1 and names the chain when a violation is present', () => {
  const { root, cleanup } = repo({ 'apps/mobile/src/h.ts': "import '@nextsparkjs/core/lib/db'\nexport {}\n" })
  try {
    // The script checks the repository it lives in: a copy of it in the temporary repository checks that one
    mkdirSync(join(root, 'scripts/packages'), { recursive: true })
    // The copy imports the check, which core ships, by a path relative to the repository it lives in: point it at the real one
    const checkUrl = new URL(`file://${join(REPO_ROOT, 'packages/core/scripts/build/mobile-boundary.mjs')}`).href
    writeFileSync(join(root, 'scripts/packages/mobile-boundary.mjs'), readFileSync(SCRIPT, 'utf8').replaceAll("'../../packages/core/scripts/build/mobile-boundary.mjs'", JSON.stringify(checkUrl)))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'boundary-fixture' }))
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    symlinkSync(realpathSync(join(REPO_ROOT, 'node_modules/typescript')), join(root, 'node_modules/typescript'), 'dir')
    const ran = spawnSync(process.execPath, [join(root, 'scripts/packages/mobile-boundary.mjs')], { encoding: 'utf8' })
    assert.equal(ran.status, 1, ran.stdout + ran.stderr)
    assert.match(ran.stderr, /Mobile boundary: 1 violation\(s\)/)
    assert.match(ran.stderr, /apps\/mobile\/src\/h\.ts: imports @nextsparkjs\/core\/lib\/db, the server framework/)
  } finally {
    cleanup()
  }
})
