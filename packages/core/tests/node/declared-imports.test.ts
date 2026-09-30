/**
 * Every bare package a file of packages/core/src imports must be declared by core
 * (dependencies, peerDependencies or optionalDependencies).
 *
 * Under strict pnpm a package is resolvable from core only if core lists it: an import that
 * works in the monorepo because another workspace happens to hoist it breaks in a generated
 * project. Before this test `providers/static-intl-provider.tsx` imported `use-intl/react`
 * without declaring `use-intl`, which failed a Cache Components build of an installed project.
 *
 * Not checked: relative and `@/` imports, Node built-ins, core's own subpaths, and
 * `@nextsparkjs/registries` (generated in the project, resolved by its tsconfig paths).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC_DIR = path.join(CORE_DIR, 'src')
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/
const TEST_FILE = /(?:\.test\.|\.spec\.|[\\/]__tests__[\\/]|[\\/]__mocks__[\\/])/
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g
const NOT_DECLARED_BY_CORE = new Set(['@nextsparkjs/core', '@nextsparkjs/registries'])
const BUILTINS = new Set(builtinModules)

/** The package a bare specifier names (`@scope/name/sub` -> `@scope/name`), or null when it is not a bare package. */
export function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('node:')) return null
  const parts = specifier.split('/')
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  if (!/^(?:@[a-z0-9~._-]+\/)?[a-z0-9~._-]+$/i.test(name)) return null
  if (BUILTINS.has(name) || BUILTINS.has(specifier)) return null
  return name
}

/** The bare packages `source` imports (comment lines are skipped so JSDoc examples do not count). */
export function importedPackages(source: string): string[] {
  const code = source.split('\n').filter(line => !/^\s*(?:\*|\/\/|\/\*)/.test(line)).join('\n')
  const found = new Set<string>()
  for (const match of code.matchAll(SPECIFIER)) {
    const name = packageOf(match[2])
    if (name) found.add(name)
  }
  return [...found]
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(full)) yield full
  }
}

test('importedPackages sees imports, dynamic imports and subpaths, and skips relative, built-in and commented ones', () => {
  const source = [
    "import { a } from 'use-intl/react'",
    "import type { B } from '@scope/pkg/sub/deep'",
    "import './local.css'",
    "import fs from 'node:fs'",
    "import path from 'path'",
    "import { c } from '@/lib/c'",
    "const d = await import('lazy-dep')",
    "const e = require('cjs-dep')",
    " * import { x } from 'in-a-comment'",
    "// import y from 'also-a-comment'",
  ].join('\n')
  assert.deepEqual(importedPackages(source).sort(), ['@scope/pkg', 'cjs-dep', 'lazy-dep', 'use-intl'])
})

test('every bare package imported by core source is declared by core', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))
  const declared = new Set<string>()
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) declared.add(name)
  }

  const undeclared = new Map<string, string[]>()
  for (const file of walk(SRC_DIR)) {
    for (const name of importedPackages(fs.readFileSync(file, 'utf8'))) {
      if (declared.has(name) || NOT_DECLARED_BY_CORE.has(name)) continue
      undeclared.set(name, [...(undeclared.get(name) ?? []), path.relative(CORE_DIR, file)])
    }
  }

  assert.deepEqual(
    [...undeclared].map(([name, files]) => `${name} (${files[0]}${files.length > 1 ? ` and ${files.length - 1} more` : ''})`),
    [],
    'packages/core/src imports packages that packages/core/package.json does not declare: add each to "dependencies" (or "peerDependencies"), at the version the workspace already resolves'
  )
})
