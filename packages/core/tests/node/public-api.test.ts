/**
 * The public API of @nextsparkjs/core (public-api.json, docs/22-stability-and-support/05-public-api.md).
 *
 * A subpath is public when it is listed, and it is listed when a stable template imports it, it is a
 * configuration contract, or the Public API document names it. The exports map stays open until 2.0,
 * so this test is what keeps a stable template from reaching into an internal subpath.
 *
 * Stable templates: everything under templates/ except the experimental projects (blog, crm, productivity),
 * which are reported, not enforced.
 *
 * "Resolves" means the exports map has a key or pattern for the subpath AND the file it points to exists, so
 * core must be built (CI runs build:js before the node tests).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMPLATES_DIR = path.join(CORE_DIR, 'templates')
const DOCS_DIR = path.join(CORE_DIR, 'docs')
const EXPERIMENTAL = ['blog', 'crm', 'productivity'].map(name => path.join(TEMPLATES_DIR, 'projects', name))
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|css)$/
// A quoted `@nextsparkjs/core[/sub]` covers static imports, re-exports, type imports, import(), JSDoc import types and
// CSS @import. `${` right after the prefix is a specifier built at runtime. Specifiers holding `{` (the `{{member}}` of
// optimizePackageImports) are not subpaths. Comments are not skipped: commented-out code costs a listing, a missed import
// costs a broken project.
const SPECIFIER = /(['"`])@nextsparkjs\/core((?:\/[^'"`\s{}$]*)?)(?:\1|(\$\{))/g
const CSS_URL = /url\(\s*@nextsparkjs\/core((?:\/[^)\s'"`{}]*)?)\s*\)/g
const DYNAMIC = './<built at runtime>'

const manifest = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))
const publicApi = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'public-api.json'), 'utf8')) as {
  reasons: Record<string, string>
  entries: Array<{ subpath: string; reason: string; area: string; stability?: string }>
}
const PUBLIC = new Set(publicApi.entries.map(entry => entry.subpath))

/** The subpaths (`./lib/db`, `.` for the root) a source file imports from @nextsparkjs/core; DYNAMIC for one built with `${}`. */
export function coreSubpaths(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(SPECIFIER)) found.add(match[3] ? DYNAMIC : `.${match[2]}`)
  for (const match of source.matchAll(CSS_URL)) found.add(`.${match[1]}`)
  return [...found]
}

/** The file (relative to core) the exports map points `subpath` at, or null when no key or pattern matches. */
export function exportTarget(subpath: string, table: Record<string, unknown>): string | null {
  let target: unknown = table[subpath]
  if (target === undefined) {
    // Node: among the matching `*` patterns the one with the longest prefix wins; `*` matches at least one character.
    const pattern = Object.keys(table)
      .filter(key => {
        const star = key.indexOf('*')
        return star !== -1 && subpath.length > key.length - 1 && subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1))
      })
      .sort((a, b) => b.indexOf('*') - a.indexOf('*'))[0]
    if (!pattern) return null
    const star = pattern.indexOf('*')
    const matched = subpath.slice(star, subpath.length - (pattern.length - star - 1))
    const fill = (value: unknown): unknown =>
      typeof value === 'string'
        ? value.replaceAll('*', matched)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, fill(inner)]))
          : value
    target = fill(table[pattern])
  }
  const pick = (value: unknown): unknown =>
    value && typeof value === 'object' ? pick((value as Record<string, unknown>).import ?? (value as Record<string, unknown>).default) : value
  const file = pick(target)
  return typeof file === 'string' ? file : null
}

/** Whether `subpath` resolves through the exports map to a file that exists under `coreDir`. */
export function resolvesToFile(subpath: string, table: Record<string, unknown>, coreDir: string): boolean {
  const file = exportTarget(subpath, table)
  return file !== null && fs.existsSync(path.join(coreDir, file))
}

function* walk(dir: string, skip: string[] = []): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.name === 'node_modules' || skip.includes(full)) continue
    if (entry.isDirectory()) yield* walk(full, skip)
    else yield full
  }
}

/** subpath -> files (relative to core) that import it. */
function importsUnder(root: string, skip: string[] = []): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of walk(root, skip)) {
    if (!SOURCE_FILE.test(file)) continue
    for (const subpath of coreSubpaths(fs.readFileSync(file, 'utf8'))) {
      found.set(subpath, [...(found.get(subpath) ?? []), path.relative(CORE_DIR, file)])
    }
  }
  return found
}

test('coreSubpaths sees static, type, dynamic, JSDoc and re-export imports and CSS imports, and flags runtime-built ones', () => {
  const source = [
    "import { a } from '@nextsparkjs/core/lib/db'",
    "import type { B } from \"@nextsparkjs/core/types/blocks\"",
    "const c = await import('@nextsparkjs/core/lib/scheduled-actions')",
    "export * from '@nextsparkjs/core/i18n'",
    "export { default } from '@nextsparkjs/core/i18n'",
    '@import "@nextsparkjs/core/styles/utilities.css";',
    '.a { background: url(@nextsparkjs/core/styles/a.svg) }',
    "transpilePackages: ['@nextsparkjs/core'],",
    "transform: '@nextsparkjs/core/hooks/{{member}}',",
    "/** @type {import('@nextsparkjs/core/lib/config').X} */",
    "/* note */ import z from '@nextsparkjs/core/lib/utils'",
    ' * import(\'@nextsparkjs/core/lib/jsdoc-continuation\')',
    'await import(`@nextsparkjs/core/lib/${name}`)',
    "import w from '@nextsparkjs/core-extra/lib/x'",
    "import z from '@nextsparkjs/registries'",
  ].join('\n')
  assert.deepEqual(coreSubpaths(source).sort(), [
    '.', './<built at runtime>', './i18n', './lib/config', './lib/db', './lib/jsdoc-continuation', './lib/scheduled-actions',
    './lib/utils', './styles/a.svg', './styles/utilities.css', './types/blocks',
  ].sort())
})

