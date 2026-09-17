/**
 * Tests for the check of where the registry build writes, which the build runs
 * before writing anything and `nextspark sync:app` and `nextspark dev` run from
 * the installed core: a symlink, something of another kind or that can't be
 * read, or a .gitignore of .nextspark/backups or .nextspark/registries that
 * would not keep what is beside it out of git, is found, and a build that finds
 * one writes nothing, in the project or through it. And the .gitignore the
 * build keeps in .nextspark/registries leaves the registries out of git.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/write-places.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { unsafeWritePlaces } from '../write-places.mjs'
import {
  BACKUPS_GITIGNORE,
  BACKUPS_GITIGNORE_CONTENT,
  REGISTRIES_GITIGNORE,
  REGISTRIES_GITIGNORE_CONTENT,
  backupsGitignoreState,
  ensureBackupsGitignore,
  ensureRegistriesGitignore,
  ownGitignoreState,
} from '../post-build/own-gitignores.mjs'

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const RUNS_AS_ROOT = process.getuid?.() === 0

async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-write-places-test-'))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

async function writeIn(root, path, content = '') {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

test('a symlink where the build or a caller writes, or something else in the way, is found without going through it', async () => {
  const { root, cleanup } = await directory()
  const outside = await directory()
  try {
    await writeIn(outside.root, 'dashboard/layout.tsx')
    await mkdir(join(root, 'app'), { recursive: true })
    await writeIn(root, '.nextspark/backups/2026-09-16T00-00-00-000Z-q1w2e3/i18n.ts')

    assert.deepEqual(unsafeWritePlaces(root), [])

    await symlink(outside.root, join(root, 'app/(templates)'))
    assert.deepEqual(unsafeWritePlaces(root), [{ path: 'app/(templates)', problem: 'is a symlink' }])

    await rm(join(root, 'app/(templates)'))
    await mkdir(join(root, 'app/(templates)/(public)'), { recursive: true })
    await symlink(join(outside.root, 'dashboard'), join(root, 'app/(templates)/(public)/dashboard'))
    await symlink(join(outside.root, 'missing'), join(root, '.nextspark/sync-state.json'))
    await symlink(join(outside.root, 'dashboard'), join(root, '.nextspark/registries'))
    await symlink(join(outside.root, 'dashboard'), join(root, 'app/dashboard'))
    await symlink(join(outside.root, 'globals.css'), join(root, 'app/globals.css'))
    assert.deepEqual(unsafeWritePlaces(root, ['app/dashboard/page.tsx', 'app/layout.tsx', 'i18n.ts', '.nextspark/sync-state.json']), [
      { path: 'app/globals.css', problem: 'is a symlink' },
      { path: '.nextspark/registries', problem: 'is a symlink' },
      { path: 'app/dashboard', problem: 'is a symlink' },
      { path: '.nextspark/sync-state.json', problem: 'is a symlink' },
      { path: 'app/(templates)/(public)/dashboard', problem: 'is a symlink' },
    ])
    assert.deepEqual(unsafeWritePlaces(root).map(({ path }) => path), [
      'app/globals.css',
      '.nextspark/registries',
      'app/(templates)/(public)/dashboard',
    ], 'app/dashboard and the sync state count only for a caller that writes under them')

    await rm(join(root, '.nextspark/registries'))
    await mkdir(join(root, '.nextspark/registries'))
    await symlink(join(outside.root, 'index.ts'), join(root, '.nextspark/registries/index.ts'))
    assert.ok(unsafeWritePlaces(root).some(({ path, problem }) => path === '.nextspark/registries/index.ts' && problem === 'is a symlink'), 'a symlink in the registries is found')

    await rm(join(root, '.nextspark/registries/index.ts'))
    await mkdir(join(root, '.nextspark/registries/index.ts'))
    await mkdir(join(root, 'app/(templates)/(public)/page.tsx'), { recursive: true })
    await rm(join(root, 'app/dashboard'))
    await writeFile(join(root, 'app/dashboard'), '')
    await rm(join(root, 'app/globals.css'))
    await mkdir(join(root, 'app/globals.css'))
    await mkdir(join(root, 'i18n.ts'))
    assert.deepEqual(unsafeWritePlaces(root, ['app/dashboard/page.tsx', 'app/layout.tsx', 'i18n.ts', '.nextspark/sync-state.json']), [
      { path: 'app/globals.css', problem: 'is not a file' },
      { path: 'app/dashboard', problem: 'is not a directory' },
      { path: 'i18n.ts', problem: 'is not a file' },
      { path: '.nextspark/sync-state.json', problem: 'is a symlink' },
      { path: 'app/(templates)/(public)/dashboard', problem: 'is a symlink' },
      { path: '.nextspark/registries/index.ts', problem: 'is not a file' },
    ], 'a directory in app/(templates) where a file goes is left to the registry build')

    await rm(join(root, '.nextspark'), { recursive: true })
    await writeFile(join(root, '.nextspark'), '')
    await rm(join(root, 'app'), { recursive: true })
    await symlink(outside.root, join(root, 'app'))
    assert.deepEqual(unsafeWritePlaces(root), [
      { path: 'app', problem: 'is a symlink' },
      { path: '.nextspark', problem: 'is not a directory' },
    ])
  } finally {
    await outside.cleanup()
    await cleanup()
  }
})

test('a directory the build lists that cannot be read is found', { skip: RUNS_AS_ROOT }, async () => {
  const { root, cleanup } = await directory()
  try {
    await mkdir(join(root, 'app/(templates)/dashboard'), { recursive: true })
    await mkdir(join(root, '.nextspark/registries'), { recursive: true })
    await mkdir(join(root, '.nextspark/backups'), { recursive: true })
    await chmod(join(root, 'app/(templates)/dashboard'), 0)
    await chmod(join(root, '.nextspark/registries'), 0)
    await chmod(join(root, '.nextspark/backups'), 0)
    assert.deepEqual(unsafeWritePlaces(root), [
      { path: '.nextspark/backups', problem: "can't be read" },
      { path: '.nextspark/registries', problem: "can't be read" },
      { path: 'app/(templates)/dashboard', problem: "can't be read" },
    ])
  } finally {
    await chmod(join(root, 'app/(templates)/dashboard'), 0o755).catch(() => {})
    await chmod(join(root, '.nextspark/registries'), 0o755).catch(() => {})
    await chmod(join(root, '.nextspark/backups'), 0o755).catch(() => {})
    await cleanup()
  }
})

test('a .nextspark/backups/.gitignore counts as in place only as a readable file with * as its one pattern, and anything else is found', async () => {
  const contents = [
    ['*\n', 'in place'],
    ['\uFEFF*\r\n', 'in place'],
    ['# Our own words\r\n\n*   \r\n', 'in place'],
    ['*\\ \n', 'other'],
    ['\\*\n', 'other'],
    ['/*\n', 'other'],
    ['*\n!*/\n', 'other'],
    ['*\n!manual-snapshots/\n', 'other'],
    ['# nothing\n', 'other'],
    [' *\n', 'other'],
    ['*\t\n', 'other'],
  ]
  for (const [content, state] of contents) {
    const { root, cleanup } = await directory()
    try {
      await writeIn(root, BACKUPS_GITIGNORE, content)
      assert.equal(backupsGitignoreState(root), state, JSON.stringify(content))
      assert.equal(unsafeWritePlaces(root).length, state === 'in place' ? 0 : 1, JSON.stringify(content))
      if (state === 'in place') {
        assert.equal(await ensureBackupsGitignore(root), false, JSON.stringify(content))
      } else {
        await assert.rejects(ensureBackupsGitignore(root), /Nothing is backed up under \.nextspark\/backups/, JSON.stringify(content))
      }
      assert.equal(await readFile(join(root, BACKUPS_GITIGNORE), 'utf-8'), content, 'one already there is never written over')
    } finally {
      await cleanup()
    }
  }

  const { root, cleanup } = await directory()
  const outside = await directory()
  try {
    assert.equal(backupsGitignoreState(root), 'missing')
    assert.deepEqual(unsafeWritePlaces(root), [])

    await mkdir(join(root, '.nextspark/backups'), { recursive: true })
    await symlink(join(outside.root, 'rules'), join(root, BACKUPS_GITIGNORE))
    assert.equal(backupsGitignoreState(root), 'symlink')
    assert.deepEqual(unsafeWritePlaces(root).map(({ path }) => path), [BACKUPS_GITIGNORE])
    await assert.rejects(ensureBackupsGitignore(root))
    assert.equal(existsSync(join(outside.root, 'rules')), false, 'nothing is written through the symlink')

    await rm(join(root, BACKUPS_GITIGNORE))
    await mkdir(join(root, BACKUPS_GITIGNORE))
    assert.equal(backupsGitignoreState(root), 'not a file')
    assert.deepEqual(unsafeWritePlaces(root).map(({ path }) => path), [BACKUPS_GITIGNORE])

    await rm(join(root, BACKUPS_GITIGNORE), { recursive: true })
    assert.equal(await ensureBackupsGitignore(root), true)
    assert.equal(await readFile(join(root, BACKUPS_GITIGNORE), 'utf-8'), BACKUPS_GITIGNORE_CONTENT)

    assert.equal(ownGitignoreState(root, REGISTRIES_GITIGNORE), 'missing')
    await writeIn(root, REGISTRIES_GITIGNORE, '*\n!index.ts\n')
    assert.equal(ownGitignoreState(root, REGISTRIES_GITIGNORE), 'other')
    assert.deepEqual(unsafeWritePlaces(root).map(({ path }) => path), [REGISTRIES_GITIGNORE], "the registries' .gitignore is read as the backups' is")
    await assert.rejects(ensureRegistriesGitignore(root), /No registry is written under \.nextspark\/registries/)
    await rm(join(root, REGISTRIES_GITIGNORE))
    await symlink(join(outside.root, 'rules'), join(root, REGISTRIES_GITIGNORE))
    assert.deepEqual(unsafeWritePlaces(root), [{ path: REGISTRIES_GITIGNORE, problem: 'is a symlink, which git does not read, so git would pick up what is beside it: make it a file with * as its only pattern, or remove it for nextspark to write it' }], 'found once, not again as a symlink in the registries')
    await rm(join(root, REGISTRIES_GITIGNORE))
    assert.equal(await ensureRegistriesGitignore(root), true)
    assert.equal(await readFile(join(root, REGISTRIES_GITIGNORE), 'utf-8'), REGISTRIES_GITIGNORE_CONTENT)
  } finally {
    await outside.cleanup()
    await cleanup()
  }
})

