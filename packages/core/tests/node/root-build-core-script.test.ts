/**
 * `pnpm build:core` (CONTRIBUTING's second step) must work on a clean checkout: core's tsup inlines
 * @nextsparkjs/ui's dist, so ui has to be built first. `--filter core...` builds core's workspace
 * dependencies before it; a plain `--filter core` failed with "Could not resolve @nextsparkjs/ui".
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'))

test('build:core builds the workspace packages core inlines before it', () => {
  assert.match(read('package.json').scripts['build:core'], /--filter @nextsparkjs\/core\.\.\. build$/)
  assert.equal(read('packages/core/package.json').dependencies['@nextsparkjs/ui'], 'workspace:*')
})
