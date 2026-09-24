/**
 * Tests for the plan of src/app/(templates) that sync:app asks core for: what the
 * registry build would create, replace and remove, worked out against app/ as
 * the sync about to run leaves it, with nothing written.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/templates-plan.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateMissingPages } from '../post-build/page-generator.mjs'

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SHOP_LAYOUT = 'export default function ShopLayout({ children }) { return children }\n'
const PAGE = 'export default function Page() { return null }\n'

async function writeProjectFile(root, relativePath, content) {
  await mkdir(dirname(join(root, relativePath)), { recursive: true })
  await writeFile(join(root, relativePath), content, 'utf8')
}

/** A project whose theme has a page template under app/shop, which has a layout of its own. */
async function createProject() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-templates-plan-test-'))
  await writeProjectFile(root, 'nextspark.config.ts', 'export default {}\n')
  await writeProjectFile(root, 'package.json', '{"dependencies":{"next":"16.3.5"}}\n')
  await writeProjectFile(root, 'src/app/shop/layout.tsx', SHOP_LAYOUT)
  await writeProjectFile(root, 'templates/shop/pricing/page.tsx', PAGE)
  return root
}

/** The page template as template discovery reports it. */
const pricingTemplate = {
  name: 'shop/pricing/page',
  themeName: 'testtheme',
  templateType: 'page',
  fileName: 'page.tsx',
  relativePath: 'shop/pricing/page.tsx',
  appPath: 'app/shop/pricing/page.tsx',
  templatePath: '@/templates/shop/pricing/page.tsx',
  priority: 10
}

/** Run templates-plan.mjs for `root`, with `appFiles` on stdin, and return its result. */
function plan(root, appFiles = {}) {
  const output = execFileSync(process.execPath, [join(coreDir, 'scripts/build/templates-plan.mjs')], {
    cwd: root,
    input: JSON.stringify(appFiles),
    encoding: 'utf8',
    env: process.env
  })
  const line = output.split('\n').find(candidate => candidate.startsWith('nextspark-templates-plan:'))
  assert.ok(line, `no result in:\n${output}`)
  return JSON.parse(line.slice('nextspark-templates-plan:'.length))
}

test('a tree not generated yet is planned as created, and a stray file in it as removed, with nothing written', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'src/app/(templates)/no-confirm.txt', 'mine\n')

    assert.deepEqual(plan(root), {
      create: ['src/app/(templates)/shop/layout.tsx', 'src/app/(templates)/shop/pricing/page.tsx'],
      replace: [],
      remove: ['src/app/(templates)/no-confirm.txt']
    })
    assert.equal(await readFile(join(root, 'src/app/(templates)/no-confirm.txt'), 'utf8'), 'mine\n')
    assert.equal(existsSync(join(root, 'src/app/(templates)/shop')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the copy of an app layout the sync is about to change is planned as replaced, though the layout on disk still matches it', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([pricingTemplate], { projectRoot: root })
    const copy = await readFile(join(root, 'src/app/(templates)/shop/layout.tsx'), 'utf8')

    assert.deepEqual(plan(root), { create: [], replace: [], remove: [] })
    assert.deepEqual(plan(root, { 'app/shop/layout.tsx': `// @nextspark-generated tag line\n${SHOP_LAYOUT}` }), {
      create: [],
      replace: ['src/app/(templates)/shop/layout.tsx'],
      remove: []
    })
    assert.equal(await readFile(join(root, 'src/app/(templates)/shop/layout.tsx'), 'utf8'), copy)
    assert.equal(existsSync(join(root, '.nextspark/backups')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a route the sync is about to create takes the template route file out of the plan as removed', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([pricingTemplate], { projectRoot: root })

    assert.deepEqual(plan(root, { 'app/shop/pricing/page.tsx': PAGE }), {
      create: [],
      replace: [],
      remove: ['src/app/(templates)/shop/pricing/page.tsx']
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a route the sync is about to remove puts the template route file back in the plan as created', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'src/app/shop/pricing/page.tsx', PAGE)
    await generateMissingPages([pricingTemplate], { projectRoot: root })

    assert.deepEqual(plan(root), { create: [], replace: [], remove: [] })
    assert.deepEqual(plan(root, { 'app/shop/pricing/page.tsx': null }), {
      create: ['src/app/(templates)/shop/pricing/page.tsx'],
      replace: [],
      remove: []
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
