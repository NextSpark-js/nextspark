import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { withTemplateAppTestLock } from './template-app-test-lock.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CORE_TEMPLATE_APP = join(REPO_ROOT, 'packages/core/templates/app')
const PACK_SCRIPT = join(REPO_ROOT, 'scripts/packages/pack.sh')

function countFiles(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1
  }
  return count
}

function syncCoreTemplates() {
  return spawnSync('pnpm', ['sync:templates', '--sync'], { cwd: REPO_ROOT, encoding: 'utf8' })
}

test('pack.sh restores an empty core templates/app before it creates the tarball', async () => withTemplateAppTestLock(REPO_ROOT, () => {
  const outputDir = mkdtempSync(join(REPO_ROOT, '.pack-templates-test-'))

  try {
    rmSync(CORE_TEMPLATE_APP, { recursive: true, force: true })

    const result = spawnSync('bash', [PACK_SCRIPT, '--package', 'core', '--skip-build', '--output', outputDir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.ok(countFiles(CORE_TEMPLATE_APP) > 0, 'pack.sh should restore core templates/app before packing')

    const archive = readdirSync(outputDir).find((file) => /^nextsparkjs-core-.*\.tgz$/.test(file))
    assert.ok(archive, `expected a core tarball in ${outputDir}`)
    const listed = spawnSync('tar', ['tzf', join(outputDir, archive)], { encoding: 'utf8' })
    assert.equal(listed.status, 0, listed.stderr || listed.stdout)
    assert.match(listed.stdout, /package\/templates\/app\//, 'the core tarball must include templates/app')
  } finally {
    const restore = syncCoreTemplates()
    rmSync(outputDir, { recursive: true, force: true })
    assert.equal(restore.status, 0, restore.stderr || restore.stdout)
  }
}))
