import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PROJECT_ROOT_ITEMS } from '../src/wizard/generators/index.js'
import { writeProxyFile } from '../src/wizard/generators/proxy-file-writer.js'

/**
 * A new project has no src/app (#203): `nextspark dev`, `build` and `prepare` generate it, and it is
 * git-ignored. What the wizard still owes the generated host is the request proxy where Next.js
 * will look for it once src/app exists.
 */
test('the wizard copies no app tree into a project', () => {
  assert.equal(PROJECT_ROOT_ITEMS.some((item) => item.src === 'app' || item.dest === 'src/app' || item.dest.startsWith('src/app/')), false)
})

test('the wizard writes the request proxy to src/, where Next loads it beside the generated src/app', async () => {
  const templates = await mkdtemp(join(tmpdir(), 'nextspark-proxy-templates-'))
  const project = await mkdtemp(join(tmpdir(), 'nextspark-proxy-project-'))
  try {
    await writeFile(join(templates, 'proxy.ts'), 'export async function proxy() { return undefined }\n')
    // Next 16 in the project: the file is proxy.ts
    await mkdir(join(project, 'node_modules/next'), { recursive: true })
    await writeFile(join(project, 'node_modules/next/package.json'), JSON.stringify({ name: 'next', version: '16.3.5' }))
    assert.equal(existsSync(join(project, 'src')), false, 'the project has no src/ yet')

    const result = await writeProxyFile(templates, project, 'src')

    assert.equal(result?.path, 'src/proxy.ts')
    assert.equal(result?.written, true)
    assert.equal(await readFile(join(project, 'src/proxy.ts'), 'utf8'), 'export async function proxy() { return undefined }\n')
    assert.equal(existsSync(join(project, 'proxy.ts')), false)
    assert.equal(existsSync(join(project, 'src/app')), false)
  } finally {
    await rm(templates, { recursive: true, force: true })
    await rm(project, { recursive: true, force: true })
  }
})
