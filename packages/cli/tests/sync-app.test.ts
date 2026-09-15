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
async function runSync(
  root: string,
  options: { dryRun?: boolean; force?: boolean; verbose?: boolean; overwrite?: string[]; confirm?: (message: string) => Promise<boolean> }
) {
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

/**
 * A stand-in for core's templates-plan.mjs: the registry build would remove
 * app/(templates)/no-confirm.txt, and replace the copy of app/layout.tsx when
 * the sync about to run writes that layout.
 */
const TEMPLATES_PLAN = `let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  const appFiles = JSON.parse(input)
  console.log('Discovering template overrides...')
  console.log('nextspark-templates-plan:' + JSON.stringify({
    create: [],
    replace: 'app/layout.tsx' in appFiles ? ['app/(templates)/layout.tsx'] : [],
    remove: ['app/(templates)/no-confirm.txt'],
  }))
})
`

async function withTemplatesTree(root: string) {
  await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
  await write(root, `${CORE}/scripts/build/templates-plan.mjs`, TEMPLATES_PLAN)
  await write(root, 'app/(templates)/no-confirm.txt', 'mine\n')
}

test('--dry-run names what the registry build would replace or remove in app/(templates), planned on what the sync writes', async () => {
  const { root, cleanup } = await project()
  try {
    await withTemplatesTree(root)

    const printed = await runSync(root, { dryRun: true })

    assert.match(printed, /Would regenerate app\/\(templates\) with the registry build, which would write or remove 2 file\(s\)/)
    assert.match(printed, /~ app\/\(templates\)\/layout\.tsx \(replaced; what it holds is backed up first\)/)
    assert.match(printed, /- app\/\(templates\)\/no-confirm\.txt \(removed; backed up first\)/)
    assert.equal(await readFile(join(root, 'app/(templates)/no-confirm.txt'), 'utf-8'), 'mine\n')
  } finally {
    await cleanup()
  }
})

test('without --force, a sync whose only change is in app/(templates) still asks first, and counts those files', async () => {
  const { root, cleanup } = await project()
  try {
    await runSync(root, { force: true })
    await withTemplatesTree(root)

    const asked: string[] = []
    const printed = await runSync(root, { confirm: async (message) => { asked.push(message); return true } })

    assert.equal(asked.length, 1)
    assert.match(printed, /This will have the registry build write or remove 1 file\(s\) in app\/\(templates\), backing up the 1 it replaces or removes\./)
  } finally {
    await cleanup()
  }
})

test('in a clone with no sync state, a tsconfig.json that differs from core is kept, and reported as undecidable once', async () => {
  const { root, cleanup } = await project()
  try {
    const own = '{ "compilerOptions": { "strict": false } }\n'
    await write(root, 'tsconfig.json', own)

    const first = await runSync(root, { force: true })
    assert.equal(await readFile(join(root, 'tsconfig.json'), 'utf-8'), own)
    assert.match(first, /sync can't tell whether each is an older version of core's or the project's own change/)
    assert.match(first, /\? tsconfig\.json \(to take core's version, backing this one up first: nextspark sync:app --overwrite tsconfig\.json\)/)

    const second = await runSync(root, { force: true })
    assert.equal(await readFile(join(root, 'tsconfig.json'), 'utf-8'), own)
    assert.doesNotMatch(second, /tsconfig\.json/)
  } finally {
    await cleanup()
  }
})
