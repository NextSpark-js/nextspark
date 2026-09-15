/**
 * block-registry.ts imports every block component statically, for server
 * rendering. A client component that reaches it, directly or through anything
 * it imports, puts every block and all their dependencies into the browser
 * bundle of its route. Client code reads configs from block-registry.client and
 * renders blocks through block-registry.lazy; this walks the static imports of
 * core's source and of apps/dev/app to keep it that way.
 *
 * Run: cd packages/core && npx tsx --test tests/node/block-registry-client-boundary.test.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const CORE_SRC = resolve(HERE, '../../src')
const APP_DIR = resolve(HERE, '../../../../apps/dev/app')
const REPO = resolve(HERE, '../../../..')
const HEAVY = '@nextsparkjs/registries/block-registry'

function sourcesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourcesUnder(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

const sourceCache = new Map<string, string>()
function source(file: string): string {
  let code = sourceCache.get(file)
  if (code === undefined) {
    code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    sourceCache.set(file, code)
  }
  return code
}

function isClientModule(file: string): boolean {
  return /^\s*['"]use client['"]/.test(source(file))
}

/** Specifiers of static imports and re-exports that carry values; `import type` erases. */
function staticSpecifiers(file: string): string[] {
  const code = source(file)
  const specifiers: string[] = []
  for (const m of code.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
    if (!m[1]) specifiers.push(m[2])
  }
  for (const m of code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specifiers.push(m[1])
  return specifiers
}

function resolveImport(specifier: string, fromFile: string): string | null {
  let base: string
  if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else if (specifier.startsWith('@nextsparkjs/core/')) base = join(CORE_SRC, specifier.slice('@nextsparkjs/core/'.length))
  else if (specifier.startsWith('@/core/')) base = join(CORE_SRC, specifier.slice('@/core/'.length))
  else return null
  const stem = base.replace(/\.js$/, '')
  for (const candidate of [base, `${stem}.ts`, `${stem}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** The static import chain from a module to block-registry.ts, or null when there is none. */
function chainToHeavyRegistry(start: string): string[] | null {
  const seen = new Set<string>()
  const visit = (file: string, path: string[]): string[] | null => {
    if (seen.has(file)) return null
    seen.add(file)
    for (const specifier of staticSpecifiers(file)) {
      if (specifier === HEAVY) return [...path, file, HEAVY]
      const next = resolveImport(specifier, file)
      const found = next ? visit(next, [...path, file]) : null
      if (found) return found
    }
    return null
  }
  return visit(start, [])
}

test('the walk finds block-registry.ts behind the server loader', () => {
  assert.ok(chainToHeavyRegistry(join(CORE_SRC, 'lib/blocks/loader.server.ts')))
})

test('no client component reaches block-registry.ts', () => {
  const offenders = [...sourcesUnder(CORE_SRC), ...sourcesUnder(APP_DIR)]
    .filter(isClientModule)
    .map(chainToHeavyRegistry)
    .filter((chain): chain is string[] => chain !== null)
    .map(chain => chain.map(step => (step.startsWith('/') ? relative(REPO, step) : step)).join('\n      → '))
  assert.deepEqual(offenders, [], `client modules that reach block-registry.ts:\n    ${offenders.join('\n    ')}`)
})
