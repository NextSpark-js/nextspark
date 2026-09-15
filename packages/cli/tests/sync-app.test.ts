import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import { syncAppCommand } from '../src/commands/sync-app.js'

const CORE = 'node_modules/@nextsparkjs/core'
const CORE_VERSION = '0.0.0-test'
const CORE_I18N = "export { default } from '@nextsparkjs/core/i18n'\n"
const CORE_PROXY = 'export async function proxy(request) {\n  return request\n}\n'
const ROOT_LAYOUT = 'export default function RootLayout({ children }) { return children }\n'
const PPR_LAYOUT = 'export default async function RootLayout({ children }) { return children }\n'

async function write(root: string, file: string, content: string) {
  await mkdir(dirname(join(root, file)), { recursive: true })
  await writeFile(join(root, file), content)
}

/**
 * A project on Next 15 with a fake @nextsparkjs/core installed at its root,
 * which is where the CLI looks for core. None of its files carry the generated
 * tag yet: app/layout.tsx, app/layout.ppr.tsx and tsconfig.json are identical
 * to core's, app/dashboard/page.tsx is older than core's, and i18n.ts and
 * next.config.mjs have the project's own changes.
 */
async function project() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-sync-app-'))

  await write(root, `${CORE}/package.json`, JSON.stringify({ name: '@nextsparkjs/core', version: CORE_VERSION }))
  await write(root, `${CORE}/templates/app/layout.tsx`, ROOT_LAYOUT)
  await write(root, `${CORE}/templates/app/layout.ppr.tsx`, PPR_LAYOUT)
  await write(root, `${CORE}/templates/app/dashboard/page.tsx`, 'export default function Dashboard() { return null }\n')
  await write(root, `${CORE}/templates/i18n.ts`, CORE_I18N)
  await write(root, `${CORE}/templates/next.config.mjs`, 'export default {}\n')
  await write(root, `${CORE}/templates/tsconfig.json`, '{}\n')
  await write(root, `${CORE}/templates/proxy.ts`, CORE_PROXY)
  await write(root, 'node_modules/next/package.json', JSON.stringify({ name: 'next', version: '15.5.24' }))
  await write(root, 'package.json', '{}')

  await write(root, 'app/layout.tsx', ROOT_LAYOUT)
  await write(root, 'app/layout.ppr.tsx', PPR_LAYOUT)
  await write(root, 'app/dashboard/page.tsx', 'export default function OldDashboard() { return null }\n')
  await write(root, 'app/reports/page.tsx', 'export default function Reports() { return null }\n')
  await write(root, 'i18n.ts', `${CORE_I18N}export const locales = ['es']\n`)
  await write(root, 'next.config.mjs', 'export default { reactStrictMode: true }\n')
  await write(root, 'tsconfig.json', '{}\n')

  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/** Run sync:app from the project root, returning what it printed without colors. */
