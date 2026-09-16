/**
 * update-core.mjs run for real against a project on disk. A stand-in `pnpm` on
 * PATH answers the registry lookups, the install and `nextspark sync:app` the
 * way the real ones touch a project, and logs every call, so each test sees
 * which steps ran and what the project looks like afterwards.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const UPDATE_CORE = path.join(CORE_DIR, 'scripts/maintenance/update-core.mjs')

const FROM = '0.1.0-beta.188'
const TO = '0.1.0-beta.189'

const FAKE_HEADER = `const fs = require('node:fs')
const path = require('node:path')
const state = JSON.parse(fs.readFileSync(process.env.FAKE_PNPM_STATE, 'utf8'))
const args = process.argv.slice(2)
`

/** The nextspark CLI the stand-in install puts in node_modules: it logs the call and plays sync:app. */
const FAKE_CLI = `${FAKE_HEADER}
fs.appendFileSync(process.env.FAKE_PNPM_LOG, ['nextspark', ...args].join(' ') + '\\n')
if (args.join(' ') !== 'sync:app --force') {
  process.stderr.write('fake nextspark: unexpected call: ' + args.join(' ') + '\\n')
  process.exit(99)
}
if (state.syncExit) {
  fs.writeFileSync(path.join('app', 'synced-before-failing.txt'), 'partial\\n')
  process.stderr.write('Could not regenerate app/(templates)\\n')
  process.exit(state.syncExit)
}
fs.writeFileSync(path.join('app', 'synced-with-core.txt'), 'synced\\n')
`

const FAKE_PNPM = `#!/usr/bin/env node
${FAKE_HEADER}
fs.appendFileSync(process.env.FAKE_PNPM_LOG, args.join(' ') + '\\n')

if (args[0] === 'view') {
  const [, name, field] = args
  if (!state.published[name]) {
    process.stderr.write('404 Not Found - ' + name + '\\n')
    process.exit(1)
  }
  const value = field === 'dist-tags' ? { latest: state.latest } : state.published[name]
  process.stdout.write(JSON.stringify(value) + '\\n')
  process.exit(0)
}

if (args[0] === 'install') {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  let root = process.cwd()
  while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) && path.dirname(root) !== root) root = path.dirname(root)
  if (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) root = process.cwd()
  if (state.installExit) {
    fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), 'half-written lockfile\\n')
    if (state.workspaceNote) fs.appendFileSync(path.join(root, 'pnpm-workspace.yaml'), state.workspaceNote)
    process.stderr.write('ERR_PNPM_FETCH_FAIL\\n')
    process.exit(state.installExit)
  }
  const pins = []
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(manifest[field] || {})) {
      if (!name.startsWith('@nextsparkjs/')) continue
      const version = spec.replace(/^[\\^~]/, '')
      const dir = path.join('node_modules', name)
      fs.mkdirSync(dir, { recursive: true })
      const bin = name === '@nextsparkjs/cli' ? { nextspark: 'bin/nextspark.js' } : undefined
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, bin }))
      if (bin) {
        fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
        fs.writeFileSync(path.join(dir, 'bin', 'nextspark.js'), ${JSON.stringify(FAKE_CLI)})
      }
      pins.push(name + '@' + version)
    }
  }
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), pins.join('\\n') + '\\n')
  if (state.workspaceNote) fs.appendFileSync(path.join(root, 'pnpm-workspace.yaml'), state.workspaceNote)
  const migrations = path.join('node_modules', '@nextsparkjs', 'core', 'migrations')
  fs.mkdirSync(migrations, { recursive: true })
  for (const file of state.newMigrations || []) fs.writeFileSync(path.join(migrations, file), '')
  process.exit(0)
}

process.stderr.write('fake pnpm: unexpected call: ' + args.join(' ') + '\\n')
process.exit(99)
`

interface ProjectOptions {
  pins?: Record<string, string>
  files?: Record<string, string>
  installed?: string | null
  /** web-mobile puts the app in web/, under the workspace root that holds the lockfile */
  webMobile?: boolean
}

interface RunOptions {
  published?: Record<string, string[]>
  latest?: string
  installExit?: number
  syncExit?: number
  newMigrations?: string[]
  workspaceNote?: string
}

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

/**
 * A project as `nextspark init` leaves one, committed, with core installed at
 * `installed`. Returns the directory update-core runs in: web/ for web-mobile.
 */
