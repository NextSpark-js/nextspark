import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { withTemplateAppTestLock } from './template-app-test-lock.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

function countFiles(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    count += entry.isDirectory() ? countFiles(path) : 1
  }
  return count
}

function syncAllTemplates() {
  return spawnSync('pnpm', ['run', 'sync:all-templates'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

/**
 * packages/core/templates/app and packages/mobile/templates/app are
 * gitignored, generated at pack time from apps/dev/app and apps/mobile/app
 * (see .gitignore). Without --sync each sync script runs in dry-run mode: it
 * prints the diff, exits 0 and still creates a missing target directory
 * empty, so a run that copied nothing only shows in how many files landed.
 */
test('sync:all-templates copies files into both generated template directories', async () => withTemplateAppTestLock(REPO_ROOT, () => {
  const coreTarget = join(REPO_ROOT, 'packages/core/templates/app')
  const mobileTarget = join(REPO_ROOT, 'packages/mobile/templates/app')

  rmSync(coreTarget, { recursive: true, force: true })
  rmSync(mobileTarget, { recursive: true, force: true })

  try {
    const result = syncAllTemplates()

    assert.equal(result.status, 0, result.stderr || result.stdout)

    const coreFiles = countFiles(coreTarget)
    const mobileFiles = countFiles(mobileTarget)
    assert.ok(coreFiles > 0, `packages/core/templates/app should not be empty after a passing sync (got ${coreFiles} files)`)
    assert.ok(mobileFiles > 0, `packages/mobile/templates/app should not be empty after a passing sync (got ${mobileFiles} files)`)
  } finally {
    // These directories are generated and ignored, but this test runs in the
    // real checkout as part of mobile:verify. Recreate them from their source
    // apps rather than leaving a successful verification able to poison the
    // next package archive.
    const restore = syncAllTemplates()
    assert.equal(restore.status, 0, restore.stderr || restore.stdout)
    assert.ok(countFiles(coreTarget) > 0, 'packages/core/templates/app should be restored after the test')
    assert.ok(countFiles(mobileTarget) > 0, 'packages/mobile/templates/app should be restored after the test')
  }
}))
