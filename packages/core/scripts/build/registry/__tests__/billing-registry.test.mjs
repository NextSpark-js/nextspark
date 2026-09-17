/**
 * Tests that generateBillingRegistry's jiti instance keeps its module cache in
 * memory instead of writing it to disk, since jiti's default cache directory
 * falls outside the project whenever the nearest node_modules isn't writable.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/billing-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateBillingRegistry } from '../generators/billing-registry.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

async function directory(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test("generateBillingRegistry's jiti import writes nothing under TMPDIR, even when it can't reach a writable node_modules", async () => {
  const cacheRoot = await directory('nextspark-billing-registry-tmpdir-')
  const originalTmpdir = process.env.TMPDIR
  try {
    process.env.TMPDIR = cacheRoot.root
    const themesDir = join(REPO_ROOT, 'themes')
    const config = { themesDir, outputDir: join(cacheRoot.root, 'lib/registries') }

    const output = await generateBillingRegistry('default', join(REPO_ROOT, 'contents'), config)

    assert.match(output, /Active theme: default/)
    const strayEntries = await readdir(cacheRoot.root)
    assert.deepEqual(strayEntries, [], `jiti must not write a module cache under TMPDIR, found: ${strayEntries.join(', ')}`)
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = originalTmpdir
    await cacheRoot.cleanup()
  }
})
