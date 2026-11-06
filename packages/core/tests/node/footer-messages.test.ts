/**
 * The `footer` namespace of the six catalogs holds what the default public footer reads and nothing else: it links `/docs`
 * under "resources" and the cookie settings. A key nothing reads is a translation to maintain in six languages for no screen.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FOOTER = fs.readFileSync(path.join(CORE, 'src/components/app/layouts/PublicFooter.tsx'), 'utf8')
const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt']

test('every key of the footer namespace is read by the default public footer, in all six languages', () => {
  const keysOf = (locale: string) => Object.keys(JSON.parse(fs.readFileSync(path.join(CORE, 'src/messages', locale, 'footer.json'), 'utf8'))).sort()
  const english = keysOf('en')
  assert.ok(english.length > 0)
  for (const key of english) assert.ok(FOOTER.includes(`'${key}'`), `footer.${key} is not read by PublicFooter`)
  for (const locale of LOCALES) assert.deepEqual(keysOf(locale), english, locale)
})
