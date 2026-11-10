/**
 * A public item or archive URL with nothing behind it must end in notFound() under the legacy host, never in a "not
 * found" element returned with a 200: that is its real 404. Under Cache Components the status was already sent with
 * the shell, so the item route renders the not-found page in place instead, and its metadata adds noindex (#423)
 * (docs/18-page-builder/07-public-rendering.md, "The status of a URL that has no page").
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const internal = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/routes/_internal')
const read = (file: string) => fs.readFileSync(path.join(internal, file), 'utf8')

test('the public item route calls notFound() when there is no published item', () => {
  const source = read('public-item-route.tsx')
  assert.match(source, /import \{ notFound \} from 'next\/navigation'/)
  // Without a not-found view (the legacy host binds none) a missing item throws notFound()
  assert.match(source, /const missing = NotFoundView \? \(\) => <NotFoundView \/> : \(\) => notFound\(\)/)
  assert.match(source, /return item \?\? missing\(\)/)
  assert.match(source, /const databaseRoutes = bindPublicItemRoutes\(databaseSource\)\n/)
})

test('the public archive route calls notFound() for an entity without an archive page', () => {
  const source = read('public-archive-route.tsx')
  assert.match(source, /if \(!config\.ui\?\.public\?\.hasArchivePage\) notFound\(\)/)
})

test('the Cache Components item route renders a not-found view in place, and its metadata says noindex (#423)', () => {
  assert.match(read('public-item-route.cc.tsx'), /bindPublicItemRoutes\(cachedSource, BuiltinNotFound\)/)
  assert.match(read('public-item-route.tsx'), /noindexMissing \? \{ robots: \{ index: false \} \}/)
})

test("core's default public layout does not put the page behind a Suspense boundary", () => {
  // One makes the page's notFound() arrive after the head (200 instead of 404) in the legacy host, for every project
  // that does not override templates/(public)/layout; the Cache Components wrapper adds its own boundary.
  const source = read('default-public-layout.tsx')
  assert.doesNotMatch(source, /<Suspense/)
  assert.match(read('group-layouts.cc.tsx'), /<Suspense fallback=\{null\}>\{(?:props\.)?children\}<\/Suspense>/)
})
