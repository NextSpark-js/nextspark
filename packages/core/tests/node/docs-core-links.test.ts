/**
 * Core's own docs (packages/core/docs) are kept as internal monorepo
 * reference and never published, so a link to /docs/core/... anywhere in
 * that tree points nowhere real - only naming the page by text is possible.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

const FILES_WITH_CROSS_REFERENCE_EXAMPLES = [
  'packages/core/docs/15-documentation-system/07-extending-overriding.md',
  'packages/core/docs/15-documentation-system/03-core-vs-theme-docs.md',
]

test('internal docs do not link to unpublished /docs/core/ pages', () => {
  for (const file of FILES_WITH_CROSS_REFERENCE_EXAMPLES) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    assert.doesNotMatch(content, /\]\(\/docs\/core\//, `${file} still links to an unpublished core doc page`)
  }
})
