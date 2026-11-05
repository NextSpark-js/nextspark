/**
 * QUERY_MODULES (scripts/maintenance/query-modules.mjs) is the list of core modules whose import brings in React
 * Query. This computes the real closure from the sources of core and fails when the list is out of date, so a new hook
 * built on React Query cannot be left out of the NS_QUERY_HOOK_WITHOUT_PROVIDER finding (#362).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { QUERY_MODULES, QUERY_MODULES_EXCLUDED } from '../../scripts/maintenance/query-modules.mjs'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sources(full, found)
    else if (/\.(?:tsx?|mjs|js)$/.test(entry.name) && !/\.(?:test|spec)\.|\.d\.ts$/.test(entry.name)) found.push(full)
  }
  return found
}

const resolveImport = (from: string, specifier: string): string | null => {
  let base: string
  if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier)
  else if (specifier.startsWith('@/core/')) base = path.join(SRC, specifier.slice('@/core/'.length))
  else return null
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

/** The ids (`hooks/useEntityQuery`) of every module of core that reaches @tanstack/react-query through value imports */
function computedQueryModules(): Set<string> {
  const graph = new Map<string, string[]>()
  const direct = new Set<string>()
  for (const file of sources(SRC)) {
    const text = fs.readFileSync(file, 'utf8')
    const deps: string[] = []
    for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)(\s+type\b)?([^'"`;]*?)\bfrom\s*(['"])([^'"\n]+)\3|(?:^|\n)\s*import\s*(['"])([^'"\n]+)\5|\bimport\(\s*(['"])([^'"\n]+)\7\s*\)/g)) {
      if (match[1]) continue
      const names = /^\s*\{([^}]*)\}\s*$/.exec(match[2] ?? '')
      if (names && names[1].split(',').map(part => part.trim()).filter(Boolean).every(part => /^type\s/.test(part))) continue
      const specifier = match[4] ?? match[6] ?? match[8]
      if (specifier === '@tanstack/react-query') direct.add(file)
      const resolved = resolveImport(file, specifier)
      if (resolved) deps.push(resolved)
    }
    graph.set(file, deps)
  }
  const reaches = new Set(direct)
  for (let changed = true; changed; ) {
    changed = false
    for (const [file, deps] of graph) {
      if (!reaches.has(file) && deps.some(dep => reaches.has(dep))) (reaches.add(file), (changed = true))
    }
  }
  return new Set([...reaches].map(file => path.relative(SRC, file).replace(/\.(?:tsx?|mjs|js)$/, '').replace(/\/index$/, '')).filter(id => id !== 'index'))
}

test('QUERY_MODULES is every module of core that reaches React Query, but the ones excluded on purpose', () => {
  const computed = computedQueryModules()
  const excluded = new Set(Object.keys(QUERY_MODULES_EXCLUDED))
  const expected = [...computed].filter(id => !excluded.has(id)).sort()
  const listed = [...QUERY_MODULES].sort()
  assert.deepEqual(
    listed.filter(id => !expected.includes(id)),
    [],
    'listed, but it does not reach React Query (or is excluded): remove it from QUERY_MODULES',
  )
  assert.deepEqual(
    expected.filter(id => !listed.includes(id)),
    [],
    'reaches React Query and is not listed: add it to QUERY_MODULES, or to QUERY_MODULES_EXCLUDED with the reason',
  )
})

test('every module excluded on purpose still reaches React Query, so the exclusion is not stale', () => {
  const computed = computedQueryModules()
  for (const id of Object.keys(QUERY_MODULES_EXCLUDED)) assert.ok(computed.has(id), `${id} no longer reaches React Query: drop it from QUERY_MODULES_EXCLUDED`)
})

test('every barrel excluded is only re-exports, so excluding it hides no hook of its own', () => {
  for (const [id, reason] of Object.entries(QUERY_MODULES_EXCLUDED)) {
    if (!reason.startsWith('a barrel')) continue
    const file = ['index.ts', 'index.tsx'].map(name => path.join(SRC, id, name)).find(candidate => fs.existsSync(candidate))
    assert.ok(file, `${id} has no index file`)
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(code, /\b(?:function|class|const|let|var)\b|=>/, `${id}/index declares something of its own: list it, do not exclude it`)
  }
})

test('what a project mounts as a provider is excluded, not listed: importing it is the fix', () => {
  for (const id of ['providers/group-providers', 'providers/DashboardProviders', 'providers/query-provider']) {
    assert.ok(id in QUERY_MODULES_EXCLUDED, id)
    assert.ok(!QUERY_MODULES.has(id), id)
  }
})
