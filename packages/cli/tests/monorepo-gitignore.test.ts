import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGitignore } from '../src/wizard/generators/monorepo-generator.js'

test('a monorepo .gitignore ignores the web project\'s development uploads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-monorepo-gitignore-'))
  try {
    await createGitignore(root)
    const lines = (await readFile(join(root, '.gitignore'), 'utf8')).split('\n')
    assert.ok(lines.includes('web/public/uploads/temp/'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
