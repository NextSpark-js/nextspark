import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// DATABASE_SERVICE_URL falls back to DATABASE_URL only while that is the owner:
// every template that mentions the fallback must also say it is required after the cutover (#479).
const files = [
  '../templates/env.template',
  '../../create-nextspark-app/templates/env.example',
  '../../../.env.example',
]

for (const rel of files) {
  test(`${rel.replace(/^(\.\.\/)+/, '')} says DATABASE_SERVICE_URL is required once DATABASE_URL is nextspark_app`, async () => {
    const text = await readFile(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    assert.match(text, /REQUIRED once DATABASE_URL is[\s#]+(the non-owner )?`nextspark_app`/)
    assert.match(text, /401/)
  })
}
