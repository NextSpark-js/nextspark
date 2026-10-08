/**
 * The public API of @nextsparkjs/core (public-api.json, docs/17-updates/07-public-api.md).
 *
 * A subpath is public when it is listed, and it is listed when a stable template imports it, it is a
 * configuration contract, or the Public API document names it. The exports map stays open until 2.0,
 * so this test is what keeps a stable template from reaching into an internal subpath.
 *
 * Stable templates: everything under templates/ except the experimental projects (blog, crm, productivity),
 * which are reported, not enforced.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMPLATES_DIR = path.join(CORE_DIR, 'templates')
const EXPERIMENTAL = ['blog', 'crm', 'productivity'].map(name => path.join(TEMPLATES_DIR, 'projects', name))
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|css)$/
// A quoted `@nextsparkjs/core[/sub]` covers static imports, re-exports, type imports, import() and CSS @import.
// Specifiers holding `{` (the `{{member}}` of optimizePackageImports) are not subpaths.
const SPECIFIER = /(['"`])@nextsparkjs\/core((?:\/[^'"`\s{}]*)?)\1/g

const manifest = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))
const publicApi = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'public-api.json'), 'utf8')) as {
  reasons: Record<string, string>
  entries: Array<{ subpath: string; reason: string; area: string }>
}
const PUBLIC = new Set(publicApi.entries.map(entry => entry.subpath))

/** The subpaths (`./lib/db`, `.` for the root) a source file imports from @nextsparkjs/core. Comment lines are skipped. */
export function coreSubpaths(source: string): string[] {
  const code = source.split('\n').filter(line => !/^\s*(?:\*|\/\/|\/\*)/.test(line)).join('\n')
  return [...new Set([...code.matchAll(SPECIFIER)].map(match => `.${match[2]}`))]
}

/** Whether `subpath` matches a key of an exports map, exact or through a `*` pattern (the longest prefix wins, as in Node). */
export function resolvesInExports(subpath: string, keys: string[]): boolean {
  if (keys.includes(subpath)) return true
  return keys.some(key => {
    const star = key.indexOf('*')
    if (star === -1) return false
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    return subpath.length >= key.length - 1 && subpath.startsWith(prefix) && subpath.endsWith(suffix)
  })
}


/** subpath -> files (relative to core) that import it. */
function importsUnder(root: string, skip: string[] = []): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.name === 'node_modules' || skip.includes(full)) continue
      if (entry.isDirectory()) visit(full)
      else if (SOURCE_FILE.test(entry.name)) {
        for (const subpath of coreSubpaths(fs.readFileSync(full, 'utf8'))) {
          found.set(subpath, [...(found.get(subpath) ?? []), path.relative(CORE_DIR, full)])
        }
      }
    }
  }
  visit(root)
  return found
}

test('coreSubpaths sees static, type, dynamic and re-export imports and CSS imports, and skips comments and patterns', () => {
  const source = [
    "import { a } from '@nextsparkjs/core/lib/db'",
    "import type { B } from \"@nextsparkjs/core/types/blocks\"",
    "const c = await import('@nextsparkjs/core/lib/scheduled-actions')",
    "export * from '@nextsparkjs/core/i18n'",
    "export { default } from '@nextsparkjs/core/i18n'",
    '@import "@nextsparkjs/core/styles/utilities.css";',
    "transpilePackages: ['@nextsparkjs/core'],",
    "transform: '@nextsparkjs/core/hooks/{{member}}',",
    " * import { x } from '@nextsparkjs/core/lib/in-a-comment'",
    "// import y from '@nextsparkjs/core/lib/also-a-comment'",
    "import z from '@nextsparkjs/registries'",
  ].join('\n')
  assert.deepEqual(coreSubpaths(source).sort(), ['.', './i18n', './lib/db', './lib/scheduled-actions', './styles/utilities.css', './types/blocks'])
})

test('resolvesInExports follows exact keys and * patterns', () => {
  const keys = ['.', './lib/db', './lib/*', './types/*']
  assert.ok(resolvesInExports('.', keys))
  assert.ok(resolvesInExports('./lib/db', keys))
  assert.ok(resolvesInExports('./lib/auth/session-hint', keys))
  assert.ok(!resolvesInExports('./components/ui/button', keys))
  assert.ok(!resolvesInExports('./nothing', keys))
})

test('public-api.json: entries are unique and carry a known reason', () => {
  assert.equal(PUBLIC.size, publicApi.entries.length, 'public-api.json lists a subpath twice')
  for (const entry of publicApi.entries) {
    assert.ok(entry.subpath === '.' || entry.subpath.startsWith('./'), `${entry.subpath}: a subpath starts with "./"`)
    assert.ok(entry.reason in publicApi.reasons, `${entry.subpath}: reason "${entry.reason}" is not one of ${Object.keys(publicApi.reasons).join(', ')}`)
    assert.ok(!entry.subpath.includes('*'), `${entry.subpath}: list concrete subpaths, not patterns`)
  }
})

test('every public entry resolves in the exports map of @nextsparkjs/core', () => {
  const keys = Object.keys(manifest.exports)
  const gone = publicApi.entries.map(entry => entry.subpath).filter(subpath => !resolvesInExports(subpath, keys))
  assert.deepEqual(gone, [], `public-api.json lists subpaths the exports map of package.json no longer resolves: ${gone.join(', ')}`)
})

test('the Public API document lists every public subpath', () => {
  const doc = fs.readFileSync(path.join(CORE_DIR, 'docs/17-updates/07-public-api.md'), 'utf8')
  const missing = publicApi.entries.map(entry => entry.subpath).filter(subpath => !doc.includes(`\`${subpath}\``))
  assert.deepEqual(missing, [], `docs/17-updates/07-public-api.md does not list: ${missing.join(', ')}`)
})

test('stable templates import only public subpaths of @nextsparkjs/core', () => {
  const offenders: string[] = []
  for (const [subpath, files] of importsUnder(TEMPLATES_DIR, EXPERIMENTAL)) {
    if (PUBLIC.has(subpath)) continue
    for (const file of files) offenders.push(`${file} imports @nextsparkjs/core${subpath.slice(1)}`)
  }
  assert.deepEqual(
    offenders,
    [],
    `A stable template imports a subpath that is not public:\n  ${offenders.join('\n  ')}\n` +
      'Import a public subpath instead, or add the subpath to packages/core/public-api.json and docs/17-updates/07-public-api.md ' +
      '(reason "template-import"): from then on it is covered by SemVer.'
  )
})

test('experimental templates: report the non-public subpaths they import (informational)', t => {
  for (const root of EXPERIMENTAL) {
    const nonPublic = [...importsUnder(root)].filter(([subpath]) => !PUBLIC.has(subpath)).map(([subpath]) => subpath).sort()
    t.diagnostic(`${path.relative(TEMPLATES_DIR, root)}: ${nonPublic.length} non-public subpath(s)${nonPublic.length ? `: ${nonPublic.join(', ')}` : ''}`)
  }
})