function createProject(t: { after: (fn: () => void) => void }, { pins, files = {}, installed = FROM, webMobile = false }: ProjectOptions = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-'))
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
  const root = webMobile ? path.join(repo, 'web') : repo

  const manifest = {
    name: 'acme-app',
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'nextspark dev',
      build: 'nextspark build',
      'acme:seed': 'node scripts/seed.mjs',
    },
    dependencies: {
      '@nextsparkjs/core': FROM,
      '@nextsparkjs/cli': FROM,
      next: '15.5.24',
      zod: '^4.1.0',
    },
    devDependencies: {
      '@nextsparkjs/testing': FROM,
      typescript: '^5.0.0',
    },
  }
  if (pins) {
    for (const [name, spec] of Object.entries(pins)) {
      if (name in manifest.devDependencies) (manifest.devDependencies as Record<string, string>)[name] = spec
      else (manifest.dependencies as Record<string, string>)[name] = spec
    }
  }

  const workspace: Record<string, string> = {
    'pnpm-lock.yaml': `lockfile for ${FROM}\n`,
    '.gitignore': 'node_modules\n.next\n',
    'pnpm-workspace.yaml': webMobile ? "packages:\n  - 'web'\n  - 'mobile'\n" : "packages:\n  - 'contents/themes/*'\n",
  }
  if (webMobile) {
    for (const [file, content] of Object.entries({ ...workspace, 'package.json': `${JSON.stringify({ name: 'acme', private: true }, null, 2)}\n` })) {
      fs.writeFileSync(path.join(repo, file), content)
    }
  }
  const tree: Record<string, string> = {
    'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
    ...(webMobile ? {} : workspace),
    '.env': 'DATABASE_URL=postgres://localhost/acme\nNEXT_PUBLIC_ACTIVE_THEME="acme" # the theme init set up\n',
    'app/page.tsx': 'export default function Page() { return null }\n',
    'contents/themes/acme/config/theme.config.ts': 'export const acmeThemeConfig = { name: "acme" }\n',
    'contents/plugins/acme-billing/plugin.config.ts': 'export const billing = {}\n',
    ...files,
  }
  for (const [file, content] of Object.entries(tree)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  if (installed) {
    fs.mkdirSync(path.join(root, 'node_modules/@nextsparkjs/core'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules/@nextsparkjs/core/package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: installed }))
  }

  git(repo, 'init', '-q')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'Generated project')
  return root
}

function runUpdateCore(root: string, args: string[], options: RunOptions = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-bin-'))
  try {
    fs.writeFileSync(path.join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })
    const statePath = path.join(bin, 'state.json')
    const logPath = path.join(bin, 'calls.log')
    fs.writeFileSync(statePath, JSON.stringify({
      published: options.published ?? {
        '@nextsparkjs/core': [FROM, TO],
        '@nextsparkjs/cli': [FROM, TO],
        '@nextsparkjs/testing': [FROM, TO],
      },
      latest: options.latest ?? TO,
      installExit: options.installExit ?? 0,
      syncExit: options.syncExit ?? 0,
      newMigrations: options.newMigrations ?? [],
      workspaceNote: options.workspaceNote ?? '',
    }))
    fs.writeFileSync(logPath, '')
    // The project's .env is what says which theme is active
    const { NEXT_PUBLIC_ACTIVE_THEME, ...environment } = process.env

    const result = spawnSync(process.execPath, [UPDATE_CORE, ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...environment, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_PNPM_STATE: statePath, FAKE_PNPM_LOG: logPath },
    })
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      output: `${result.stdout}${result.stderr}`,
      calls: fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean),
    }
  } finally {
    fs.rmSync(bin, { recursive: true, force: true })
  }
}

/** Every file under `dir` but .git, with its bytes. */
function snapshot(dir: string, base = dir, files = new Map<string, string>()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) snapshot(full, base, files)
    else files.set(path.relative(base, full), fs.readFileSync(full, 'base64'))
  }
  return files
}

/** What git holds: every ref and where it points. */
function gitRefs(root: string) {
  return git(root, 'for-each-ref', '--format=%(refname) %(objectname)')
}

