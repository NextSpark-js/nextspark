import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * registry:build, build and dev, run as the built CLI against the real core:
 * whatever command runs the registry build, a place it writes under that isn't
 * safe stops the command before anything is written, in the project or through
 * it, with a code other than 0 and the cause in what it prints - core prints it
 * on stdout.
 */

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let CLI_ENTRY = ''
const CORE_SOURCE = join(PKG_ROOT, '../core')
const BACKUPS_GITIGNORE = '.nextspark/backups/.gitignore'
const RUNS_AS_ROOT = process.getuid?.() === 0

before(() => {
  CLI_ENTRY = buildCli()
})

async function directory(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

async function writeIn(root: string, path: string, content = '') {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

/**
 * A project with the real core installed, a theme template and a stale file in
 * app/(templates) for the build to back up, and a stand-in for Next that only
 * records, outside the project, that it ran.
 */
async function project() {
  const { root, cleanup } = await directory('nextspark-write-check-')
  await writeIn(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await writeIn(root, 'package.json', '{}')
  await writeIn(root, 'app/layout.tsx', 'export default function Layout({ children }) { return children }\n')
  await writeIn(root, 'app/(templates)/stale/page.tsx', 'export default function Stale() { return null }\n')
  await writeIn(root, 'contents/themes/acme/templates/pricing/page.tsx', 'export default function Pricing() { return null }\n')
  await mkdir(join(root, 'node_modules/@nextsparkjs'), { recursive: true })
  await symlink(CORE_SOURCE, join(root, 'node_modules/@nextsparkjs/core'))
  await writeIn(root, 'node_modules/.bin/next', '#!/bin/sh\necho ran >> "$NEXT_RAN"\n')
  await chmod(join(root, 'node_modules/.bin/next'), 0o755)
  return { root, cleanup }
}

/** Every entry under `root` but node_modules: a file by its content's hash, a symlink by where it points, a directory by its name. */
async function snapshot(root: string) {
  const entries: Record<string, string> = {}
  const walk = async (relative: string) => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name
      if (path === 'node_modules') continue
      const stats = await lstat(join(root, path))
      if (stats.isSymbolicLink()) {
        entries[path] = `-> ${await readlink(join(root, path))}`
      } else if (stats.isDirectory()) {
        entries[path] = 'dir'
        await walk(path)
      } else if (stats.mode & 0o400) {
        entries[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex')
      } else {
        entries[path] = 'unreadable file'
      }
    }
  }
  await walk('')
  return entries
}

function runCli(root: string, args: string[], nextRan: string) {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: root,
    timeout: 60_000,
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    env: { ...process.env, NEXT_RAN: nextRan, FORCE_COLOR: '0' },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

const CASES: [string, (root: string, outside: string) => Promise<void>, string][] = [
  ['a registry that is a symlink to a file outside', async (root, outside) => {
    await writeIn(outside, 'index.ts', '// outside\n')
    await mkdir(join(root, '.nextspark/registries'), { recursive: true })
    await symlink(join(outside, 'index.ts'), join(root, '.nextspark/registries/index.ts'))
  }, '.nextspark/registries/index.ts is a symlink'],
  ['app/(templates) a symlink to a directory outside', async (root, outside) => {
    await rm(join(root, 'app/(templates)'), { recursive: true })
    await symlink(outside, join(root, 'app/(templates)'))
  }, 'app/(templates) is a symlink'],
  ['app/api a symlink to a directory outside holding an old generated plugin route and another file', async (root, outside) => {
    await writeIn(outside, 'v1/plugin/legacy/route.ts', '// Auto-generated Plugin Route Proxy\n')
    await writeIn(outside, 'v1/plugin/legacy/other.ts', 'export const other = 1\n')
    await symlink(outside, join(root, 'app/api'))
  }, 'app/api is a symlink'],
  ["the active theme's fixtures directory a symlink to one outside", async (root, outside) => {
    await writeIn(outside, 'entities.json', '{"outside":true}\n')
    await writeIn(outside, 'blocks.json', '{"outside":true}\n')
    await mkdir(join(root, 'contents/themes/acme/tests/cypress'), { recursive: true })
    await symlink(outside, join(root, 'contents/themes/acme/tests/cypress/fixtures'))
  }, 'contents/themes/acme/tests/cypress/fixtures is a symlink'],
  ['a backups .gitignore that takes the backups back', async (root) => {
    await writeIn(root, BACKUPS_GITIGNORE, '*\n!*/\n')
  }, `${BACKUPS_GITIGNORE} has patterns other than *`],
  ...(RUNS_AS_ROOT ? [] : [['a backups .gitignore that cannot be read', async (root: string) => {
    await writeIn(root, BACKUPS_GITIGNORE, '*\n')
    await chmod(join(root, BACKUPS_GITIGNORE), 0)
  }, `${BACKUPS_GITIGNORE} can't be read`] as [string, (root: string, outside: string) => Promise<void>, string]]),
]

const COMMANDS: [string, string[]][] = [
  ['registry:build', ['registry:build']],
  ['build', ['build']],
  ['dev', ['dev', '-p', '4399']],
  ['dev --registry', ['dev', '--registry', '-p', '4399']],
]

test("registry:build, build and dev write nothing and stop with the cause when a place the registry build writes under isn't safe", { skip: process.platform === 'win32', timeout: 600_000 }, async () => {
  const wrong: string[] = []
  for (const [label, setUp, named] of CASES) {
    for (const [command, args] of COMMANDS) {
      const { root, cleanup } = await project()
      const outside = await directory('nextspark-write-check-outside-')
      const nextRan = join(outside.root, 'next-ran')
      try {
        await setUp(root, outside.root)
        const before = { project: await snapshot(root), outside: await snapshot(outside.root) }
        const { status, output } = runCli(root, args, nextRan)
        const after = { project: await snapshot(root), outside: await snapshot(outside.root) }

        const where = `${command}, ${label}`
        if (status === 0 || status === null) wrong.push(`${where}: exited ${status}`)
        if (JSON.stringify(after.project) !== JSON.stringify(before.project)) wrong.push(`${where}: the project changed`)
        if (JSON.stringify(after.outside) !== JSON.stringify(before.outside)) wrong.push(`${where}: what is outside changed`)
        if (existsSync(nextRan)) wrong.push(`${where}: Next ran`)
        if (!output.split('\n').some((line) => line.trim().startsWith(named))) wrong.push(`${where}: no line names ${named}`)
      } finally {
        await chmod(join(root, BACKUPS_GITIGNORE), 0o644).catch(() => {})
        await outside.cleanup()
        await cleanup()
      }
    }
  }

  const { root, cleanup } = await project()
  const outside = await directory('nextspark-write-check-outside-')
  try {
    const { status } = runCli(root, ['registry:build'], join(outside.root, 'next-ran'))
    if (status !== 0) wrong.push(`with nothing in the way, registry:build exited ${status}`)
    if (!existsSync(join(root, '.nextspark/registries/index.ts'))) wrong.push('with nothing in the way, registry:build wrote no registry')
  } finally {
    await outside.cleanup()
    await cleanup()
  }

  assert.deepEqual(wrong, [])
})

test("registry:watch and prepare --watch stop before they start, with the cause and no misleading running message, when a place the registry build writes under isn't safe", { skip: process.platform === 'win32', timeout: 120_000 }, async () => {
  const { root, cleanup } = await project()
  const outside = await directory('nextspark-write-check-outside-')
  try {
    await writeIn(outside.root, 'index.ts', '// outside\n')
    await mkdir(join(root, '.nextspark/registries'), { recursive: true })
    await symlink(join(outside.root, 'index.ts'), join(root, '.nextspark/registries/index.ts'))
    const before = { project: await snapshot(root), outside: await snapshot(outside.root) }

    for (const args of [['registry:watch'], ['prepare', '--watch']]) {
      const { status, output } = runCli(root, args, join(outside.root, 'next-ran'))
      assert.equal(status, 1, `${args.join(' ')}: ${output}`)
      assert.deepEqual(await snapshot(outside.root), before.outside, `${args.join(' ')}: nothing outside changed`)
      assert.deepEqual(await snapshot(root), before.project, `${args.join(' ')}: nothing in the project changed`)
      const lines = output.split('\n')
      assert.ok(lines.some((line) => line.trim().startsWith('.nextspark/registries/index.ts is a symlink')), `${args.join(' ')}: ${output}`)
      assert.deepEqual(lines.filter((line) => /(?<!not )started|running|✔|Watching/.test(line)), [], `${args.join(' ')}: no line says the watcher started`)
    }
  } finally {
    await outside.cleanup()
    await cleanup()
  }
})

test('registry:build, build and dev say when git tracks the registries they rewrite, and how to stop tracking them', { skip: process.platform === 'win32', timeout: 300_000 }, async () => {
  const wrong: string[] = []
  for (const [command, args] of [['registry:build', ['registry:build']], ['build', ['build']], ['dev', ['dev', '-p', '4399']]] as const) {
    const { root, cleanup } = await project()
    const outside = await directory('nextspark-write-check-outside-')
    try {
      await writeIn(root, '.gitignore', 'node_modules/\n.env\napp/(templates)/\n.nextspark/backups/\n')
      await writeIn(root, '.nextspark/registries/index.ts', '// committed before\n')
      spawnSync('git', ['init', '-q'], { cwd: root })
      spawnSync('git', ['add', '-A'], { cwd: root })
      spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: root })

      const { output } = runCli(root, [...args], join(outside.root, 'next-ran'))
      const modified = spawnSync('git', ['status', '--porcelain', '--', '.nextspark/registries'], { cwd: root, encoding: 'utf-8' }).stdout
      const lines = output.split('\n')
      if (!modified.includes('.nextspark/registries/index.ts')) wrong.push(`${command}: the tracked registry is not modified, so there is nothing to warn about: ${modified}`)
      if (!lines.some((line) => line.includes('.nextspark/registries is tracked by git (1 file(s))'))) wrong.push(`${command}: no line says git tracks the registries`)
      if (!lines.some((line) => line.includes('git rm -r --cached .nextspark/registries'))) wrong.push(`${command}: no line says how to stop tracking them`)
    } finally {
      await outside.cleanup()
      await cleanup()
    }
  }
  assert.deepEqual(wrong, [])
})
