import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'

import { PROJECT_ROOT_ITEMS } from '../src/wizard/generators/index.js'

const INSTRUMENTATION_CONTENT = "export async function register() {\n  // startup readiness + scheduled actions\n}\n"

test('instrumentation.ts is one of the root items the wizard copies into every generated project, without overwriting a project-owned copy', () => {
  const item = PROJECT_ROOT_ITEMS.find((entry) => entry.src === 'instrumentation.ts')
  assert.ok(item, 'instrumentation.ts is listed in PROJECT_ROOT_ITEMS')
  assert.equal(item?.dest, 'instrumentation.ts')
  assert.equal(item?.force, false, "a project's own instrumentation.ts must never be overwritten")
})

/**
 * Exercises the exact copy predicate copyProjectFiles runs for every entry in
 * PROJECT_ROOT_ITEMS (`if (item.force || !destExists) fs.copy(...)`), so this
 * fails red if instrumentation.ts is ever dropped from the list or its force
 * flag flips, and green once it copies like every other force:false root file
 * (tsconfig.cypress.json, cypress.d.ts, eslint.config.mjs) already does.
 */
async function copyRootItems(templatesDir: string, projectDir: string): Promise<void> {
  for (const item of PROJECT_ROOT_ITEMS) {
    const srcPath = join(templatesDir, item.src)
    const destPath = join(projectDir, item.dest)
    if (await fs.pathExists(srcPath)) {
      if (item.force || !(await fs.pathExists(destPath))) {
        await fs.copy(srcPath, destPath)
      }
    }
  }
}

test('a freshly generated project ends up with instrumentation.ts on disk', async () => {
  const templatesDir = await mkdtemp(join(tmpdir(), 'nextspark-templates-'))
  const projectDir = await mkdtemp(join(tmpdir(), 'nextspark-project-'))
  try {
    await mkdir(join(templatesDir, 'app'), { recursive: true })
    await writeFile(join(templatesDir, 'instrumentation.ts'), INSTRUMENTATION_CONTENT)

    await copyRootItems(templatesDir, projectDir)

    assert.ok(existsSync(join(projectDir, 'instrumentation.ts')), 'the generated project has instrumentation.ts')
    assert.equal(await readFile(join(projectDir, 'instrumentation.ts'), 'utf-8'), INSTRUMENTATION_CONTENT)
  } finally {
    await rm(templatesDir, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  }
})

test("an existing project's own instrumentation.ts survives regeneration/copy", async () => {
  const templatesDir = await mkdtemp(join(tmpdir(), 'nextspark-templates-'))
  const projectDir = await mkdtemp(join(tmpdir(), 'nextspark-project-'))
  try {
    await mkdir(join(templatesDir, 'app'), { recursive: true })
    await writeFile(join(templatesDir, 'instrumentation.ts'), INSTRUMENTATION_CONTENT)
    const projectOwned = "export async function register() {\n  // the project's own customization\n}\n"
    await writeFile(join(projectDir, 'instrumentation.ts'), projectOwned)

    await copyRootItems(templatesDir, projectDir)

    assert.equal(await readFile(join(projectDir, 'instrumentation.ts'), 'utf-8'), projectOwned)
  } finally {
    await rm(templatesDir, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  }
})