test('updates the @nextsparkjs pins of a generated project and leaves the rest of it the project\'s own', (t) => {
  const root = createProject(t)
  const manifestBefore = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const before = snapshot(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.match(result.stdout, /Update Complete/)

  const manifestAfter = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.deepEqual(manifestAfter, {
    ...manifestBefore,
    dependencies: { ...manifestBefore.dependencies, '@nextsparkjs/core': TO, '@nextsparkjs/cli': TO },
    devDependencies: { ...manifestBefore.devDependencies, '@nextsparkjs/testing': TO },
  })

  const after = snapshot(root)
  for (const [file, content] of before) {
    if (file.startsWith('contents/') || file.startsWith('.env') || file === 'app/page.tsx') {
      assert.equal(after.get(file), content, `${file} changed`)
    }
  }
  for (const dir of ['core', 'packages', 'apps', '.rules']) {
    assert.equal(fs.existsSync(path.join(root, dir)), false, `${dir}/ was written into the project`)
  }

  assert.ok(result.calls.includes('install'), result.calls.join('\n'))
  assert.ok(result.calls.includes('nextspark sync:app --force'), result.calls.join('\n'))
  assert.equal(fs.readFileSync(path.join(root, 'app/synced-with-core.txt'), 'utf8'), 'synced\n')

  const record = JSON.parse(fs.readFileSync(path.join(root, 'core.version.json'), 'utf8'))
  assert.equal(record.version, TO)
  assert.equal(record.previousVersion, FROM)
})

test('keeps a ^ or ~ range, the indentation and the key order of package.json', (t) => {
  const root = createProject(t, { pins: { '@nextsparkjs/cli': `^${FROM}`, '@nextsparkjs/testing': `~${FROM}` } })
  const text = fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^(?: {2})+/gm, (indent) => '\t'.repeat(indent.length / 2))
  fs.writeFileSync(path.join(root, 'package.json'), text)
  git(root, 'commit', '-q', '-am', 'Tabs')

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  const expected = text
    .replace(`"@nextsparkjs/core": "${FROM}"`, `"@nextsparkjs/core": "${TO}"`)
    .replace(`"@nextsparkjs/cli": "^${FROM}"`, `"@nextsparkjs/cli": "^${TO}"`)
    .replace(`"@nextsparkjs/testing": "~${FROM}"`, `"@nextsparkjs/testing": "~${TO}"`)
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), expected)
})

const REFUSALS: Array<{
  name: string
  project?: ProjectOptions
  args?: string[]
  published?: Record<string, string[]>
  dirty?: boolean
  message: RegExp
}> = [
  {
    name: 'a @nextsparkjs package the project uses is not published at the target',
    published: { '@nextsparkjs/core': [FROM, TO], '@nextsparkjs/cli': [FROM, TO], '@nextsparkjs/testing': [FROM] },
    message: /Not published at 0\.1\.0-beta\.189: @nextsparkjs\/testing/,
  },
  {
    name: 'the target is older than the installed version',
    args: ['--version', '0.1.0-beta.187'],
    published: { '@nextsparkjs/core': ['0.1.0-beta.187', FROM], '@nextsparkjs/cli': ['0.1.0-beta.187', FROM], '@nextsparkjs/testing': ['0.1.0-beta.187', FROM] },
    message: /older than the installed 0\.1\.0-beta\.188/,
  },
  {
    name: 'package.json takes a @nextsparkjs package from a tarball',
    project: { pins: { '@nextsparkjs/cli': 'file:../nextsparkjs-cli.tgz' } },
    message: /somewhere other than the registry[\s\S]*@nextsparkjs\/cli: file:/,
  },
  {
    name: 'the project has uncommitted changes',
    dirty: true,
    message: /Uncommitted changes/,
  },
  {
    name: '.env does not set NEXT_PUBLIC_ACTIVE_THEME, so sync:app would skip the registry build',
    project: { files: { '.env': 'DATABASE_URL=postgres://localhost/acme\n' } },
    message: /NEXT_PUBLIC_ACTIVE_THEME is not set/,
  },
  {
    name: '.env sets NEXT_PUBLIC_ACTIVE_THEME to nothing',
    project: { files: { '.env': 'NEXT_PUBLIC_ACTIVE_THEME=acme\nNEXT_PUBLIC_ACTIVE_THEME=""\n' } },
    message: /NEXT_PUBLIC_ACTIVE_THEME is not set/,
  },
  {
    name: 'the project keeps core in core/ instead of installing @nextsparkjs/core',
    project: {
      installed: null,
      files: {
        'package.json': `${JSON.stringify({ name: 'legacy-app', scripts: { dev: 'next dev' }, dependencies: { next: '15.0.0' } }, null, 2)}\n`,
        'core/lib/index.ts': 'export {}\n',
      },
    },
    message: /keeps the framework in core\//,
  },
]

