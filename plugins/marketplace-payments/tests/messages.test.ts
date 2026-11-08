import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES = ['en', 'es', 'de', 'pt', 'fr', 'it']

const catalog = (locale: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'messages', `${locale}.json`), 'utf8'))

function keysOf(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => (typeof child === 'object' && child ? keysOf(child as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]))
}

function placeholders(value: unknown): string {
  return [...String(value).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join()
}

test('the six catalogs have the same keys and the same placeholders', () => {
  const reference = keysOf(catalog('en')).sort()
  for (const locale of LOCALES) {
    assert.deepEqual(keysOf(catalog(locale)).sort(), reference, locale)
    for (const key of reference) {
      const read = (messages: Record<string, unknown>) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages)
      assert.equal(placeholders(read(catalog(locale))), placeholders(read(catalog('en'))), `${locale}:${key}`)
    }
  }
})

test('every key the components read exists, and no visible text is hard-coded in a table or a button', () => {
  const dir = path.join(ROOT, 'components')
  const keys = new Set(keysOf(catalog('en')))
  for (const file of ['SellerSettings.tsx', 'SuperadminOverview.tsx']) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const [, key] of source.matchAll(/\bt\('([\w.]+)'/g)) assert.ok(keys.has(key), `${file}: ${key}`)
    assert.doesNotMatch(source, />\s*[A-Z][a-z]+(\s+[a-z]+)*\s*<\//, file)
  }
  for (const [prefix, values] of [
    ['status.', ['pending', 'active', 'restricted', 'disconnected']],
    ['paymentStatus.', ['pending', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'disputed']],
    ['result.', ['connected', 'invalid_state', 'forbidden', 'already_connected', 'error']],
    ['provider.', ['stripe', 'mercadopago']],
  ] as const) {
    for (const value of values) assert.ok(keys.has(`${prefix}${value}`), `${prefix}${value}`)
  }
})
