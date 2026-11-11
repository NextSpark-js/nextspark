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
      apiDir: 'api',
      features: { billing: true, superadmin: true },
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

test('prints the warning of a flag that is not read, once however many times the config is loaded (#425)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-config-'))
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { features: { teams: false } }\n')
  const warnings = []
  const warn = console.warn
  console.warn = message => warnings.push(message)
  try {
    loadNextSparkConfigSync(root)
    loadNextSparkConfigSync(root)
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /^\[nextspark\] nextspark\.config\.ts: features\.teams is not read/)
  } finally {
    console.warn = warn
    await rm(root, { recursive: true, force: true })
  }
})
