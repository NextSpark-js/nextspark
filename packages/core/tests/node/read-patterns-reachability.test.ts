/**
 * #346: `readPatterns` (a 'use cache' function) takes arbitrary arguments from whoever can call it, so what it
 * returns cannot depend on a check made by its caller. Its team check is the resolver's own SQL; and no module
 * that exposes functions to a client (a 'use server' file) or runs in the browser (a 'use client' file) reaches it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const read = (file: string) => fs.readFileSync(path.join(src, file), 'utf8')

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

test('the pattern read filters by the team it is given and by the published status, inside the resolver', () => {
  const resolver = read('lib/blocks/patterns-resolver.service.ts')
  assert.match(resolver, /AND status = 'published'/)
  assert.match(resolver, /AND "teamId" = \$\$\{validIds\.length \+ 1\}/)
  assert.match(resolver, /\[\.\.\.validIds, teamId\]/)
})

test("readPatterns hands the team to the resolver and the module is not a 'use server' file", () => {
  const source = read('routes/_internal/public-item-route.cc.tsx')
  assert.match(source, /PatternsResolverService\.getByIds\(valid, teamId\)/)
  assert.doesNotMatch(source, /^\s*['"]use server['"]/m)
})

test("no 'use client' or 'use server' module imports it", () => {
  const importers = sourceFiles(src).filter(file => {
    const text = fs.readFileSync(file, 'utf8')
    return /public-item-route\.cc/.test(text) && file !== path.join(src, 'routes/_internal/public-item-route.cc.tsx')
  })
  assert.ok(importers.length > 0, 'expected the route facades to import the module')
  for (const file of importers) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /^\s*['"]use (client|server)['"]/m, path.relative(src, file))
  }
})
