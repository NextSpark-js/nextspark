import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runMobileCheck } from '../src/commands/check-mobile.js'

// The core of this repository: it ships the check the command loads
const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../core')

async function workspace(files: Record<string, string> = {}, entries = ['web', 'mobile', 'packages/contracts']) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'nextspark-check-mobile-')))
  const write = async (path: string, content: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  await write('pnpm-workspace.yaml', `packages:\n${entries.map((entry) => `  - '${entry}'`).join('\n')}\n`)
  await write('web/package.json', JSON.stringify({ name: 'web', dependencies: { next: '*' } }))
  await write('web/lib/db.ts', "import { Pool } from 'pg'\nexport const pool = new Pool()\n")
  await write('mobile/package.json', JSON.stringify({ name: 'app-mobile', dependencies: { expo: '*', react: '*' } }))
  await write('mobile/tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }))
  await write('mobile/src/home.ts', "import { Task } from '@app/contracts'\nexport const home: Task | null = null\n")
  await write('packages/contracts/package.json', JSON.stringify({ name: '@app/contracts', dependencies: { zod: '*' } }))
  await write('packages/contracts/src/index.ts', "import { z } from 'zod'\nexport const taskSchema = z.object({})\nexport type Task = z.infer<typeof taskSchema>\n")
  for (const [path, content] of Object.entries(files)) await write(path, content)
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('a mobile app that imports its own files and the contracts passes, the mobile path taken from the workspace', async () => {
  const { root, cleanup } = await workspace()
  try {
    const result = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(result.code, 0, result.lines.join('\n'))
    assert.match(result.lines[0], /in mobile\//)
  } finally {
    await cleanup()
  }
})

test("a mobile file that reaches the web project's server code fails, with the chain", async () => {
  const { root, cleanup } = await workspace({ 'mobile/src/bad.ts': "import { pool } from '../../web/lib/db'\nexport const p = pool\n" })
  try {
    const result = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines.join('\n'), /mobile\/src\/bad\.ts: imports \.\.\/\.\.\/web\/lib\/db, server code \(web\)/)
  } finally {
    await cleanup()
  }
})

test('a Node built-in and a server package in the mobile app fail; the contracts package may not reach the web project either', async () => {
  const { root, cleanup } = await workspace({
    'mobile/src/node.ts': "import { readFileSync } from 'node:fs'\nexport const r = readFileSync\n",
    'packages/contracts/src/leak.ts': "export * from '../../../web/lib/db'\n",
  })
  try {
    const result = await runMobileCheck(join(root, 'web'), CORE_DIR)
    const text = result.lines.join('\n')
    assert.equal(result.code, 1)
    assert.match(text, /mobile\/src\/node\.ts: imports node:fs/)
    assert.match(text, /packages\/contracts\/src\/leak\.ts/)
  } finally {
    await cleanup()
  }
})

test('--mobile names the app, and a workspace with none or two apps says so', async () => {
  const two = await workspace({ 'other/package.json': JSON.stringify({ name: 'other', dependencies: { expo: '*' } }), 'other/src/a.ts': 'export {}\n' }, ['web', 'mobile', 'other', 'packages/contracts'])
  try {
    const ambiguous = await runMobileCheck(join(two.root, 'web'), CORE_DIR)
    assert.equal(ambiguous.code, 1)
    assert.match(ambiguous.lines[0], /More than one mobile app.*--mobile/)
    const named = await runMobileCheck(join(two.root, 'web'), CORE_DIR, { mobile: 'other' })
    assert.equal(named.code, 0, named.lines.join('\n'))
    assert.match(named.lines[0], /in other\//)
  } finally {
    await two.cleanup()
  }
  const none = await workspace({}, ['web', 'packages/contracts'])
  try {
    const result = await runMobileCheck(join(none.root, 'web'), CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines[0], /No mobile app in the workspace/)
  } finally {
    await none.cleanup()
  }
})

test('outside a workspace it says where to run it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nextspark-check-mobile-none-'))
  try {
    const result = await runMobileCheck(dir, CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines[0], /Run check:mobile from the web project/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('--mobile takes an absolute path inside the workspace, and refuses one outside it', async () => {
  const { root, cleanup } = await workspace()
  try {
    const inside = await runMobileCheck(join(root, 'web'), CORE_DIR, { mobile: join(root, 'mobile') })
    assert.equal(inside.code, 0, inside.lines.join('\n'))
    assert.match(inside.lines[0], /in mobile\//)
    const outside = await runMobileCheck(join(root, 'web'), CORE_DIR, { mobile: tmpdir() })
    assert.equal(outside.code, 1)
    assert.match(outside.lines[0], /is not inside the workspace/)
  } finally {
    await cleanup()
  }
})

test('a leak in the contracts package is reported with the chain from the mobile app', async () => {
  const { root, cleanup } = await workspace({ 'mobile/src/home.ts': "import '@app/contracts'\nexport {}\n", 'packages/contracts/src/leak.ts': "export * from '../../../web/lib/db'\n", 'packages/contracts/src/index.ts': "export * from './leak'\n" })
  try {
    const result = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines.join('\n'), /reached through mobile\/src\/home\.ts/)
  } finally {
    await cleanup()
  }
})

test('a web host with its own pnpm-workspace.yaml (separate Vercel root) finds the workspace that lists the mobile app', async () => {
  const { root, cleanup } = await workspace({ 'web/pnpm-workspace.yaml': "packages:\n  - '.'\n" })
  try {
    const result = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(result.code, 0, result.lines.join('\n'))
    assert.match(result.lines[0], /in mobile\//)
    const named = await runMobileCheck(join(root, 'web'), CORE_DIR, { mobile: 'mobile' })
    assert.equal(named.code, 0, named.lines.join('\n'))
    // the web directory is still the server code: a leak into it is found from the nested host too
    await writeFile(join(root, 'mobile/src/bad.ts'), "import { pool } from '../../web/lib/db'\nexport const p = pool\n")
    const leak = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(leak.code, 1)
    assert.match(leak.lines.join('\n'), /server code \(web\)/)
  } finally {
    await cleanup()
  }
})

test('test files Metro never bundles are not checked; the same code in a runtime file still fails', async () => {
  const { root, cleanup } = await workspace({
    'mobile/src/__tests__/copy.test.ts': "import { readFileSync } from 'node:fs'\nexport const r = readFileSync('../../web/messages/es/a.json')\n",
    'mobile/src/home.spec.ts': "import path from 'path'\nexport const p = path\n",
    'mobile/jest.setup.ts': "import 'fs'\n",
  })
  try {
    const ok = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(ok.code, 0, ok.lines.join('\n'))
    await writeFile(join(root, 'mobile/src/runtime.ts'), "import { readFileSync } from 'node:fs'\nexport const r = readFileSync\n")
    const bad = await runMobileCheck(join(root, 'web'), CORE_DIR)
    assert.equal(bad.code, 1)
    assert.match(bad.lines.join('\n'), /mobile\/src\/runtime\.ts: imports node:fs/)
    assert.doesNotMatch(bad.lines.join('\n'), /__tests__|\.spec\./)
  } finally {
    await cleanup()
  }
})

test('the walk up stops at the repository root: a workspace outside the repo that lists an Expo app is not this project\'s', async () => {
  const outer = await realpath(await mkdtemp(join(tmpdir(), 'nextspark-check-mobile-outer-')))
  try {
    const write = async (path: string, content: string) => {
      await mkdir(dirname(join(outer, path)), { recursive: true })
      await writeFile(join(outer, path), content)
    }
    await write('pnpm-workspace.yaml', "packages:\n  - 'repo/web'\n  - 'repo/mobile'\n")
    await write('repo/.git/HEAD', 'ref: refs/heads/main\n')
    await write('repo/web/package.json', JSON.stringify({ name: 'web' }))
    await write('repo/mobile/package.json', JSON.stringify({ name: 'app-mobile', dependencies: { expo: '*' } }))
    await write('repo/mobile/src/a.ts', 'export {}\n')
    const result = await runMobileCheck(join(outer, 'repo/web'), CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines[0], /Run check:mobile from the web project/)
  } finally {
    await rm(outer, { recursive: true, force: true })
  }
})

test('a web project that holds the mobile app inside it (add:mobile layout) is told the two must sit side by side', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'nextspark-check-mobile-inside-')))
  try {
    await mkdir(join(dir, '.git'), { recursive: true })
    await mkdir(join(dir, 'mobile'), { recursive: true })
    await writeFile(join(dir, 'mobile/package.json'), JSON.stringify({ name: 'm', dependencies: { expo: '*' } }))
    const result = await runMobileCheck(dir, CORE_DIR)
    assert.equal(result.code, 1)
    assert.match(result.lines[0], /side by side/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
