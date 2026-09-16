import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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

interface SyncOptions {
  dryRun?: boolean
  force?: boolean
  backup?: boolean
  verbose?: boolean
  overwrite?: string[]
  confirm?: (message: string) => Promise<boolean>
}

/**
 * Run sync:app from the project root, returning what it printed without colors
 * and the code it would leave the process with (0 when it sets none).
 */
async function runSyncForExit(root: string, options: SyncOptions) {
  const printed: string[] = []
  const original = { log: console.log, warn: console.warn, error: console.error }
  const capture = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  const previousCwd = process.cwd()
  const previousTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
  const previousExitCode = process.exitCode
  delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  process.exitCode = 0

  console.log = capture
  console.warn = capture
  console.error = capture
  process.chdir(root)
  let exitCode: number
  try {
    await syncAppCommand(options)
  } finally {
    exitCode = Number(process.exitCode ?? 0)
    process.exitCode = previousExitCode
    process.chdir(previousCwd)
    Object.assign(console, original)
    if (previousTheme !== undefined) process.env.NEXT_PUBLIC_ACTIVE_THEME = previousTheme
  }

  return { printed: printed.join('\n').replace(/\x1b\[[0-9;]*m/g, ''), exitCode }
}

/** Run sync:app from the project root, returning what it printed without colors. */
async function runSync(root: string, options: SyncOptions) {
  return (await runSyncForExit(root, options)).printed
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
    assert.match(printed, /Would add app\/\(templates\)\/, \.nextspark\/backups\/, \.nextspark\/sync-state\.json, app\.backup\.v\*\/ to \.gitignore/)
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

/** A stand-in for core's registry build that fails the way a template with no default export makes it fail. */
const FAILING_REGISTRY_BUILD = `console.log('Discovering template overrides...')
console.error('@/contents/themes/acme/templates/shop/page.tsx has no default export, and the app has no existing route at "app/shop/page.tsx"')
process.exit(1)
`

test('a registry build that fails is reported as such, with a non-zero exit code and no success message', async () => {
  const { root, cleanup } = await project()
  try {
    await withTemplatesTree(root)
    await write(root, `${CORE}/scripts/build/registry.mjs`, FAILING_REGISTRY_BUILD)

    const { printed, exitCode } = await runSyncForExit(root, { force: true })

    assert.equal(exitCode, 1)
    assert.doesNotMatch(printed, /Sync complete/)
    assert.match(printed, /has no default export/)
    assert.match(printed, /Sync incomplete: \/app now matches core, but app\/\(templates\) was not regenerated\./)
  } finally {
    await cleanup()
  }
})

test('a registry build that is skipped for want of a theme leaves the sync complete, and its exit code zero', async () => {
  const { root, cleanup } = await project()
  try {
    const { printed, exitCode } = await runSyncForExit(root, { force: true })

    assert.equal(exitCode, 0)
    assert.match(printed, /Sync complete/)
  } finally {
    await cleanup()
  }
})

/** Whether git ignores `path` in the repository at `root`. */
function gitIgnores(root: string, path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', path], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * The global Date, giving `new Date()` and Date.now() the same instant until the
 * returned function puts the real one back. The backup directory is named from
 * `new Date()`, so replacing Date.now alone leaves the clock running.
 */
function freezeClock(instant: number): () => void {
  const RealDate = Date
  class Frozen extends RealDate {
    constructor(value: number | string | Date = instant) {
      super(value)
    }

    static now() {
      return instant
    }
  }

  globalThis.Date = Frozen as unknown as DateConstructor
  return () => { globalThis.Date = RealDate }
}

test('--backup gives each run a backup of its own, never written over, and adds it to .gitignore', async () => {
  const { root, cleanup } = await project()
  // A frozen clock is what two runs within the same millisecond look like
  const unfreeze = freezeClock(1_700_000_000_000)
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
    await write(root, 'app/own.tsx', 'export default function Own() { return null }\n')

    await runSync(root, { force: true, backup: true })
    await write(root, 'app/own.tsx', 'export default function Changed() { return null }\n')
    await runSync(root, { force: true, backup: true })

    const backups = (await readdir(root)).filter((name) => name.startsWith('app.backup.')).sort()
    assert.equal(backups.length, 2)
    assert.equal(
      new Set(backups.map((name) => name.slice(0, name.lastIndexOf('-')))).size,
      1,
      `both runs name the same instant, so only mkdtemp's suffix tells them apart: ${backups.join(', ')}`
    )
    // Under the frozen clock the two names differ only by mkdtemp's random
    // suffix, so which run wrote which is not something their order tells
    const kept = await Promise.all(backups.map((name) => readFile(join(root, name, 'own.tsx'), 'utf-8')))
    assert.deepEqual(kept.sort(), [
      'export default function Changed() { return null }\n',
      'export default function Own() { return null }\n',
    ])

    for (const backup of backups) {
      assert.ok(gitIgnores(root, `${backup}/`), `git does not ignore ${backup}`)
    }
  } finally {
    unfreeze()
    await cleanup()
  }
})

test("--backup's own directory and the tree it regenerates end up ignored whatever rule stood in for them", async () => {
  const rest = '.nextspark/\n'
  const cases: { name: string; gitignore: string; nested?: [string, string] }[] = [
    { name: "a rule that names another version's backup", gitignore: `${rest}app/(templates)/\napp.backup.v0.1.0-beta.190.*/\n` },
    { name: 'a rule under **', gitignore: `${rest}**/dashboard/layout.tsx\n**/app.backup.v0.1.0-beta.190.*/**\n` },
    { name: "a negation that un-ignores this version's backups", gitignore: `${rest}app/(templates)/\napp.backup.*/\n!app.backup.v${CORE_VERSION}.*/\n` },
    {
      name: 'a .gitignore inside the generated tree',
      gitignore: `${rest}app.backup.v0.1.0-beta.190.*/\n`,
      nested: ['app/(templates)/dashboard/.gitignore', 'layout.tsx\n'],
    },
  ]

  // Every case runs before anything is asserted, so a failure names all the rules that got through
  const leftOut: string[] = []
  for (const { name, gitignore, nested } of cases) {
    const { root, cleanup } = await project()
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', gitignore)
      await write(root, 'app/(templates)/dashboard/layout.tsx', 'export default function L({ children }) { return children }\n')
      await write(root, 'app/(templates)/(auth)/login/page.tsx', 'export default function Login() { return null }\n')
      if (nested) await write(root, nested[0], nested[1])

      await runSync(root, { force: true, backup: true })

      const [backup] = (await readdir(root)).filter((entry) => entry.startsWith('app.backup.'))
      assert.ok(backup, `${name}: a backup was taken`)
      for (const file of [`${backup}/layout.tsx`, `${backup}/reports/page.tsx`, 'app/(templates)/(auth)/login/page.tsx']) {
        assert.ok(existsSync(join(root, file)), `${name}: ${file} is on disk`)
        if (!gitIgnores(root, file)) leftOut.push(`${name}: ${file}`)
      }
      const untracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf-8' })
        .split('\n')
        .filter((line) => line.includes('app.backup.') || line.includes('app/(templates)/'))
      leftOut.push(...untracked.map((line) => `${name}: untracked ${line.slice(3)}`))
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(leftOut, [])
})
