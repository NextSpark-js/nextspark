import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { applySyncPlan } from '../src/utils/sync-files.js'
import { projectFiles } from '../../core/scripts/build/safe-fs.mjs'
import type { SyncAction } from '../src/utils/sync-plan.js'

test('two syncs in the same millisecond back up into directories of their own', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-sync-files-'))
  const toISOString = Date.prototype.toISOString
  Date.prototype.toISOString = () => '2026-01-01T00:00:00.000Z'
  try {
    const replace: SyncAction = { path: 'i18n.ts', kind: 'update', category: 'root', reason: '', content: Buffer.from('core\n'), backup: true }
    const backupsRoot = join(root, '.nextspark/backups')

    await writeFile(join(root, 'i18n.ts'), 'first edit\n')
    applySyncPlan(root, [replace], backupsRoot, projectFiles(root))
    await writeFile(join(root, 'i18n.ts'), 'second edit\n')
    applySyncPlan(root, [replace], backupsRoot, projectFiles(root))

    const runs = await readdir(backupsRoot)
    const backedUp = await Promise.all(runs.map((run) => readFile(join(backupsRoot, run, 'i18n.ts'), 'utf-8')))
    assert.deepEqual(backedUp.sort(), ['first edit\n', 'second edit\n'])
  } finally {
    Date.prototype.toISOString = toISOString
    await rm(root, { recursive: true, force: true })
  }
})