for (const refusal of REFUSALS) {
  test(`stops before changing anything when ${refusal.name}`, (t) => {
    const root = createProject(t, refusal.project)
    if (refusal.dirty) fs.writeFileSync(path.join(root, 'contents/themes/acme/wip.ts'), 'export {}\n')
    const files = snapshot(root)
    const refs = gitRefs(root)

    const result = runUpdateCore(root, refusal.args ?? ['--version', TO], { published: refusal.published })

    assert.notEqual(result.status, 0, result.output)
    assert.match(result.stderr, refusal.message)
    assert.match(result.stderr, /Nothing was changed/)
    assert.deepEqual(snapshot(root), files)
    assert.equal(gitRefs(root), refs)
    assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
  })
}

test('a failed sync:app or registry build exits non-zero, records no version and says what it left half done', (t) => {
  const record = `${JSON.stringify({ version: FROM }, null, 2)}\n`
  const root = createProject(t, { files: { 'core.version.json': record } })
  const head = git(root, 'rev-parse', 'HEAD')

  const result = runUpdateCore(root, ['--version', TO], { syncExit: 23 })

  assert.notEqual(result.status, 0, result.output)
  assert.ok(result.calls.includes('nextspark sync:app --force'), 'the sync step never ran')
  assert.doesNotMatch(result.output, /Update Complete/)
  assert.doesNotMatch(result.output, /Next steps/)
  assert.equal(fs.readFileSync(path.join(root, 'core.version.json'), 'utf8'), record)

  assert.match(result.stderr, /Update to 0\.1\.0-beta\.189 did not finish/)
  assert.match(result.stderr, /Failed: nextspark sync:app \(exit 23\)/)
  assert.match(result.stderr, /Already changed:[\s\S]*package\.json: @nextsparkjs\/core 0\.1\.0-beta\.188 -> 0\.1\.0-beta\.189/)
  assert.match(result.stderr, /Already changed:[\s\S]*pnpm-lock\.yaml and node_modules: @nextsparkjs\/core 0\.1\.0-beta\.188 -> 0\.1\.0-beta\.189/)
  assert.match(result.stderr, /Not done:[\s\S]*core\.version\.json still says 0\.1\.0-beta\.188/)
  assert.match(result.stderr, /Uncommitted now \(git status\):\n(?: {4}.+\n)*? {4}app\/synced-before-failing\.txt\n/)
  assert.match(result.stderr, /Uncommitted now \(git status\):\n(?: {4}.+\n)*? {4}package\.json\n/)
  assert.match(result.stderr, new RegExp(`git reset --hard ${head.slice(0, 12)}`))
})

test('a failed sync in a project with no core.version.json leaves it unwritten', (t) => {
  const root = createProject(t)

  const result = runUpdateCore(root, ['--version', TO], { syncExit: 1 })

  assert.notEqual(result.status, 0, result.output)
  assert.ok(result.calls.includes('nextspark sync:app --force'), 'the sync step never ran')
  assert.equal(fs.existsSync(path.join(root, 'core.version.json')), false)
  assert.match(result.stderr, /core\.version\.json still says nothing/)
})

test('a failed install puts back package.json and what pnpm install rewrote, and never syncs', (t) => {
  const root = createProject(t)
  const before = snapshot(root)

  const result = runUpdateCore(root, ['--version', TO], { installExit: 1, workspaceNote: 'minimumReleaseAgeExclude: []\n' })

  assert.notEqual(result.status, 0, result.output)
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    assert.equal(snapshot(root).get(file), before.get(file), `${file} was not put back`)
  }
  assert.equal(result.calls.includes('nextspark sync:app --force'), false)
  assert.equal(fs.existsSync(path.join(root, 'core.version.json')), false)
  assert.match(result.stderr, /Failed: pnpm install \(exit 1\)/)
  assert.match(result.stderr, /package\.json, pnpm-lock\.yaml, pnpm-workspace\.yaml put back as they were/)
  assert.doesNotMatch(result.output, /Next steps/)
})

