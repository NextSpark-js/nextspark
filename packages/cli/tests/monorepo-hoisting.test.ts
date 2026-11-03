import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createNpmrc, createPnpmWorkspace } from '../src/wizard/generators/monorepo-generator.js'
import { addHoistSettings } from '../src/wizard/generators/workspace-yaml.js'
import { checkHoisting } from '../src/doctor/checks/hoisting.js'

async function inTmp<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-monorepo-hoisting-'))
  try {
    return await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('a generated monorepo carries the hoisting in .npmrc and in pnpm-workspace.yaml (#377)', async () => {
  await inTmp(async root => {
    await writeFile(join(root, 'pnpm-workspace.yaml'), "allowBuilds:\n  'sharp': true\n")
    await createPnpmWorkspace(root)
    await createNpmrc(root)
    const rc = await readFile(join(root, '.npmrc'), 'utf8')
    const yaml = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
    for (const pattern of ['*@nextsparkjs/*', '*expo*', '*react-native*']) {
      assert.ok(rc.includes(`public-hoist-pattern[]=${pattern}\n`))
      assert.ok(yaml.includes(`  - '${pattern}'`))
    }
    assert.ok(rc.includes('shamefully-hoist=true'))
    assert.match(yaml, /^shamefullyHoist: true$/m)
    assert.match(yaml, /^publicHoistPattern:$/m)
    assert.match(yaml, /'sharp': true/, 'the existing keys stay')
  })
})

test('hoisting settings the file already declares are not overwritten or repeated', () => {
  const own = "packages: []\nshamefullyHoist: false\npublicHoistPattern:\n  - 'mine'\n"
  assert.equal(addHoistSettings(own), own)
  const once = addHoistSettings('packages: []\n')
  assert.equal(addHoistSettings(once), once)
})

test('doctor warns when a mobile monorepo has the hoisting only in .npmrc, and passes once it is in the workspace file', async () => {
  await inTmp(async root => {
    await mkdir(join(root, 'mobile'))
    await writeFile(join(root, 'mobile', 'package.json'), '{}')
    await writeFile(join(root, '.npmrc'), 'public-hoist-pattern[]=*expo*\nshamefully-hoist=true\n')
    await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'web'\n")
    const warned = await checkHoisting(root)
    assert.equal(warned.status, 'warn')
    assert.match(warned.message, /shamefullyHoist and publicHoistPattern/)
    await writeFile(join(root, 'pnpm-workspace.yaml'), addHoistSettings("packages:\n  - 'web'\n"))
    assert.equal((await checkHoisting(root)).status, 'pass')
  })
})

test('doctor ignores a project that is not a web + mobile monorepo', async () => {
  await inTmp(async root => {
    assert.equal((await checkHoisting(root)).status, 'pass')
  })
})
