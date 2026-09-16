import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

    const backups = (await readdir(join(root, '.nextspark/backups'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
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

/**
 * A stand-in for core's registry build that writes a tree of `count` files whose
 * names carry spaces, accents, parentheses and quotes, and backs up what it
 * replaces under .nextspark/backups the way core does.
 */
function treeRegistryBuild(count: number): string {
  return `import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
const root = process.env.NEXTSPARK_PROJECT_ROOT
const write = (file, content) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), content)
}
const backupDir = '.nextspark/backups/' + new Date().toISOString().replace(/[:.]/g, '-') + '-r3g1st'
for (const file of ['app/(templates)/(public)/page.tsx', 'app/(templates)/dashboard/layout.tsx']) {
  if (!existsSync(join(root, file))) continue
  mkdirSync(dirname(join(root, backupDir, file)), { recursive: true })
  copyFileSync(join(root, file), join(root, backupDir, file))
}
for (let i = 0; i < ${count}; i++) {
  write('app/(templates)/deep/with spaces/área/(group ' + (i % 7) + ')/"quoted" page ' + i + '.tsx', 'export default function P() { return null }\\n')
}
for (const file of ['app/(templates)/middleware.ts', 'app/(templates)/dashboard/layout.tsx', 'app/(templates)/(public)/page.tsx', 'app/(templates)/new\\nline.tsx']) {
  write(file, 'export default function Generated() { return null }\\n')
}
console.log('Registry build complete')
`
}

/** The untracked files git status lists under the places sync:app and the registry build write. */
function untrackedGenerated(root: string): string[] {
  return execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf-8' })
    .split('\0')
    .filter((entry) => entry.startsWith('?? '))
    .map((entry) => entry.slice(3))
    .filter((path) => path.startsWith('app/(templates)/') || path.startsWith('.nextspark/') || path.startsWith('app.backup.'))
}

test('nothing a sync writes is left for git, however many files it writes and whatever they are named', { skip: process.platform === 'win32' }, async () => {
  const { root, cleanup } = await project()
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
    await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
    await write(root, `${CORE}/scripts/build/registry.mjs`, treeRegistryBuild(260))
    await write(root, `${CORE}/templates/app/dashboard/layout.tsx`, 'export default function DashboardLayout({ children }) { return children }\n')
    await write(root, `${CORE}/templates/app/(public)/page.tsx`, 'export default function Home() { return null }\n')
    await write(root, 'middleware.ts', 'export function middleware() { return undefined }\n')
    await write(root, 'app/dashboard/layout.tsx', 'export default function MyLayout({ children }) { return children }\n')
    await write(root, 'app/(public)/page.tsx', 'export default function MyHome() { return null }\n')
    await write(root, 'app/(templates)/(public)/page.tsx', 'export default function Earlier() { return null }\n')
    await write(root, 'app/(templates)/dashboard/layout.tsx', 'export default function Earlier({ children }) { return children }\n')
    await write(root, 'app/(marketing)/área "quoted" (2)/page.tsx', 'export default function Page() { return null }\n')
    // Rules that cover a file of each shape under every place a sync writes, and nothing else there
    const shapes = ['middleware.ts', 'dashboard/layout.tsx', '(public)/page.tsx']
    await write(root, '.gitignore', ['app/(templates)', '.nextspark/backups/*', 'app.backup.v*']
      .flatMap((dir) => shapes.map((shape) => `${dir}/${shape}`))
      .concat('.nextspark/sync-state.json', '')
      .join('\n'))

    await runSync(root, {
      force: true,
      backup: true,
      overwrite: ['i18n.ts', 'middleware.ts', 'app/dashboard/layout.tsx', 'app/(public)/page.tsx'],
    })

    const [appBackup] = (await readdir(root)).filter((entry) => entry.startsWith('app.backup.'))
    const [ownBackup, buildBackup] = (await readdir(join(root, '.nextspark/backups'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => Number(a.endsWith('r3g1st')) - Number(b.endsWith('r3g1st')))
    const written = [
      'app/(templates)/deep/with spaces/área/(group 0)/"quoted" page 259.tsx',
      `${appBackup}/(marketing)/área "quoted" (2)/page.tsx`,
      `${appBackup}/(templates)/dashboard/layout.tsx`,
      ...['i18n.ts', 'middleware.ts', 'app/dashboard/layout.tsx', 'app/(public)/page.tsx'].map((file) => `.nextspark/backups/${ownBackup}/${file}`),
      `.nextspark/backups/${buildBackup}/app/(templates)/(public)/page.tsx`,
    ]
    for (const file of written) {
      assert.ok(existsSync(join(root, file)), `${file} is on disk`)
    }
    assert.ok((await readdir(join(root, 'app/(templates)/deep/with spaces/área/(group 0)'))).length > 30)

    assert.deepEqual(untrackedGenerated(root), [])
  } finally {
    await cleanup()
  }
})

/**
 * A stand-in for core's registry build that removes app/(templates)/no-confirm.txt
 * as templates-plan.mjs plans it to, backing the file up first the way core does.
 */
const REMOVING_REGISTRY_BUILD = `import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const root = process.env.NEXTSPARK_PROJECT_ROOT
const backup = join(root, '.nextspark/backups', new Date().toISOString().replace(/[:.]/g, '-') + '-r3g1st', 'app/(templates)')
mkdirSync(backup, { recursive: true })
copyFileSync(join(root, 'app/(templates)/no-confirm.txt'), join(backup, 'no-confirm.txt'))
rmSync(join(root, 'app/(templates)/no-confirm.txt'))
`

test('--dry-run names the .gitignore lines for the backups a run takes, as the run itself adds them', async () => {
  const backupsByShape = 'app/(templates)/\napp.backup.v*/\n.nextspark/sync-state.json\n' +
    '.nextspark/backups/*/middleware.ts\n.nextspark/backups/*/dashboard/layout.tsx\n.nextspark/backups/*/(public)/page.tsx\n'
  const cases: { name: string; gitignore: string; options: SyncOptions; line: string; registry?: boolean }[] = [
    {
      name: "--backup's copy of app/ under the installed core",
      gitignore: 'app/(templates)/\n.nextspark/\napp.backup.v0.1.0-beta.190.*/\n',
      options: { backup: true },
      line: 'app.backup.v*/',
    },
    {
      name: 'the backup --overwrite takes of a customized file',
      gitignore: backupsByShape,
      options: { overwrite: ['i18n.ts'] },
      line: '.nextspark/backups/.gitignore',
    },
    {
      name: 'the backup the registry build takes of a file it is planned to remove',
      gitignore: backupsByShape,
      options: { force: false, confirm: async () => true },
      line: '.nextspark/backups/.gitignore',
      registry: true,
    },
  ]

  // Every case runs before anything is asserted, so a failure names each backup the dry run passes over
  const missed: string[] = []
  for (const { name, gitignore, options, line, registry } of cases) {
    const { root, cleanup } = await project()
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', gitignore)
      if (registry) {
        await withTemplatesTree(root)
        await write(root, `${CORE}/scripts/build/registry.mjs`, REMOVING_REGISTRY_BUILD)
      }

      const planned = await runSync(root, { ...options, dryRun: true })
      const done = await runSync(root, { force: true, ...options })

      if (!gitignoreAdditions(done, 'Added').includes(line)) missed.push(`${name}: the run does not add ${line}`)
      if (!gitignoreAdditions(planned, 'Would add').includes(line)) missed.push(`${name}: the dry run does not name ${line}`)
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(missed, [])
})

/**
 * What a run says it added to .gitignore, or a dry run that it would add
 * (`verb`): each line, and each .gitignore file of its own it adds.
 */
function gitignoreAdditions(printed: string, verb: 'Added' | 'Would add'): string[] {
  return printed.split('\n').flatMap((line) => {
    const toGitignore = line.match(new RegExp(`^  ${verb} (.+) to \\.gitignore$`))
    if (toGitignore) return toGitignore[1].split(', ')
    const ownGitignore = line.match(new RegExp(`^  ${verb} (\\S+\\.gitignore), `))
    return ownGitignore ? [ownGitignore[1]] : []
  })
}

/** Every file under `dir` with what it holds, to tell whether anything there changed. */
async function snapshot(dir: string): Promise<string> {
  const entries = (await readdir(dir, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile() || entry.isSymbolicLink())
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(entry.parentPath, entry.name)
    return `${path.slice(dir.length)}\0${entry.isSymbolicLink() ? '->' : await readFile(path, 'utf-8')}`
  }))
  return files.sort().join('\0')
}

test('a sync writes nothing while .nextspark/backups/.gitignore is a symlink or has patterns other than *, in a dry run too', async () => {
  const cases: { name: string; setUp: (root: string) => Promise<void> }[] = [
    { name: 'a pattern that takes a backup back', setUp: (root) => write(root, '.nextspark/backups/.gitignore', '*\n!manual-snapshots/\n') },
    { name: 'a symlink', setUp: async (root) => {
      await mkdir(join(root, '.nextspark/backups'), { recursive: true })
      await symlink('../../rules', join(root, '.nextspark/backups/.gitignore'))
    } },
  ]

  // Every case runs before anything is asserted, so a failure names each one
  const wrong: string[] = []
  for (const { name, setUp } of cases) {
    const { root, cleanup } = await project()
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', 'app/(templates)/\n.nextspark/sync-state.json\napp.backup.v*/\n')
      await write(root, 'rules', '*\n')
      await setUp(root)
      const before = await snapshot(root)

      for (const options of [{ dryRun: true, overwrite: ['i18n.ts'] }, { force: true, overwrite: ['i18n.ts'] }]) {
        const { printed, exitCode } = await runSyncForExit(root, options)
        const mode = options.dryRun ? 'dry run' : 'run'
        if (exitCode !== 1) wrong.push(`${name}, ${mode}: exit code ${exitCode}`)
        if (/Sync complete/.test(printed)) wrong.push(`${name}, ${mode}: reports success`)
        if (!/\.nextspark\/backups\/\.gitignore (is a symlink|has patterns other than \*)/.test(printed)) wrong.push(`${name}, ${mode}: does not say why`)
      }
      if ((await snapshot(root)) !== before) wrong.push(`${name}: wrote in the project`)
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(wrong, [])
})

/** A stand-in for core's registry build that writes git status to $GIT_STATUS and nothing else. */
const STATUS_TAKING_REGISTRY_BUILD = `import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
writeFileSync(process.env.GIT_STATUS, execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: process.env.NEXTSPARK_PROJECT_ROOT, encoding: 'utf-8' }))
`

test("--backup's copy of app/ is ignored before it is written, whatever .gitignore files it copies from app/", async () => {
  const { root, cleanup } = await project()
  const gitStatus = join(tmpdir(), `nextspark-sync-app-status-${process.pid}-${Date.now()}`)
  const previous = process.env.GIT_STATUS
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
    // A rule for every file under the copies, but not for their directories
    await write(root, '.gitignore', 'app/(templates)/\n.nextspark/\napp.backup.v*/**\n')
    await write(root, 'app/.gitignore', '!visible.txt\n')
    await write(root, 'app/visible.txt', 'SECRET=1\n')
    await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
    await write(root, `${CORE}/scripts/build/registry.mjs`, STATUS_TAKING_REGISTRY_BUILD)
    process.env.GIT_STATUS = gitStatus

    const planned = await runSync(root, { dryRun: true, backup: true })
    const done = await runSync(root, { force: true, backup: true })

    assert.deepEqual(gitignoreAdditions(planned, 'Would add'), ['app.backup.v*/', '.nextspark/backups/.gitignore'])
    assert.deepEqual(gitignoreAdditions(done, 'Added'), ['app.backup.v*/', '.nextspark/backups/.gitignore'])
    const whileTheBuildRan = (await readFile(gitStatus, 'utf-8')).split('\0').filter((entry) => entry.startsWith('?? app.backup.'))
    assert.deepEqual(whileTheBuildRan, [], 'the copy is ignored by the time the registry build runs')
    assert.deepEqual(untrackedGenerated(root), [])
  } finally {
    if (previous === undefined) delete process.env.GIT_STATUS
    else process.env.GIT_STATUS = previous
    await rm(gitStatus, { force: true })
    await cleanup()
  }
})

test("--dry-run names the line for --backup's copy exactly when the run adds it, whatever suffix each draws", async () => {
  // A rule for the copies whose suffix starts with A to M: half the names mkdtemp draws
  const gitignore = 'app/(templates)/\n.nextspark/\napp.backup.v*-[A-M]*/\n'

  // Every attempt runs before anything is asserted; with a suffix drawn apart for each, a name-dependent answer disagrees in some
  const differ: string[] = []
  for (let attempt = 0; attempt < 12; attempt++) {
    const { root, cleanup } = await project()
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', gitignore)

      const planned = gitignoreAdditions(await runSync(root, { dryRun: true, backup: true }), 'Would add')
      const done = gitignoreAdditions(await runSync(root, { force: true, backup: true }), 'Added')
      if (JSON.stringify(planned) !== JSON.stringify(done)) differ.push(`attempt ${attempt}: dry run ${JSON.stringify(planned)}, run ${JSON.stringify(done)}`)
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(differ, [])
})

test('a .gitignore that is a symlink, which git does not read, is not written through, and what git picks up is named with why', async () => {
  const { root, cleanup } = await project()
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
    await write(root, 'rules', 'node_modules/\n')
    await symlink('rules', join(root, '.gitignore'))

    const planned = await runSync(root, { dryRun: true, backup: true })
    const printed = await runSync(root, { force: true, backup: true })

    assert.equal(await readFile(join(root, 'rules'), 'utf-8'), 'node_modules/\n')
    assert.match(planned, /Would not add [^\n]*app\.backup\.v\*\/ to \.gitignore: the project's \.gitignore is a symlink, which git does not read/)
    assert.doesNotMatch(printed, /Added /)
    assert.match(printed, /git still picks up \d+ file\(s\) sync:app wrote: the project's \.gitignore is a symlink, which git does not read/)
    assert.ok(untrackedGenerated(root).length > 0)
  } finally {
    await cleanup()
  }
})

test('a file sync wrote that a .gitignore further down the tree takes back is named, not passed over', async () => {
  const { root, cleanup } = await project()
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
    await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
    await write(root, `${CORE}/scripts/build/registry.mjs`, treeRegistryBuild(9))
    await write(root, 'app/.gitignore', '!(templates)/\n')

    const printed = await runSync(root, { force: true })

    const untracked = untrackedGenerated(root)
    assert.equal(untracked.length, 13, untracked.join('\n'))
    assert.match(printed, /Added app\/\(templates\)\//)
    assert.match(printed, /git still picks up 13 file\(s\) sync:app wrote: a \.gitignore further down the tree un-ignores them/)
    assert.match(printed, /\.\.\. and 3 more; --verbose names every one/)

    const listed = await runSync(root, { force: true, verbose: true })
    for (const path of untracked) {
      const named = path.includes('\n') ? JSON.stringify(path) : path
      assert.ok(listed.split('\n').some((line) => line.trim() === named), `${JSON.stringify(path)} is named on a line of its own`)
    }
    // Another copy of a line git reads before the .gitignore that takes it back changes nothing
    const lines = (await readFile(join(root, '.gitignore'), 'utf-8')).split('\n')
    assert.equal(lines.filter((line) => line === 'app/(templates)/').length, 1, 'app/(templates)/ is in .gitignore once')
  } finally {
    await cleanup()
  }
})

/**
 * A stand-in for core's registry build that backs up app/(templates)/(public)/page.tsx
 * before replacing it, into a directory under .nextspark/backups named the way
 * core names it - or with `suffix` in place of mkdtemp's - and then, with the
 * backup on disk, writes git status to $GIT_STATUS and kills sync:app.
 */
function interruptingRegistryBuild(suffix?: string): string {
  return `import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
const root = process.env.NEXTSPARK_PROJECT_ROOT
const backups = join(root, '.nextspark/backups')
mkdirSync(backups, { recursive: true })
const prefix = join(backups, new Date().toISOString().replace(/[:.]/g, '-') + '-')
const dir = ${suffix ? `prefix + ${JSON.stringify(suffix)}` : 'mkdtempSync(prefix)'}
const file = 'app/(templates)/(public)/page.tsx'
mkdirSync(dirname(join(dir, file)), { recursive: true })
copyFileSync(join(root, file), join(dir, file))
writeFileSync(join(root, file), 'export default function Regenerated() { return null }\\n')
writeFileSync(process.env.GIT_STATUS, execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf-8' }))
process.kill(process.ppid, 'SIGKILL')
`
}

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

test('a sync:app --force killed while the registry build writes leaves no backup for git', { skip: process.platform === 'win32' }, async () => {
  const shapes = ['middleware.ts', 'dashboard/', '(public)/']
  const cases: { name: string; gitignore: string; args: string[]; suffix?: string }[] = [
    {
      name: 'rules for a file of each shape and for the stand-in suffix, with --backup and --overwrite',
      gitignore: 'app/(templates)/\napp.backup.v*/\n.nextspark/sync-state.json\n' +
        shapes.map((shape) => `.nextspark/backups/*/${shape}`).join('\n') + '\n.nextspark/backups/*-XXXXXX/\n',
      args: ['--force', '--backup', '--overwrite', 'i18n.ts'],
    },
    {
      name: 'a rule that takes back the backups of a directory only the registry build names',
      gitignore: 'app/(templates)/\napp.backup.v*/\n.nextspark/sync-state.json\n' +
        shapes.map((shape) => `.nextspark/backups/*/${shape}`).join('\n') + '\n.nextspark/backups/*/app/\n!.nextspark/backups/*-r3g1st/**\n',
      args: ['--force'],
      suffix: 'r3g1st',
    },
  ]

  // Every case runs before anything is asserted, so a failure names each backup git could pick up
  const visible: string[] = []
  for (const { name, gitignore, args, suffix } of cases) {
    const { root, cleanup } = await project()
    const gitStatus = join(tmpdir(), `nextspark-sync-app-status-${process.pid}-${Date.now()}`)
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', gitignore)
      await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
      await write(root, 'app/(templates)/(public)/page.tsx', 'export default function Mine() { return null }\n')
      await write(root, `${CORE}/scripts/build/registry.mjs`, interruptingRegistryBuild(suffix))

      const { NEXT_PUBLIC_ACTIVE_THEME: _, ...env } = process.env
      const run = spawnSync(process.execPath, [...process.execArgv, CLI, 'sync:app', ...args], {
        cwd: root,
        env: { ...env, GIT_STATUS: gitStatus },
        encoding: 'utf-8',
        timeout: 60_000,
      })

      assert.equal(run.signal, 'SIGKILL', `${name}: sync:app is killed partway\n${run.stdout}${run.stderr}`)
      const backupsBeforeTheKill = (await readFile(gitStatus, 'utf-8')).split('\0').filter((entry) => /^\?\? (\.nextspark\/backups\/|app\.backup\.)/.test(entry))
      assert.ok((await readdir(join(root, '.nextspark/backups'), { recursive: true })).some((path) => String(path).endsWith('page.tsx')), `${name}: the registry build backed up page.tsx`)
      visible.push(...backupsBeforeTheKill.map((entry) => `${name}: ${entry.slice(3)} while the build ran`))
      visible.push(...untrackedGenerated(root).filter((path) => !path.startsWith('app/(templates)/')).map((path) => `${name}: ${path} after the kill`))
    } finally {
      await rm(gitStatus, { force: true })
      await cleanup()
    }
  }

  assert.deepEqual(visible, [])
})

test('--dry-run names the .gitignore lines a run adds for its backups when the rules name a stand-in for their directories', async () => {
  const standIns = 'app/(templates)/\n.nextspark/sync-state.json\n*-XXXXXX/\n*-a1b2c3/\n'
  const cases: { name: string; options: SyncOptions; lines: string[]; registry?: boolean }[] = [
    { name: "--backup's copy of app/", options: { backup: true }, lines: ['app.backup.v*/'] },
    { name: 'the backup --overwrite takes of a customized file', options: { overwrite: ['i18n.ts'] }, lines: ['.nextspark/backups/.gitignore'] },
    { name: "the registry build's backups, unplanned under --force", options: {}, lines: ['.nextspark/backups/.gitignore'], registry: true },
  ]

  // Every case runs before anything is asserted, so a failure names each line the dry run passes over
  const missed: string[] = []
  for (const { name, options, lines, registry } of cases) {
    const { root, cleanup } = await project()
    try {
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      await write(root, '.gitignore', standIns)
      if (registry) {
        await withTemplatesTree(root)
        await write(root, `${CORE}/scripts/build/registry.mjs`, REMOVING_REGISTRY_BUILD)
      }

      const planned = await runSync(root, { ...options, dryRun: true })
      const done = await runSync(root, { ...options, force: true })

      const added = gitignoreAdditions(done, 'Added')
      const named = gitignoreAdditions(planned, 'Would add')
      if (JSON.stringify(added) !== JSON.stringify(lines)) missed.push(`${name}: the run adds ${JSON.stringify(added)}`)
      if (JSON.stringify(named) !== JSON.stringify(lines)) missed.push(`${name}: the dry run names ${JSON.stringify(named)}`)
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(missed, [])
})

test('outside a repository, or without git on PATH, nothing a sync writes is left for git once the project is a repository, whatever negations the .gitignore chains', { skip: process.platform === 'win32' }, async () => {
  const chained = 'app/(templates)/\n!app/(templates)/\n.nextspark/backups/\n!.nextspark/backups/\n' +
    '.nextspark/sync-state.json\n!/.nextspark/sync-state.json\napp.backup.*/\n!app.backup.v*/\n'

  // Every mode runs before anything is asserted, so a failure names what each one leaves
  const leftOut: string[] = []
  for (const mode of ['outside a repository', 'without git on PATH']) {
    const { root, cleanup } = await project()
    try {
      await write(root, '.gitignore', chained)
      await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')
      await write(root, `${CORE}/scripts/build/registry.mjs`, treeRegistryBuild(20))
      await write(root, 'app/(templates)/(public)/page.tsx', 'export default function Earlier() { return null }\n')

      const path = process.env.PATH
      if (mode === 'without git on PATH') {
        execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
        // The registry build still needs node
        await mkdir(join(root, '.bin'))
        await symlink(process.execPath, join(root, '.bin/node'))
        process.env.PATH = join(root, '.bin')
      }
      let printed: string
      try {
        printed = await runSync(root, { force: true, backup: true, overwrite: ['i18n.ts'] })
      } finally {
        process.env.PATH = path
      }

      assert.ok(existsSync(join(root, 'app/(templates)/middleware.ts')), `${mode}: the registry build ran`)
      assert.ok(existsSync(join(root, '.nextspark/backups')), `${mode}: backups were taken`)
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' })
      leftOut.push(...untrackedGenerated(root).map((file) => `${mode}: ${file}`))
      const added = printed.match(/^  Added (.+) to \.gitignore$/m)?.[1].split(', ') ?? []
      for (const line of ['app/(templates)/', '.nextspark/backups/', '.nextspark/sync-state.json', 'app.backup.v*/']) {
        if (!added.includes(line)) leftOut.push(`${mode}: ${line} is not added`)
      }
    } finally {
      await cleanup()
    }
  }

  assert.deepEqual(leftOut, [])
})
