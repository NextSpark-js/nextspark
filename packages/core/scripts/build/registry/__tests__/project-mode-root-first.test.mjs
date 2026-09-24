import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { resolveProjectPaths } from '../project-mode.mjs'

async function project(files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-root-first-'))
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await writeFile(join(root, name), contents)
  }
  return root
}

test('the nearest nextspark.config.ts owns every project source path', async () => {
  const root = await project({
    'package.json': JSON.stringify({ dependencies: { next: '16.3.5' } }),
    'nextspark.config.ts': 'export default {}\n',
  })
  const nested = join(root, 'entities', 'tasks')
  await mkdir(nested, { recursive: true })

  try {
    const paths = resolveProjectPaths(nested)
    assert.equal(paths.projectRoot, root)
    assert.equal(paths.projectSourceDir, root)
    assert.equal(paths.pluginsDir, join(root, 'plugins'))
    assert.equal(paths.generatedAppDir, join(root, 'src', 'app'))
    assert.equal(paths.generatedTemplatesDir, join(root, 'src', 'app', '(templates)'))
    assert.equal(paths.outputDir, join(root, '.nextspark', 'registries'))
    assert.equal('themesDir' in paths, false)
    assert.equal('contentsDir' in paths, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a next.config file cannot select a project without nextspark.config.ts', async () => {
  const root = await project({
    'package.json': JSON.stringify({ dependencies: { next: '16.3.5' } }),
    'next.config.mjs': 'export default {}\n',
  })
  try {
    assert.throws(() => resolveProjectPaths(root), /nextspark\.config\.ts/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a project root must declare Next.js', async () => {
  const root = await project({
    'package.json': JSON.stringify({ dependencies: {} }),
    'nextspark.config.ts': 'export default {}\n',
  })
  try {
    assert.throws(() => resolveProjectPaths(root), /declare a non-empty "next" dependency/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