test('a .nextspark/backups/.gitignore that cannot be read is found, not taken as missing', { skip: RUNS_AS_ROOT }, async () => {
  const { root, cleanup } = await directory()
  try {
    await writeIn(root, BACKUPS_GITIGNORE, '*\n')
    await chmod(join(root, BACKUPS_GITIGNORE), 0)
    assert.equal(backupsGitignoreState(root), 'unreadable')
    assert.deepEqual(unsafeWritePlaces(root).map(({ path }) => path), [BACKUPS_GITIGNORE])
    await assert.rejects(ensureBackupsGitignore(root), /can't be read/)
  } finally {
    await chmod(join(root, BACKUPS_GITIGNORE), 0o644).catch(() => {})
    await cleanup()
  }
})

test('the .gitignore kept in .nextspark/backups ignores a backup whatever its directory is named and whatever the rules above take back', async () => {
  const { root, cleanup } = await directory()
  const gitIgnores = path => spawnSync('git', ['check-ignore', '-q', '--', path], { cwd: root }).status === 0
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    await writeFile(join(root, '.gitignore'), '!.nextspark/\n!.nextspark/backups/**\n')
    await writeFile(join(root, '.git/info/exclude'), '!*\n')
    await writeIn(root, '.nextspark/.gitignore', '!backups/\n!backups/**\n')
    await writeIn(root, '.nextspark/backups/2026-09-16T00-00-00-000Z-r3g1st/.gitignore', '!*\n')
    const backups = [
      '.nextspark/backups/2026-09-16T00-00-00-000Z-Zz9Qa1/app/(templates)/(public)/page.tsx',
      '.nextspark/backups/2026-09-16T00-00-00-000Z-r3g1st/i18n.ts',
      '.nextspark/backups/named by hand/.env.local',
    ]
    for (const file of backups) await writeIn(root, file, 'SECRET=1\n')
    assert.deepEqual(backups.map(gitIgnores), [false, false, false])

    assert.equal(await ensureBackupsGitignore(root), true)
    assert.equal(await ensureBackupsGitignore(root), false, 'a second call leaves it as it is')
    assert.equal(backupsGitignoreState(root), 'in place')

    assert.deepEqual(backups.map(gitIgnores), [true, true, true])
    assert.equal(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf-8' }),
      '?? .gitignore\n?? .nextspark/.gitignore\n'
    )
  } finally {
    await cleanup()
  }
})

