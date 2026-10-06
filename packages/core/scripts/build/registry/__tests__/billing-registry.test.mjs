/**
 * Tests that generateBillingRegistry's jiti instance keeps its module cache in
 * memory instead of writing it to disk, since jiti's default cache directory
 * falls outside the project whenever the nearest node_modules isn't writable.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/billing-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateBillingRegistry } from '../generators/billing-registry.mjs'
import { silenceConsoleOutput } from './quiet-console.mjs'

silenceConsoleOutput()

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
    const config = {
      projectRoot: join(REPO_ROOT, 'apps/dev'),
      projectSourceDir: join(REPO_ROOT, 'apps/dev'),
      projectName: 'default',
      outputDir: join(cacheRoot.root, 'lib/registries'),
    }

    const output = await generateBillingRegistry(config)

    assert.match(output, /Project: default/)
    const strayEntries = await readdir(cacheRoot.root)
    assert.deepEqual(strayEntries, [], `jiti must not write a module cache under TMPDIR, found: ${strayEntries.join(', ')}`)
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = originalTmpdir
    await cacheRoot.cleanup()
  }
})

// #212: a billing config that exists but cannot load must fail the build, never become an empty registry
async function projectWith(billingSource) {
  const dir = await directory('nextspark-billing-registry-cases-')
  if (billingSource !== undefined) {
    await mkdir(join(dir.root, 'config'), { recursive: true })
    await writeFile(join(dir.root, 'config/billing.config.ts'), billingSource)
  }
  return { ...dir, config: { projectRoot: dir.root, projectSourceDir: dir.root, projectName: 'cases', outputDir: join(dir.root, 'out') } }
}

test('no billing config: the empty registry, the build keeps going', async () => {
  const project = await projectWith(undefined)
  try {
    assert.match(await generateBillingRegistry(project.config), /No billing config found - empty registry generated/)
  } finally { await project.cleanup() }
})

test('a valid billing config is read into the registry', async () => {
  const project = await projectWith(`export const billingConfig = { provider: 'stripe', currency: 'usd', defaultPlan: 'free', features: { api: {} }, limits: { seats: {} }, plans: [{ slug: 'free', visibility: 'public', features: ['api'], limits: { seats: 3 } }] }\n`)
  try {
    const output = await generateBillingRegistry(project.config)
    assert.match(output, /"totalPlans": 1/)
    assert.match(output, /"seats": \{\s+"free": 3/)
  } finally { await project.cleanup() }
})

test('a billing config that throws fails with its file name and the underlying error', async () => {
  const project = await projectWith(`throw new Error('stripe price id is missing')\n`)
  try {
    await assert.rejects(generateBillingRegistry(project.config), (error) => {
      assert.ok(error.message.includes(join(project.root, 'config/billing.config.ts')), error.message)
      assert.ok(error.message.includes('stripe price id is missing'), error.message)
      return true
    })
  } finally { await project.cleanup() }
})

test('a billing config with a syntax error or without a billingConfig export also fails', async () => {
  for (const source of ['export const billingConfig = {', 'export const other = 1\n']) {
    const project = await projectWith(source)
    try {
      await assert.rejects(generateBillingRegistry(project.config), /billing\.config\.ts/)
    } finally { await project.cleanup() }
  }
})