test('in a web-mobile project a failed install puts back the lockfile and pnpm-workspace.yaml of the workspace root', (t) => {
  const web = createProject(t, { webMobile: true })
  const repo = path.dirname(web)
  const before = snapshot(repo)

  const result = runUpdateCore(web, ['--version', TO], { installExit: 1, workspaceNote: 'minimumReleaseAgeExclude: []\n' })

  assert.notEqual(result.status, 0, result.output)
  const after = snapshot(repo)
  for (const file of ['web/package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    assert.equal(after.get(file), before.get(file), `${file} was not put back`)
  }
  assert.equal(after.has('web/pnpm-lock.yaml'), false)
  assert.match(result.stderr, /package\.json, \.\.\/pnpm-lock\.yaml, \.\.\/pnpm-workspace\.yaml put back as they were/)
})

test('a project with a packages/core of its own is not taken for the NextSpark monorepo', (t) => {
  const root = createProject(t, { files: { 'packages/core/package.json': `${JSON.stringify({ name: '@acme/core' })}\n` } })

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /NextSpark monorepo/)
})

test('a re-run after a failed sync picks up from the changes it left uncommitted and finishes the update', (t) => {
  const root = createProject(t)
  const head = git(root, 'rev-parse', 'HEAD')
  const failed = runUpdateCore(root, ['--version', TO], { syncExit: 1 })
  assert.notEqual(failed.status, 0, failed.output)
  assert.match(failed.stderr, /run pnpm update-core --version 0\.1\.0-beta\.189 again, leaving these changes uncommitted/)

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.match(result.stdout, /Resuming the update from 0\.1\.0-beta\.188/)
  assert.ok(result.calls.includes('nextspark sync:app --force'))
  assert.match(result.stdout, /@nextsparkjs\/core 0\.1\.0-beta\.188 -> 0\.1\.0-beta\.189/)
  assert.match(result.stdout, /Migrate: pnpm db:migrate/)
  assert.match(result.stdout, new RegExp(`git reset --hard ${head.slice(0, 12)}`))
  const record = JSON.parse(fs.readFileSync(path.join(root, 'core.version.json'), 'utf8'))
  assert.equal(record.version, TO)
  assert.equal(record.previousVersion, FROM)
  assert.equal(git(root, 'rev-parse', 'HEAD'), head)
})

test('a re-run after a failed sync still stops when something besides the update changed', (t) => {
  const root = createProject(t)
  assert.notEqual(runUpdateCore(root, ['--version', TO], { syncExit: 1 }).status, 0)
  fs.writeFileSync(path.join(root, 'contents/themes/acme/wip.ts'), 'export {}\n')
  const files = snapshot(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.notEqual(result.status, 0, result.output)
  assert.match(result.stderr, /Uncommitted changes[\s\S]*Nothing was changed/)
  assert.deepEqual(snapshot(root), files)
  assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
})

test('reports the new core migrations and names db:migrate among the next steps', (t) => {
  const root = createProject(t)

  const result = runUpdateCore(root, ['--version', TO], { newMigrations: ['0042_new_table.sql'] })

  assert.equal(result.status, 0, result.output)
  assert.match(result.stdout, /New core migrations: 1/)
  assert.match(result.stdout, /Migrate: pnpm db:migrate/)
})

test('a project created without an update-core script runs it through the bin core declares', (t) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))
  const binPath = manifest.bin?.['update-core']
  assert.ok(binPath, '@nextsparkjs/core declares no update-core bin')

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-bin-project-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  // The core package as far as the bin needs it: its manifest and the bin's directory
  const core = path.join(root, 'core-package')
  const binDir = path.dirname(binPath)
  fs.mkdirSync(path.join(core, binDir), { recursive: true })
  fs.cpSync(path.join(CORE_DIR, binDir), path.join(core, binDir), { recursive: true })
  fs.writeFileSync(path.join(core, 'package.json'), JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    bin: manifest.bin,
  }))

  const project = path.join(root, 'project')
  fs.mkdirSync(project)
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    name: 'existing-app',
    private: true,
    scripts: { dev: 'nextspark dev', build: 'nextspark build' },
    dependencies: { '@nextsparkjs/core': 'file:../core-package' },
  }, null, 2))

  const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: project, encoding: 'utf8', timeout: 120_000 })
  assert.equal(install.status, 0, `${install.stdout}${install.stderr}`)

  const help = spawnSync('pnpm', ['update-core', '--help'], { cwd: project, encoding: 'utf8', timeout: 60_000 })
  assert.equal(help.status, 0, `${help.stdout}${help.stderr}`)
  assert.match(help.stdout, /NextSpark Core Updater/)

  const current = spawnSync('pnpm', ['update-core', '--current'], { cwd: project, encoding: 'utf8', timeout: 60_000 })
  assert.equal(current.status, 0, `${current.stdout}${current.stderr}`)
  assert.match(current.stdout, new RegExp(`@nextsparkjs/core ${manifest.version.replace(/\./g, '\\.')}`))
})