/** Every entry under `root`: a file by its content's hash, a symlink by where it points, a directory by its name. */
async function snapshot(root) {
  const entries = {}
  const walk = async relative => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name
      const stats = await lstat(join(root, path))
      if (stats.isSymbolicLink()) {
        entries[path] = `-> ${await readlink(join(root, path))}`
      } else if (stats.isDirectory()) {
        entries[path] = 'dir'
        if (stats.mode & 0o400) await walk(path)
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

/** A project for core's real registry build, with a stale file in app/(templates) the build would back up and remove. */
async function buildableProject() {
  const project = await directory()
  await writeIn(project.root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await writeIn(project.root, 'package.json', '{}')
  await writeIn(project.root, 'app/layout.tsx', 'export default function Layout({ children }) { return children }\n')
  await writeIn(project.root, 'app/(templates)/stale/page.tsx', 'export default function Stale() { return null }\n')
  await writeIn(project.root, 'contents/themes/acme/templates/pricing/page.tsx', 'export default function Pricing() { return null }\n')
  return project
}

function runBuild(root) {
  const result = spawnSync('node', ['scripts/build/registry.mjs'], {
    cwd: CORE_DIR,
    env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root },
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

test("the registry build writes nothing, in the project or through it, when a place it writes under isn't safe", async () => {
  const cases = [
    ['a registry that is a symlink to a file outside', async (root, outside) => {
      await writeIn(outside, 'index.ts', '// outside\n')
      await mkdir(join(root, '.nextspark/registries'), { recursive: true })
      await symlink(join(outside, 'index.ts'), join(root, '.nextspark/registries/index.ts'))
    }, '.nextspark/registries/index.ts is a symlink'],
    ['the registries directory a symlink to one outside', async (root, outside) => {
      await mkdir(join(root, '.nextspark'), { recursive: true })
      await symlink(outside, join(root, '.nextspark/registries'))
    }, '.nextspark/registries is a symlink'],
    ['app/(templates) a symlink to a directory outside', async (root, outside) => {
      await rm(join(root, 'app/(templates)'), { recursive: true })
      await symlink(outside, join(root, 'app/(templates)'))
    }, 'app/(templates) is a symlink'],
    ['app/globals.css a symlink to a file outside', async (root, outside) => {
      await writeIn(outside, 'globals.css', '/* outside */\n')
      await symlink(join(outside, 'globals.css'), join(root, 'app/globals.css'))
    }, 'app/globals.css is a symlink'],
    ['a directory where a registry goes', async root => {
      await writeIn(root, '.nextspark/registries/index.ts/stale.ts')
    }, '.nextspark/registries/index.ts is not a file'],
    ['a backups .gitignore that takes the backups back', async root => {
      await writeIn(root, BACKUPS_GITIGNORE, '*\n!*/\n')
    }, `${BACKUPS_GITIGNORE} has patterns other than *`],
    ['a registries .gitignore that takes the registries back', async root => {
      await writeIn(root, REGISTRIES_GITIGNORE, '*\n!*.ts\n')
    }, `${REGISTRIES_GITIGNORE} has patterns other than *`],
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
    ["the active theme's entities.json a symlink to a file outside", async (root, outside) => {
      await writeIn(outside, 'entities.json', '{"outside":true}\n')
      await mkdir(join(root, 'contents/themes/acme/tests/cypress/fixtures'), { recursive: true })
      await symlink(join(outside, 'entities.json'), join(root, 'contents/themes/acme/tests/cypress/fixtures/entities.json'))
    }, 'contents/themes/acme/tests/cypress/fixtures/entities.json is a symlink'],
    ['the active theme a symlink to a directory outside with fixtures', async (root, outside) => {
      await writeIn(outside, 'templates/pricing/page.tsx', 'export default function Pricing() { return null }\n')
      await writeIn(outside, 'tests/cypress/fixtures/entities.json', '{"outside":true}\n')
      await writeIn(outside, 'tests/cypress/fixtures/blocks.json', '{"outside":true}\n')
      await rm(join(root, 'contents/themes/acme'), { recursive: true })
      await symlink(outside, join(root, 'contents/themes/acme'))
    }, 'contents/themes/acme is a symlink'],
    ...(RUNS_AS_ROOT ? [] : [['a backups .gitignore that cannot be read', async root => {
      await writeIn(root, BACKUPS_GITIGNORE, '*\n')
      await chmod(join(root, BACKUPS_GITIGNORE), 0)
    }, `${BACKUPS_GITIGNORE} can't be read`]]),
  ]

  const wrong = []
  for (const [label, setUp, named] of cases) {
    const project = await buildableProject()
    const outside = await directory()
    try {
      await setUp(project.root, outside.root)
      const before = { project: await snapshot(project.root), outside: await snapshot(outside.root) }
      const { status, output } = runBuild(project.root)
      const after = { project: await snapshot(project.root), outside: await snapshot(outside.root) }

      if (status !== 1) wrong.push(`${label}: exited ${status}`)
      if (JSON.stringify(after.project) !== JSON.stringify(before.project)) wrong.push(`${label}: the project changed`)
      if (JSON.stringify(after.outside) !== JSON.stringify(before.outside)) wrong.push(`${label}: what is outside changed`)
      if (!output.split('\n').some(line => line.includes("Build failed before writing anything"))) wrong.push(`${label}: no line says the build stopped before writing`)
      if (!output.split('\n').some(line => line.trim().startsWith(named))) wrong.push(`${label}: no line names ${named}`)
    } finally {
      await chmod(join(project.root, BACKUPS_GITIGNORE), 0o644).catch(() => {})
      await outside.cleanup()
      await project.cleanup()
    }
  }

  const control = await buildableProject()
  try {
    await writeIn(control.root, 'app/api/v1/plugin/legacy/route.ts', '// Auto-generated Plugin Route Proxy\n')
    await mkdir(join(control.root, 'contents/themes/acme/tests/cypress/fixtures'), { recursive: true })
    const { status } = runBuild(control.root)
    if (status !== 0) wrong.push(`with nothing in the way, the build exited ${status}`)
    if (!existsSync(join(control.root, '.nextspark/registries/index.ts'))) wrong.push('with nothing in the way, the build wrote no registry')
    if (existsSync(join(control.root, 'app/(templates)/stale/page.tsx'))) wrong.push('with nothing in the way, the build left the stale file')
    if (existsSync(join(control.root, 'app/api/v1/plugin/legacy'))) wrong.push('with nothing in the way, the build left the old generated plugin route')
    // entities.json is written only for a theme discovery finds, which this one, with no theme.config.ts, is not
    if (!existsSync(join(control.root, 'contents/themes/acme/tests/cypress/fixtures/blocks.json'))) wrong.push('with nothing in the way, the build wrote no blocks.json')
  } finally {
    await control.cleanup()
  }

  assert.deepEqual(wrong, [])
})

test("the registry build keeps .nextspark/registries out of git with a .gitignore of its own, while it runs and after, whatever the project's rules take back", async () => {
  const project = await buildableProject()
  const root = project.root
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    await writeFile(join(root, '.gitignore'), 'node_modules/\n.env\napp/(templates)/\n!.nextspark/\n!.nextspark/registries/**\n')
    await writeIn(root, '.nextspark/.gitignore', '!registries/\n!registries/**\n')
    await writeFile(join(root, '.git/info/exclude'), '!*\n')
    const visible = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(line => line.includes('.nextspark/registries'))

    const build = spawn('node', ['scripts/build/registry.mjs'], { cwd: CORE_DIR, env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root }, stdio: 'ignore' })
    let exited = null
    build.on('exit', code => { exited = code })
    const during = new Set()
    let polls = 0
    while (exited === null) {
      for (const line of visible()) during.add(line)
      polls++
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    assert.equal(exited, 0)
    assert.ok(polls > 1, 'git was asked while the build ran')
    assert.deepEqual([...during], [], 'git picks up no registry while the build runs')
    assert.deepEqual(visible(), [], 'nor after')
    assert.equal(await readFile(join(root, REGISTRIES_GITIGNORE), 'utf8'), REGISTRIES_GITIGNORE_CONTENT)
    assert.ok(existsSync(join(root, '.nextspark/registries/index.ts')), 'the registries are written')
  } finally {
    await project.cleanup()
  }
})
