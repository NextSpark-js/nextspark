import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildFailureLines, registryBuildBlocker, runRegistryBuild, templatesTreeLines } from '../src/utils/registry-build.js'

/** A project root and a fake core whose registry build prints its arguments and exits with `exitCode`. */
async function projectWithCore(exitCode: number) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-registry-build-'))
  const coreDir = join(root, 'core')
  await mkdir(join(coreDir, 'scripts/build'), { recursive: true })
  await writeFile(
    join(coreDir, 'scripts/build/registry.mjs'),
    `console.log('building ' + process.env.NEXTSPARK_PROJECT_ROOT)\n` +
      `console.log('✅ app/(templates): 1 new, 0 updated, 0 removed')\n` +
      `console.error('something on stderr')\n` +
      `process.exit(${exitCode})\n`
  )
  const projectRoot = join(root, 'project')
  await mkdir(projectRoot)
  return { coreDir, projectRoot, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('the active theme can come from .env or from the environment', async () => {
  const { projectRoot, cleanup } = await projectWithCore(0)
  try {
    assert.match(registryBuildBlocker(projectRoot, {}) ?? '', /no \.env file/)
    assert.equal(registryBuildBlocker(projectRoot, { NEXT_PUBLIC_ACTIVE_THEME: 'default' }), null)

    await writeFile(join(projectRoot, '.env'), 'DATABASE_URL=postgres://x\n')
    assert.match(registryBuildBlocker(projectRoot, {}) ?? '', /not set in \.env/)

    await writeFile(join(projectRoot, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME="default"\n')
    assert.equal(registryBuildBlocker(projectRoot, {}), null)
  } finally {
    await cleanup()
  }
})

test('without an active theme the build is skipped, not run', async () => {
  const { coreDir, projectRoot, cleanup } = await projectWithCore(0)
  try {
    const result = await runRegistryBuild(coreDir, projectRoot, {})
    assert.equal(result.status, 'skipped')
    assert.match(result.reason ?? '', /NEXT_PUBLIC_ACTIVE_THEME/)
    assert.equal(result.output, '')
  } finally {
    await cleanup()
  }
})

test('the build runs for the project, and its exit code decides built or failed', async () => {
  const built = await projectWithCore(0)
  const failed = await projectWithCore(1)
  try {
    const env = { ...process.env, NEXT_PUBLIC_ACTIVE_THEME: 'default' }

    const ok = await runRegistryBuild(built.coreDir, built.projectRoot, env)
    assert.equal(ok.status, 'built')
    assert.match(ok.output, new RegExp(`building ${built.projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(ok.output, /something on stderr/)

    assert.equal((await runRegistryBuild(failed.coreDir, failed.projectRoot, env)).status, 'failed')
  } finally {
    await built.cleanup()
    await failed.cleanup()
  }
})

test('only the lines about app/(templates) are picked out of the output', () => {
  const output = '🔍 Discovering templates...\n✅ app/(templates): 1 new, 1 updated, 0 removed\n⚠️  app/(templates): backed up app/(templates)/x/layout.tsx to .nextspark/backups/t/app/(templates)/x/layout.tsx\n📊 Stats:\n'
  assert.deepEqual(templatesTreeLines(output), [
    '✅ app/(templates): 1 new, 1 updated, 0 removed',
    '⚠️  app/(templates): backed up app/(templates)/x/layout.tsx to .nextspark/backups/t/app/(templates)/x/layout.tsx',
  ])
})

test('the cause of a failure comes along when the files it touched push it out of the tail', () => {
  const cause = 'Error: contents/themes/acme/templates/shop/page.tsx has no default export'
  const touched = Array.from({ length: 15 }, (_, index) => `  affected: app/(templates)/page-${index}.tsx`)
  const lines = buildFailureLines(['Discovering template overrides...', cause, ...touched].join('\n'))

  assert.equal(lines[0], cause)
  assert.equal(lines[1], '... 4 earlier line(s)')
  assert.deepEqual(lines.slice(2), touched.slice(-12))
})

test('output that fits under the limit is repeated whole, with nothing marking a gap', () => {
  const output = 'Discovering template overrides...\nError: no default export\n'

  assert.deepEqual(buildFailureLines(output), ['Discovering template overrides...', 'Error: no default export'])
})
