/**
 * A public item or archive URL with nothing behind it must end in notFound(), never in a "not found" element
 * returned with a 200: under the legacy host that is a real 404; under Cache Components the status was already sent
 * with the shell, and notFound() is what makes Next render the not-found page and add noindex
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
  assert.match(source, /if \(!item\) notFound\(\)/)
})

test('the public archive route calls notFound() for an entity without an archive page', () => {
  const source = read('public-archive-route.tsx')
  assert.match(source, /if \(!config\.ui\?\.public\?\.hasArchivePage\) notFound\(\)/)
})

test('the Cache Components item route shares the same notFound() path', () => {
  assert.match(read('public-item-route.cc.tsx'), /bindPublicItemRoutes\(cachedSource\)/)
})

test("core's default public layout does not put the page behind a Suspense boundary", () => {
  // One makes the page's notFound() arrive after the head (200 instead of 404) in the legacy host, for every project
  // that does not override templates/(public)/layout; the Cache Components wrapper adds its own boundary.
  const source = read('default-public-layout.tsx')
  assert.doesNotMatch(source, /<Suspense/)
  assert.match(read('group-layouts.cc.tsx'), /<Suspense fallback=\{null\}>\{children\}<\/Suspense>/)
})
