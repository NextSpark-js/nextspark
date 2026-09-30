/**
 * Cache Components + PPR is the default rendering mode for new projects: the
 * scaffold's next.config.mjs (copied by the wizard, web/ of a web+mobile project
 * included) sets it. apps/dev deliberately stays in ISR mode as the CI coverage.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')

test('the scaffold next.config.mjs enables Cache Components', () => {
  assert.match(read('packages/core/templates/next.config.mjs'), /^\s*cacheComponents:\s*true,/m)
})

test('apps/dev stays in legacy ISR mode', () => {
  assert.doesNotMatch(read('apps/dev/next.config.mjs'), /cacheComponents:\s*true/)
})