test('exportTarget follows exact keys, * patterns (longest prefix, at least one character) and conditions', () => {
  const table = { '.': { import: './dist/index.js' }, './lib/db': './dist/lib/db.js', './lib/*': { types: './dist/lib/*.d.ts', import: './dist/lib/*.js' }, './lib/auth/*': { import: './dist/auth/*.js' }, './s.css': './s.css' }
  assert.equal(exportTarget('.', table), './dist/index.js')
  assert.equal(exportTarget('./lib/db', table), './dist/lib/db.js')
  assert.equal(exportTarget('./lib/utils', table), './dist/lib/utils.js')
  assert.equal(exportTarget('./lib/auth/x', table), './dist/auth/x.js')
  assert.equal(exportTarget('./lib/', table), null)
  assert.equal(exportTarget('./nothing', table), null)
  assert.equal(exportTarget('./s.css', table), './s.css')
})

test('resolvesToFile fails when a pattern matches but the file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-api-'))
  try {
    fs.mkdirSync(path.join(dir, 'dist/lib'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dist/lib/there.js'), '')
    const table = { './lib/*': { import: './dist/lib/*.js' } }
    assert.equal(resolvesToFile('./lib/there', table, dir), true)
    assert.equal(resolvesToFile('./lib/gone', table, dir), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('public-api.json: entries are unique and carry a known reason and stability', () => {
  assert.equal(PUBLIC.size, publicApi.entries.length, 'public-api.json lists a subpath twice')
  for (const entry of publicApi.entries) {
    assert.ok(entry.subpath === '.' || entry.subpath.startsWith('./'), `${entry.subpath}: a subpath starts with "./"`)
    assert.ok(entry.reason in publicApi.reasons, `${entry.subpath}: reason "${entry.reason}" is not one of ${Object.keys(publicApi.reasons).join(', ')}`)
    assert.ok(entry.stability === undefined || entry.stability === 'experimental', `${entry.subpath}: stability is "experimental" or absent`)
    assert.ok(!entry.subpath.includes('*'), `${entry.subpath}: list concrete subpaths, not patterns`)
  }
})

test('every public entry resolves through the exports map of @nextsparkjs/core to a file that exists', () => {
  const gone = publicApi.entries.map(entry => entry.subpath).filter(subpath => !resolvesToFile(subpath, manifest.exports, CORE_DIR))
  assert.deepEqual(gone, [], `public-api.json lists subpaths that do not resolve to a built file (is core built? pnpm --filter @nextsparkjs/core build:js): ${gone.join(', ')}`)
})

test('the Public API document lists every public subpath', () => {
  const doc = fs.readFileSync(path.join(DOCS_DIR, '22-stability-and-support/05-public-api.md'), 'utf8')
  const missing = publicApi.entries.map(entry => entry.subpath).filter(subpath => !doc.includes(`\`${subpath}\``))
  assert.deepEqual(missing, [], `docs/22-stability-and-support/05-public-api.md does not list: ${missing.join(', ')}`)
})

test('stable templates import only public subpaths of @nextsparkjs/core', () => {
  const offenders: string[] = []
  for (const [subpath, files] of importsUnder(TEMPLATES_DIR, EXPERIMENTAL)) {
    if (PUBLIC.has(subpath)) continue
    for (const file of files) {
      offenders.push(subpath === DYNAMIC ? `${file} builds a @nextsparkjs/core specifier at runtime` : `${file} imports @nextsparkjs/core${subpath.slice(1)}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `A stable template imports a subpath that is not public:\n  ${offenders.join('\n  ')}\n` +
      'Import a public subpath instead, or add the subpath to packages/core/public-api.json and docs/22-stability-and-support/05-public-api.md ' +
      '(reason "template-import"): from then on it is covered by SemVer. A specifier built at runtime is never allowed.'
  )
})

test('every template-import entry is still imported by a stable template', () => {
  const imported = importsUnder(TEMPLATES_DIR, EXPERIMENTAL)
  const stale = publicApi.entries.filter(entry => entry.reason === 'template-import' && !imported.has(entry.subpath)).map(entry => entry.subpath)
  assert.deepEqual(stale, [], `No stable template imports these any more; change their reason in public-api.json (config-contract or documented) or deprecate them: ${stale.join(', ')}`)
})

test('experimental templates: report the non-public subpaths they import (informational)', t => {
  for (const root of EXPERIMENTAL) {
    const nonPublic = [...importsUnder(root)].filter(([subpath]) => !PUBLIC.has(subpath)).map(([subpath]) => subpath).sort()
    t.diagnostic(`${path.relative(TEMPLATES_DIR, root)}: ${nonPublic.length} non-public subpath(s)${nonPublic.length ? `: ${nonPublic.join(', ')}` : ''}`)
  }
})

test('docs: report the @nextsparkjs/core subpaths the guides import that are not public (informational)', t => {
  const unlisted = new Map<string, number>()
  for (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/@nextsparkjs\/core(\/[A-Za-z0-9_\-./]*[A-Za-z0-9_-])?/g)) {
      const subpath = `.${match[1] ?? ''}`
      if (!PUBLIC.has(subpath)) unlisted.set(subpath, (unlisted.get(subpath) ?? 0) + 1)
    }
  }
  const lines = [...unlisted].sort(([a], [b]) => a.localeCompare(b)).map(([subpath, count]) => `${subpath} (${count})`)
  t.diagnostic(`${lines.length} subpath(s) named in packages/core/docs are not public; code samples importing them use internal APIs: ${lines.join(', ')}`)
})