async function runSync(root: string, options: { dryRun?: boolean; force?: boolean; verbose?: boolean; overwrite?: string[] }) {
  const printed: string[] = []
  const original = { log: console.log, warn: console.warn, error: console.error }
  const capture = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  const previousCwd = process.cwd()
  const previousTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
  delete process.env.NEXT_PUBLIC_ACTIVE_THEME

  console.log = capture
  console.warn = capture
  console.error = capture
  process.chdir(root)
  try {
    await syncAppCommand(options)
  } finally {
    process.chdir(previousCwd)
    Object.assign(console, original)
    if (previousTheme !== undefined) process.env.NEXT_PUBLIC_ACTIVE_THEME = previousTheme
  }

  return printed.join('\n').replace(/\x1b\[[0-9;]*m/g, '')
}

const TAG_LINE = new RegExp(`^// @nextspark-generated core@${CORE_VERSION.replace(/\./g, '\\.')} path=\\S+ sha256=[0-9a-f]{64}\n`)

test('--dry-run writes nothing and names each file it would write, remove or keep, root files included', async () => {
  const { root, cleanup } = await project()
  try {
    const printed = await runSync(root, { dryRun: true })

    assert.equal(await readFile(join(root, 'app/layout.tsx'), 'utf-8'), ROOT_LAYOUT)
    assert.equal(existsSync(join(root, 'middleware.ts')), false)
    assert.equal(existsSync(join(root, 'app/layout.ppr.tsx')), true)

    assert.match(printed, /\+ middleware\.ts \(core's proxy, under the name Next loads in this project\)/)
    assert.match(printed, /Would tag 1 file\(s\) identical to core/)
    assert.match(printed, /- app\/layout\.ppr\.tsx \(PPR variants stay in core/)
    assert.match(printed, /! i18n\.ts \(differs from core\)/)
    assert.match(printed, /! app\/dashboard\/page\.tsx \(differs from core\)/)
    assert.match(printed, /Would add app\/\(templates\)\/, \.nextspark\/backups\/, \.nextspark\/sync-state\.json to \.gitignore/)
  } finally {
    await cleanup()
  }
})

test('a customized i18n.ts is kept and listed, and --overwrite replaces it with core\'s tagged version after a backup', async () => {
  const { root, cleanup } = await project()
  try {
    const customized = await readFile(join(root, 'i18n.ts'), 'utf-8')

    const kept = await runSync(root, { force: true })
    assert.equal(await readFile(join(root, 'i18n.ts'), 'utf-8'), customized)
    assert.match(kept, /! i18n\.ts \(differs from core\)/)

    const replaced = await runSync(root, { force: true, overwrite: ['i18n.ts'] })
    const i18n = await readFile(join(root, 'i18n.ts'), 'utf-8')
    assert.match(i18n, TAG_LINE)
    assert.ok(i18n.endsWith(CORE_I18N))
    assert.match(replaced, /Backed up i18n\.ts to \.nextspark\/backups\//)

    const backups = await readdir(join(root, '.nextspark/backups'))
    assert.equal(backups.length, 1)
    assert.equal(await readFile(join(root, '.nextspark/backups', backups[0], 'i18n.ts'), 'utf-8'), customized)
  } finally {
    await cleanup()
  }
})

test('running sync again with the same core does not list the customized files again', async () => {
  const { root, cleanup } = await project()
  try {
    await runSync(root, { force: true })
    const again = await runSync(root, { force: true })

    assert.match(again, /Kept 3 customized file\(s\); core changed none of them since the last sync/)
    assert.doesNotMatch(again, /! i18n\.ts/)
  } finally {
    await cleanup()
  }
})

test('an intact layout.ppr.tsx is removed, and a customized one is kept and listed', async () => {
  const intact = await project()
  const customized = await project()
  try {
    await runSync(intact.root, { force: true })
    assert.equal(existsSync(join(intact.root, 'app/layout.ppr.tsx')), false)

    await write(customized.root, 'app/layout.ppr.tsx', `${PPR_LAYOUT}// my change\n`)
    const printed = await runSync(customized.root, { force: true })
    assert.equal(existsSync(join(customized.root, 'app/layout.ppr.tsx')), true)
    assert.match(printed, /! app\/layout\.ppr\.tsx \(PPR variants stay in core, where sync:app reads them when a project uses PPR, but this one differs from core's\)/)
  } finally {
    await intact.cleanup()
    await customized.cleanup()
  }
})

test('a file identical to core is tagged once, and not rewritten after that', async () => {
  const { root, cleanup } = await project()
  try {
    await runSync(root, { force: true })
    const layout = await readFile(join(root, 'app/layout.tsx'), 'utf-8')
    assert.match(layout, TAG_LINE)
    assert.ok(layout.endsWith(ROOT_LAYOUT))

    const before = (await stat(join(root, 'app/layout.tsx'))).mtimeMs
    await new Promise((resolve) => setTimeout(resolve, 20))
    await runSync(root, { force: true })

    assert.equal((await stat(join(root, 'app/layout.tsx'))).mtimeMs, before)
  } finally {
    await cleanup()
  }
})
