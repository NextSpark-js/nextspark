/**
 * Tests for the plan of app/(templates) that sync:app asks core for: what the
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
  await writeProjectFile(root, 'app/shop/layout.tsx', SHOP_LAYOUT)
  await writeProjectFile(root, 'contents/themes/testtheme/templates/shop/pricing/page.tsx', PAGE)
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
  templatePath: '@/contents/themes/testtheme/templates/shop/pricing/page.tsx',
  priority: 10
}

/** Run templates-plan.mjs for `root`, with `appFiles` on stdin, and return its result. */
function plan(root, appFiles = {}) {
  const output = execFileSync(process.execPath, ['scripts/build/templates-plan.mjs'], {
    cwd: coreDir,
    input: JSON.stringify(appFiles),
    encoding: 'utf8',
    env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root, NEXT_PUBLIC_ACTIVE_THEME: 'testtheme' }
  })
  const line = output.split('\n').find(candidate => candidate.startsWith('nextspark-templates-plan:'))
  assert.ok(line, `no result in:\n${output}`)
  return JSON.parse(line.slice('nextspark-templates-plan:'.length))
}

test('a tree not generated yet is planned as created, and a stray file in it as removed, with nothing written', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'app/(templates)/no-confirm.txt', 'mine\n')

    assert.deepEqual(plan(root), {
      create: ['app/(templates)/shop/layout.tsx', 'app/(templates)/shop/pricing/page.tsx'],
      replace: [],
      remove: ['app/(templates)/no-confirm.txt']
    })
    assert.equal(await readFile(join(root, 'app/(templates)/no-confirm.txt'), 'utf8'), 'mine\n')
    assert.equal(existsSync(join(root, 'app/(templates)/shop')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the copy of an app layout the sync is about to change is planned as replaced, though the layout on disk still matches it', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([pricingTemplate], { projectRoot: root })
    const copy = await readFile(join(root, 'app/(templates)/shop/layout.tsx'), 'utf8')

    assert.deepEqual(plan(root), { create: [], replace: [], remove: [] })
    assert.deepEqual(plan(root, { 'app/shop/layout.tsx': `// @nextspark-generated tag line\n${SHOP_LAYOUT}` }), {
      create: [],
      replace: ['app/(templates)/shop/layout.tsx'],
      remove: []
    })
    assert.equal(await readFile(join(root, 'app/(templates)/shop/layout.tsx'), 'utf8'), copy)
    assert.equal(existsSync(join(root, '.nextspark/backups')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
