import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * packages/core/templates/app and packages/mobile/templates/app are
 * gitignored, generated at pack time from apps/dev/app and apps/mobile/app
 * (see .gitignore). sync:all-templates ran its steps without --sync, each
 * script's dry-run mode: it printed the diff, exited 0, and still created
 * the target directory empty (the "target not found" warning does that
 * regardless of mode) - a "target not found" pass that copied nothing looks
 * identical to a real sync unless something counts the files that landed.
 */
test('sync:all-templates copies files into both generated template directories', () => {
  const coreTarget = join(REPO_ROOT, 'packages/core/templates/app')
  const mobileTarget = join(REPO_ROOT, 'packages/mobile/templates/app')

  rmSync(coreTarget, { recursive: true, force: true })
  rmSync(mobileTarget, { recursive: true, force: true })

  try {
    const result = spawnSync('pnpm', ['run', 'sync:all-templates'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr || result.stdout)

    const coreFiles = countFiles(coreTarget)
    const mobileFiles = countFiles(mobileTarget)
    assert.ok(coreFiles > 0, `packages/core/templates/app should not be empty after a passing sync (got ${coreFiles} files)`)
    assert.ok(mobileFiles > 0, `packages/mobile/templates/app should not be empty after a passing sync (got ${mobileFiles} files)`)
  } finally {
    rmSync(coreTarget, { recursive: true, force: true })
    rmSync(mobileTarget, { recursive: true, force: true })
  }
})
