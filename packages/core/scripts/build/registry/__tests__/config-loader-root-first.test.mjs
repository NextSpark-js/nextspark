import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { loadNextSparkConfigSync } from '../../config-loader.mjs'

test('loads defineConfig and applies root-first defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-config-'))
  await writeFile(join(root, 'nextspark.config.ts'), `
    import { defineConfig } from '@nextsparkjs/core/lib/config'
    export default defineConfig({ plugins: ['local'] })
  `)
  try {
    assert.deepEqual(loadNextSparkConfigSync(root), {
      plugins: ['local'],
      features: { billing: true, teams: true, superadmin: true, aiChat: true },
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects unsupported selector fields before discovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-config-'))
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { project: { root: "../other" } }\n')
  try {
    assert.throws(() => loadNextSparkConfigSync(root), /project is not a supported/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
