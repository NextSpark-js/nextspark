/**
 * A new project ships a favicon at `public/favicon.ico`. Without one, the browser's own request for /favicon.ico
 * matches the public `[slug]` page route: the answer is an HTML "not found" page (a 200 under Cache Components, since the
 * page is streamed), and on a Cache Components host the dev server logs "Could not validate `instant` ..." for the
 * route on every page load.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

for (const dir of ['packages/core/templates/public', 'apps/dev/public']) {
  test(`${dir}/favicon.ico is an icon file`, () => {
    const file = fs.readFileSync(path.join(REPO_ROOT, dir, 'favicon.ico'))
    // ICONDIR: reserved 0, type 1 (icon), at least one image
    assert.equal(file.readUInt16LE(0), 0)
    assert.equal(file.readUInt16LE(2), 1)
    assert.ok(file.readUInt16LE(4) >= 1)
    assert.ok(file.length < 16 * 1024, 'a favicon stays small')
  })
}

test('the wizard copies the template public folder into a new project', () => {
  const generators = fs.readFileSync(path.join(REPO_ROOT, 'packages/cli/src/wizard/generators/index.ts'), 'utf8')
  assert.match(generators, /\{ src: 'public', dest: 'public', force: true \}/)
})
