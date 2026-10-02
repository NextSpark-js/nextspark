/**
 * `@nextsparkjs/core/selectors` binds `sel` to every domain, so a page that imports it ships the superadmin, devtools and block editor
 * maps (~10.5 kB gzip on /login). `@nextsparkjs/core/selectors/<domain>` binds one domain; this keeps each entry's module graph to its
 * own domain file plus the factory, and the values equal to the barrel's.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SELECTORS = path.join(CORE, 'src/lib/selectors')
const ENTRIES = path.join(SELECTORS, 'by-domain')
const RELATIVE = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g

function graph(file: string, seen = new Set<string>()): Set<string> {
  seen.add(path.relative(SELECTORS, file))
  const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') // the factory's docs show imports
  for (const [, spec] of code.matchAll(RELATIVE)) {
    const base = path.resolve(path.dirname(file), spec)
    const target = fs.existsSync(base + '.ts') ? base + '.ts' : path.join(base, 'index.ts')
    if (!seen.has(path.relative(SELECTORS, target))) graph(target, seen)
  }
  return seen
}

const entries = fs.readdirSync(ENTRIES).filter(f => f.endsWith('.ts')).map(f => f.slice(0, -3))

test('every domain of the barrel has a subpath entry, and the package exports them', async () => {
  const domains = fs.readdirSync(path.join(SELECTORS, 'domains')).filter(f => f.endsWith('.selectors.ts')).map(f => f.replace('.selectors.ts', ''))
  assert.deepEqual(entries.sort(), domains.sort())
  const exp = JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')).exports
  assert.equal(exp['./selectors/*'].import, './dist/lib/selectors/by-domain/*.js')
  assert.equal(exp['./selectors/*'].types, './dist/lib/selectors/by-domain/*.d.ts')
  assert.ok(exp['./selectors'], 'the barrel stays')
})

test('a subpath entry reaches its domain file and the factory, nothing else', () => {
  for (const name of entries) {
    assert.deepEqual(
      [...graph(path.join(ENTRIES, `${name}.ts`))].sort(),
      [`by-domain/${name}.ts`, `domains/${name}.selectors.ts`, 'selector-factory.ts'].sort(),
      name,
    )
  }
})

test('the barrel still reaches every domain (the check above would pass on an empty graph)', () => {
  const barrel = graph(path.join(SELECTORS, 'index.ts'))
  for (const name of entries) assert.ok(barrel.has(`domains/${name}.selectors.ts`), name)
})

test('a subpath `sel` resolves the same values as the barrel', async () => {
  const { sel: barrel } = await import(path.join(SELECTORS, 'selectors.ts'))
  const { CORE_SELECTORS } = await import(path.join(SELECTORS, 'core-selectors.ts'))
  for (const name of entries) {
    const { sel } = await import(path.join(ENTRIES, `${name}.ts`))
    const key = Object.keys(CORE_SELECTORS).find(k => k.toLowerCase() === name.replace(/-/g, ''))!
    const leaves: string[] = []
    const walk = (node: unknown, p: string) =>
      typeof node === 'string' ? leaves.push(p) : Object.entries(node as object).forEach(([k, v]) => walk(v, `${p}.${k}`))
    walk(CORE_SELECTORS[key], key)
    assert.ok(leaves.length > 0, name)
    for (const leaf of leaves) assert.equal(sel(leaf), barrel(leaf), leaf)
  }
})

test('the theme toggle reads its selector from the public domain, with the dashboard topnav value', () => {
  const value = (domain: string, key: string) => fs.readFileSync(path.join(SELECTORS, `domains/${domain}.selectors.ts`), 'utf8').match(new RegExp(`${key}: '([^']+)'`, 'g'))
  assert.ok(value('public', 'themeToggle')?.[0].includes("'topnav-theme-toggle'"))
  assert.ok(value('dashboard', 'themeToggle')?.[0].includes("'topnav-theme-toggle'"), 'Cypress still finds it through dashboard.topnav.themeToggle')
})

test('the public navbar, footer and theme toggle do not import the all-domain barrel (they render on every public page)', () => {
  for (const file of ['layouts/PublicNavbar.tsx', 'layouts/PublicFooter.tsx', 'misc/ThemeToggle.tsx']) {
    const code = fs.readFileSync(path.join(CORE, 'src/components/app', file), 'utf8')
    assert.doesNotMatch(code, /from\s+['"][./]*(?:lib\/test|lib\/selectors|selectors)['"]/, file)
    assert.doesNotMatch(code, /@nextsparkjs\/core\/selectors['"]/, file)
  }
})
