/**
 * update-core.mjs run for real against a project on disk. A stand-in `pnpm` on
 * PATH answers the registry lookups, the install and `nextspark sync:app` the
 * way the real ones touch a project, and logs every call, so each test sees
 * which steps ran and what the project looks like afterwards.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const UPDATE_CORE = path.join(CORE_DIR, 'scripts/maintenance/update-core.mjs')

const FROM = '0.1.0-beta.188'
const TO = '0.1.0-beta.189'
const NEWER = '0.1.0-beta.190'
const PACKAGES = ['@nextsparkjs/core', '@nextsparkjs/cli', '@nextsparkjs/testing']

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

/**
 * The stand-in pnpm. Its lockfile has a line `<name>@<version> <spec>` for each
 * @nextsparkjs dependency. Its install resolves an exact spec to that version
 * and a ^ or ~ range to the newest published version from the range's own up,
 * as pnpm does for these 0.1.0-beta.N versions; writes what the state's
 * lifecycle scripts write; and can hang halfway, having linked the new versions
 * into node_modules but not written the lockfile yet, and written the pid a
 * test signals it by. Like pnpm, it finds nothing to do when the lockfile
 * already records what package.json asks for and matches its record of the
 * last install it finished, whatever node_modules holds; and with
 * --frozen-lockfile it installs what the lockfile names, or fails without
 * writing when the lockfile doesn't record what package.json asks for.
 */
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

if (args[0] === '--dir') {
  process.chdir(args[1])
  args.splice(0, 2)
}
const frozen = args.includes('--frozen-lockfile')
if (args.filter((arg) => arg !== '--frozen-lockfile').join(' ') !== 'install') {
  process.stderr.write('fake pnpm: unexpected call: ' + args.join(' ') + '\\n')
  process.exit(99)
}
fs.appendFileSync(process.env.FAKE_PNPM_LOG + '.cwd', fs.realpathSync(process.cwd()) + '\\n')

// Like pnpm, the nearest pnpm-workspace.yaml up from where it runs makes the workspace
const beta = (version) => Number(version.split('.').pop())
let root = process.cwd()
while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) && path.dirname(root) !== root) root = path.dirname(root)
if (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) root = process.cwd()
const lockfile = path.join(root, 'pnpm-lock.yaml')
const lastInstall = path.join(root, 'node_modules', '.fake-last-install')
const listed = fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))
  ? fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8').split('\\n').map((line) => line.match(/^\\s*-\\s*'([^'*]+)'\\s*$/)?.[1]).filter(Boolean)
  : []
const importers = [root, ...listed.map((dir) => path.join(root, dir))].filter((dir) => fs.existsSync(path.join(dir, 'package.json')))

const pins = []
for (const dir of importers) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(manifest[field] || {})) {
      if (!name.startsWith('@nextsparkjs/')) continue
      const base = spec.replace(/^[\\^~]/, '')
      const version = base === spec
        ? spec
        : (state.published[name] || []).filter((candidate) => beta(candidate) >= beta(base)).sort((a, b) => beta(b) - beta(a))[0] || base
      pins.push({ dir, name, spec, version })
    }
  }
}

const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
const locked = read(lockfile)
const lockedLine = ({ name, spec }) => (locked ?? '').split('\\n').find((line) => line.startsWith(name + '@') && line.endsWith(' ' + spec))
if (frozen) {
  if (!pins.every(lockedLine)) {
    process.stderr.write('ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json\\n')
    process.exit(1)
  }
  for (const pin of pins) pin.version = lockedLine(pin).split(' ')[0].slice(pin.name.length + 1)
}
if (locked !== null && locked === read(lastInstall) && pins.every(lockedLine)) {
  process.stdout.write('Already up to date\\n')
  process.exit(0)
}

for (const [file, content] of Object.entries(state.installWrites || {})) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const link = () => {
  for (const { dir: importer, name, version } of pins) {
    const dir = path.join(importer, 'node_modules', name)
    fs.mkdirSync(dir, { recursive: true })
    const bin = name === '@nextsparkjs/cli' ? { nextspark: 'bin/nextspark.js' } : undefined
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, bin }))
    if (bin) {
      fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'bin', 'nextspark.js'), ${JSON.stringify(FAKE_CLI)})
    }
  }
}

const finish = () => {
  if (state.installLeavesChildMs) {
    // A lifecycle script that leaves a process of its own running in the install's process group, and writes once it is done
    const child = require('node:child_process').spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[2], String(process.pid)); setTimeout(() => require("node:fs").writeFileSync(process.argv[1], ""), ' + state.installLeavesChildMs + ')', process.env.FAKE_PNPM_LOG + '.leftover-finished', process.env.FAKE_PNPM_LOG + '.leftover-running'], { stdio: 'ignore' })
    child.unref()
    while (!fs.existsSync(process.env.FAKE_PNPM_LOG + '.leftover-running')) require('node:child_process').spawnSync('sleep', ['0.05'])
  }
  if (state.installExit) {
    fs.writeFileSync(lockfile, 'half-written lockfile\\n')
    process.stderr.write('ERR_PNPM_FETCH_FAIL\\n')
    process.exit(state.installExit)
  }
  link()
  const content = frozen ? locked : pins.map(({ name, version, spec }) => name + '@' + version + ' ' + spec + '\\n').join('')
  if (!frozen) fs.writeFileSync(lockfile, content)
  fs.mkdirSync(path.dirname(lastInstall), { recursive: true })
  fs.writeFileSync(lastInstall, content)
  for (const { dir } of pins.filter(({ name }) => name === '@nextsparkjs/core')) {
    const migrations = path.join(dir, 'node_modules', '@nextsparkjs', 'core', 'migrations')
    fs.mkdirSync(migrations, { recursive: true })
    for (const file of state.newMigrations || []) fs.writeFileSync(path.join(migrations, file), '')
  }
  process.exit(0)
}

if (state.installHangMs) {
  link()
  const ignoreSignals = state.installIgnoreSignals || state.lifecycleIgnoresSignals ? 'for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => {}); ' : ''
  if (state.installIgnoreSignals) for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {})
  // A lifecycle script of its own, as pnpm runs them: a child that says when it is running and would write once the install finishes
  const lifecycle = require('node:child_process').spawn(process.execPath, ['-e', ignoreSignals + 'require("node:fs").writeFileSync(process.argv[2], ""); setTimeout(() => require("node:fs").writeFileSync(process.argv[1], ""), ' + state.installHangMs + ')', process.env.FAKE_PNPM_LOG + '.lifecycle-finished', process.env.FAKE_PNPM_LOG + '.lifecycle-running'], { stdio: 'ignore' })
  fs.writeFileSync(process.env.FAKE_PNPM_LOG + '.started', process.pid + ' ' + lifecycle.pid)
  setTimeout(() => {
    fs.writeFileSync(process.env.FAKE_PNPM_LOG + '.finished', '')
    finish()
  }, state.installHangMs)
} else {
  finish()
}
`

interface ProjectOptions {
  pins?: Record<string, string>
  files?: Record<string, string>
  /** The version node_modules holds of every @nextsparkjs package package.json declares, or none */
  installed?: string | null
  /** web-mobile puts the app in web/, under the workspace root that holds the lockfile */
  webMobile?: boolean
  /** 'commit' commits the project, 'init' only runs git init, 'none' leaves it outside git */
  git?: 'commit' | 'init' | 'none'
  /** The spec the lockfile records for a package, when it isn't the one package.json declares */
  lockedSpecs?: Record<string, string>
  /** 'none' leaves the project without pnpm-lock.yaml, 'ignored' has .gitignore ignore it */
  lockfile?: 'commit' | 'none' | 'ignored'
}

interface FakeState {
  published?: Record<string, string[]>
  latest?: string
  installExit?: number
  installWrites?: Record<string, string>
  installHangMs?: number
  /** The hanging install and its lifecycle script ignore SIGINT, SIGTERM and SIGHUP */
  installIgnoreSignals?: boolean
  /** Only the hanging install's lifecycle script ignores them */
  lifecycleIgnoresSignals?: boolean
  /** The install leaves a process running in its group, which writes after this many ms */
  installLeavesChildMs?: number
  syncExit?: number
  newMigrations?: string[]
}

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

/** The lockfile the stand-in install writes for these pins, each recorded with `spec` or else its exact version. */
function lockfileFor(pins: Array<[string, string, string?]>) {
  return pins.map(([name, version, spec = version]) => `${name}@${version} ${spec}\n`).join('')
}

/**
 * A project as `nextspark init` leaves one, committed, with the @nextsparkjs
 * packages installed at `installed`. Returns the directory update-core runs
 * in: web/ for web-mobile.
 */
function createProject(t: { after: (fn: () => void) => void }, { pins, files = {}, installed = FROM, webMobile = false, git: gitMode = 'commit', lockedSpecs = {}, lockfile = 'commit' }: ProjectOptions = {}) {
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

  const declared: Record<string, string> = { ...manifest.dependencies, ...manifest.devDependencies }
  const workspace: Record<string, string> = {
    'pnpm-lock.yaml': lockfileFor(PACKAGES.map((name) => [name, installed ?? FROM, lockedSpecs[name] ?? declared[name]])),
    '.gitignore': `node_modules\n.next\n${lockfile === 'ignored' ? 'pnpm-lock.yaml\n' : ''}`,
    'pnpm-workspace.yaml': webMobile ? "packages:\n  - 'web'\n  - 'mobile'\n" : "packages:\n  - 'contents/themes/*'\n",
  }
  if (lockfile === 'none') delete workspace['pnpm-lock.yaml']
  if (webMobile) {
    for (const [file, content] of Object.entries({ ...workspace, 'package.json': `${JSON.stringify({ name: 'acme', private: true }, null, 2)}\n`, 'mobile/package.json': `${JSON.stringify({ name: 'mobile', private: true }, null, 2)}\n`, 'mobile/app.json': '{ "name": "acme" }\n' })) {
      fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
      fs.writeFileSync(path.join(repo, file), content)
    }
  }
  const tree: Record<string, string> = {
    'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
    // web/ of a generated web-mobile project has a pnpm-workspace.yaml of its own for its themes and plugins
    ...(webMobile ? { 'pnpm-workspace.yaml': "packages:\n  - 'contents/themes/*'\n  - 'contents/plugins/*'\n" } : workspace),
    '.env': 'DATABASE_URL=postgres://localhost/acme\nNEXT_PUBLIC_ACTIVE_THEME="acme" # the theme init set up\n',
    'app/page.tsx': 'export default function Page() { return null }\n',
    'next.config.mjs': 'export default {}\n',
    'tsconfig.json': '{ "compilerOptions": { "strict": true } }\n',
    'contents/themes/acme/config/theme.config.ts': 'export const acmeThemeConfig = { name: "acme" }\n',
    'contents/plugins/acme-billing/plugin.config.ts': 'export const billing = {}\n',
    ...files,
  }
  for (const [file, content] of Object.entries(tree)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  if (installed) {
    const declared = JSON.parse(tree['package.json'])
    for (const name of Object.keys({ ...declared.dependencies, ...declared.devDependencies }).filter((dep) => dep.startsWith('@nextsparkjs/'))) {
      fs.mkdirSync(path.join(root, 'node_modules', name), { recursive: true })
      fs.writeFileSync(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: installed }))
    }
    fs.mkdirSync(path.join(repo, 'node_modules'), { recursive: true })
    if (lockfile !== 'none') fs.writeFileSync(path.join(repo, 'node_modules', '.fake-last-install'), workspace['pnpm-lock.yaml'])
  }

  if (gitMode !== 'none') git(repo, 'init', '-q')
  if (gitMode === 'commit') {
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'Generated project')
  }
  return root
}

/** A directory with the stand-in pnpm and its state, and the environment that puts it first on PATH. */
function fakePnpm(state: FakeState = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-bin-'))
  fs.writeFileSync(path.join(bin, 'pnpm'), FAKE_PNPM, { mode: 0o755 })
  const statePath = path.join(bin, 'state.json')
  const logPath = path.join(bin, 'calls.log')
  fs.writeFileSync(statePath, JSON.stringify({
    published: state.published ?? Object.fromEntries(PACKAGES.map((name) => [name, [FROM, TO]])),
    latest: state.latest ?? TO,
    installExit: state.installExit ?? 0,
    installWrites: state.installWrites ?? {},
    installHangMs: state.installHangMs ?? 0,
    installIgnoreSignals: state.installIgnoreSignals ?? false,
    lifecycleIgnoresSignals: state.lifecycleIgnoresSignals ?? false,
    installLeavesChildMs: state.installLeavesChildMs ?? 0,
    syncExit: state.syncExit ?? 0,
    newMigrations: state.newMigrations ?? [],
  }))
  fs.writeFileSync(logPath, '')
  // The project's .env is what says which theme is active
  const { NEXT_PUBLIC_ACTIVE_THEME, ...environment } = process.env
  return {
    bin,
    logPath,
    env: { ...environment, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_PNPM_STATE: statePath, FAKE_PNPM_LOG: logPath },
    calls: () => fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean),
    /** The directory each install ran in */
    installDirs: () => (fs.existsSync(`${logPath}.cwd`) ? fs.readFileSync(`${logPath}.cwd`, 'utf8') : '').split('\n').filter(Boolean),
    remove: () => fs.rmSync(bin, { recursive: true, force: true }),
  }
}

function runUpdateCore(root: string, args: string[], state: FakeState = {}) {
  const pnpm = fakePnpm(state)
  try {
    const result = spawnSync(process.execPath, [UPDATE_CORE, ...args], { cwd: root, encoding: 'utf8', timeout: 60_000, env: pnpm.env })
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      output: `${result.stdout}${result.stderr}`,
      calls: pnpm.calls(),
      installDirs: pnpm.installDirs(),
    }
  } finally {
    pnpm.remove()
  }
}

/** The rollback command a report prints. */
function rollbackIn(output: string) {
  const command = output.match(/^ {4}(git reset --hard \S+ && .+)$/m)?.[1]
  assert.ok(command, `no rollback command in:\n${output}`)
  return command
}

/** The rollback printed before the first change, for a run killed before it can report. */
function earlyRollbackIn(output: string) {
  const command = output.match(/^ {5}(git reset --hard \S+ && .+)$/m)?.[1]
  assert.ok(command, `no rollback command in:\n${output}`)
  return command
}

/** Runs the rollback exactly as printed, in `cwd`, with the stand-in pnpm. */
function runRollback(cwd: string, command: string) {
  const pnpm = fakePnpm()
  try {
    const result = spawnSync('sh', ['-c', command], { cwd, encoding: 'utf8', timeout: 60_000, env: pnpm.env })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  } finally {
    pnpm.remove()
  }
}

/** Every file under `dir` but .git and node_modules, with its bytes. */
function snapshot(dir: string, base = dir, files = new Map<string, string>()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
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

function installedVersions(root: string) {
  return PACKAGES.map((name) => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version)
}

/** Where HEAD is: the branch it is on, or the commit it is detached at. */
function gitHead(repo: string) {
  return `${git(repo, 'rev-parse', '--symbolic-full-name', 'HEAD')} ${git(repo, 'rev-parse', 'HEAD')}`
}

type RepoState = ReturnType<typeof stateOf>

function stateOf(repo: string) {
  return { repo, files: snapshot(repo), refs: gitRefs(repo), head: gitHead(repo) }
}

/** Checks that the repository is as `before` had it: the same files, nothing uncommitted, the same refs and HEAD. */
function assertSameRepo(before: RepoState) {
  assert.deepEqual(snapshot(before.repo), before.files)
  assert.equal(git(before.repo, 'status', '--porcelain', '--ignore-submodules=none'), '')
  assert.equal(gitRefs(before.repo), before.refs)
  assert.equal(gitHead(before.repo), before.head)
}

/**
 * Checks that `command`, the rollback a run printed, run as printed from `cwd`,
 * succeeds and puts the repository back as `before` had it, with the packages
 * reinstalled at FROM.
 */
function assertRollbackRestores(cwd: string, output: string, before: RepoState, command = rollbackIn(output)) {
  const rollback = runRollback(cwd, command)
  assert.equal(rollback.status, 0, `${command}\n${rollback.output}`)
  assertSameRepo(before)
  assert.deepEqual(installedVersions(cwd), PACKAGES.map(() => FROM))
}

/** update-core started in the background, with its output collected as it comes. */
function startUpdateCore(root: string, args: string[], pnpm: ReturnType<typeof fakePnpm>) {
  const child = spawn(process.execPath, [UPDATE_CORE, ...args], { cwd: root, env: pnpm.env })
  const run = {
    child,
    stdout: '',
    stderr: '',
    /** Once its output is closed too, which processes it started can hold open after it is gone */
    exited: new Promise<{ status: number | null, signal: NodeJS.Signals | null }>((resolve) => child.on('close', (status, signal) => resolve({ status, signal }))),
    /** As soon as update-core itself is gone */
    gone: new Promise<NodeJS.Signals | null>((resolve) => child.on('exit', (_status, signal) => resolve(signal))),
  }
  child.stdout.on('data', (chunk) => { run.stdout += chunk })
  child.stderr.on('data', (chunk) => { run.stderr += chunk })
  return run
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function running(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Waits for the stand-in install to hang with its lifecycle script running, and returns both their pids. */
async function hangingInstall(t: { after: (fn: () => void) => void }, pnpm: ReturnType<typeof fakePnpm>, run: ReturnType<typeof startUpdateCore>) {
  const started = `${pnpm.logPath}.started`
  for (const deadline = Date.now() + 30_000; !fs.existsSync(started) || fs.readFileSync(started, 'utf8') === '' || !fs.existsSync(`${pnpm.logPath}.lifecycle-running`); await sleep(50)) {
    assert.ok(Date.now() < deadline, `the install never started:\n${run.stdout}${run.stderr}`)
  }
  const pids = fs.readFileSync(started, 'utf8').split(' ').map(Number)
  t.after(() => {
    for (const pid of pids) {
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
  })
  return pids
}

test('updates the @nextsparkjs pins of a generated project and leaves the rest of it the project\'s own', (t) => {
  const root = createProject(t)
  const manifestBefore = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const before = snapshot(root)
  const head = git(root, 'rev-parse', 'HEAD')

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.match(result.stdout, /Update Complete/)
  assert.match(result.stdout, new RegExp(`Starting from commit ${head.slice(0, 12)}[^\\n]*\\n {5}git reset --hard ${head.slice(0, 12)} && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile\\n[\\s\\S]*\\[2/5\\]`))

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

test('sets a ^ or ~ range to the exact target, keeping the indentation and the key order of package.json', (t) => {
  const root = createProject(t, { pins: { '@nextsparkjs/cli': `^${FROM}`, '@nextsparkjs/testing': `~${FROM}` } })
  const text = fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^(?: {2})+/gm, (indent) => '\t'.repeat(indent.length / 2))
  fs.writeFileSync(path.join(root, 'package.json'), text)
  git(root, 'commit', '-q', '-am', 'Tabs')

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  const expected = text
    .replace(`"@nextsparkjs/core": "${FROM}"`, `"@nextsparkjs/core": "${TO}"`)
    .replace(`"@nextsparkjs/cli": "^${FROM}"`, `"@nextsparkjs/cli": "${TO}"`)
    .replace(`"@nextsparkjs/testing": "~${FROM}"`, `"@nextsparkjs/testing": "${TO}"`)
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), expected)
})

test('--version installs exactly that version when package.json had ranges and a newer version is published', (t) => {
  const root = createProject(t, { pins: { '@nextsparkjs/core': `^${FROM}`, '@nextsparkjs/cli': `^${FROM}`, '@nextsparkjs/testing': `~${FROM}` } })

  const result = runUpdateCore(root, ['--version', TO], {
    published: Object.fromEntries(PACKAGES.map((name) => [name, [FROM, TO, NEWER]])),
    latest: NEWER,
  })

  assert.equal(result.status, 0, result.output)
  assert.deepEqual(installedVersions(root), PACKAGES.map(() => TO))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.deepEqual(PACKAGES.map((name) => manifest.dependencies[name] ?? manifest.devDependencies[name]), PACKAGES.map(() => TO))
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'core.version.json'), 'utf8')).version, TO)
})

test('a project already declaring and holding the target is left alone, whether or not it has a core.version.json', (t) => {
  const root = createProject(t, { pins: Object.fromEntries(PACKAGES.map((name) => [name, TO])), installed: TO })
  const before = stateOf(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.match(result.stdout, /Already on 0\.1\.0-beta\.189/)
  assert.doesNotMatch(result.output, /Update Complete|Installing|Syncing/)
  assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
  assert.deepEqual(snapshot(root), before.files)
  assert.equal(git(root, 'status', '--porcelain'), '')
})

test('a core.version.json that already names the target does not stand in for the packages being on it', (t) => {
  const root = createProject(t, { files: { 'core.version.json': `${JSON.stringify({ version: TO }, null, 2)}\n` } })

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.ok(result.calls.includes('install'), result.calls.join('\n'))
  assert.deepEqual(installedVersions(root), PACKAGES.map(() => TO))
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
    published: Object.fromEntries(PACKAGES.map((name) => [name, ['0.1.0-beta.187', FROM]])),
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
    name: 'the project is not in a git repository',
    project: { git: 'none' },
    message: /needs the project in a git repository with a commit/,
  },
  {
    name: 'the git repository has no commit yet',
    project: { git: 'init' },
    message: /needs the project in a git repository with a commit/,
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
    name: 'the project has no pnpm-lock.yaml, which the rollback installs from',
    project: { lockfile: 'none' },
    message: /No pnpm-lock\.yaml here or above/,
  },
  {
    name: 'pnpm-lock.yaml is ignored instead of committed',
    project: { lockfile: 'ignored' },
    message: /pnpm-lock\.yaml isn't committed/,
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
    const refs = refusal.project?.git === 'none' || refusal.project?.git === 'init' ? null : gitRefs(root)

    const result = runUpdateCore(root, refusal.args ?? ['--version', TO], { published: refusal.published })

    assert.notEqual(result.status, 0, result.output)
    assert.match(result.stderr, refusal.message)
    assert.match(result.stderr, /Nothing was changed/)
    assert.deepEqual(snapshot(root), files)
    if (refs !== null) assert.equal(gitRefs(root), refs)
    assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
  })
}

test('uncommitted edits alongside @nextsparkjs pins already set to the target by hand are refused, not taken for an unfinished update', (t) => {
  const root = createProject(t)
  const manifestPath = path.join(root, 'package.json')
  fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').replaceAll(`"${FROM}"`, `"${TO}"`))
  fs.writeFileSync(path.join(root, 'app/page.tsx'), 'export default function Page() { return "my own page" }\n')
  fs.writeFileSync(path.join(root, 'next.config.mjs'), 'export default { reactStrictMode: true }\n')
  fs.writeFileSync(path.join(root, 'tsconfig.json'), '{ "compilerOptions": { "strict": false } }\n')
  const files = snapshot(root)
  const refs = gitRefs(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.notEqual(result.status, 0, result.output)
  assert.match(result.stderr, /Uncommitted changes[\s\S]*Nothing was changed/)
  assert.doesNotMatch(result.output, /Resuming|Update Complete|git reset --hard/)
  assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
  assert.deepEqual(snapshot(root), files)
  assert.equal(gitRefs(root), refs)
})

test('a failed sync:app exits non-zero, records no version, undoes nothing and prints a rollback that restores the project', (t) => {
  const record = `${JSON.stringify({ version: FROM }, null, 2)}\n`
  const root = createProject(t, { files: { 'core.version.json': record } })
  const before = stateOf(root)
  const head = git(root, 'rev-parse', 'HEAD')

  const result = runUpdateCore(root, ['--version', TO], { syncExit: 23 })

  assert.equal(result.status, 1, result.output)
  assert.ok(result.calls.includes('nextspark sync:app --force'), 'the sync step never ran')
  assert.doesNotMatch(result.output, /Update Complete|Next steps/)
  assert.equal(fs.readFileSync(path.join(root, 'core.version.json'), 'utf8'), record)

  assert.match(result.stderr, /Update to 0\.1\.0-beta\.189 did not finish/)
  assert.match(result.stderr, /Failed during: nextspark sync:app --force \(exit 23; what it reported is above\)/)
  assert.match(result.stderr, /Done before that:[\s\S]*package\.json: @nextsparkjs\/core 0\.1\.0-beta\.188 -> 0\.1\.0-beta\.189/)
  assert.match(result.stderr, /Done before that:[\s\S]*pnpm install: every @nextsparkjs package installed at 0\.1\.0-beta\.189/)
  assert.match(result.stderr, /Not reached:\n {4}- write core\.version\.json\n/)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4}\?\? app\/synced-before-failing\.txt\n/)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4} M package\.json\n/)
  assert.equal(rollbackIn(result.stderr), `git reset --hard ${head.slice(0, 12)} && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile`)
  assert.doesNotMatch(result.output, /picks up|put back as they were|leaving these changes uncommitted/)

  assertRollbackRestores(root, result.stderr, before)
})

test('after a failed sync:app, running update-core again without rolling back is refused', (t) => {
  const root = createProject(t)
  assert.notEqual(runUpdateCore(root, ['--version', TO], { syncExit: 1 }).status, 0)
  const files = snapshot(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.notEqual(result.status, 0, result.output)
  assert.match(result.stderr, /Uncommitted changes[\s\S]*Nothing was changed/)
  assert.doesNotMatch(result.output, /Resuming|Update Complete/)
  assert.deepEqual(snapshot(root), files)
  assert.deepEqual(result.calls.filter((call) => !call.startsWith('view ')), [])
})

test('a failed install whose lifecycle scripts wrote app/ is left as it failed, and its rollback restores everything', (t) => {
  const root = createProject(t)
  const before = stateOf(root)

  const result = runUpdateCore(root, ['--version', TO], {
    installExit: 1,
    installWrites: {
      'app/page.tsx': 'export default function Page() { return "synced by postinstall" }\n',
      'app/(templates)/from-postinstall.tsx': 'export {}\n',
    },
  })

  assert.equal(result.status, 1, result.output)
  assert.equal(result.calls.includes('nextspark sync:app --force'), false)
  assert.equal(fs.existsSync(path.join(root, 'core.version.json')), false)
  assert.match(result.stderr, /Failed during: pnpm install \(exit 1\)/)
  assert.match(result.stderr, /Not reached:\n {4}- nextspark sync:app --force\n {4}- write core\.version\.json\n/)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4} M app\/page\.tsx\n/)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4} M pnpm-lock\.yaml\n/)
  assert.doesNotMatch(result.output, /put back as they were|picks up/)
  // Nothing is undone by the run: the pins it set stay, next to what the scripts wrote
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.equal(manifest.dependencies['@nextsparkjs/core'], TO)

  assertRollbackRestores(root, result.stderr, before)
  const again = runUpdateCore(root, ['--version', TO])
  assert.equal(again.status, 0, again.output)
})

test('in a web-mobile project the rollback run from web/ also restores and cleans the workspace root', (t) => {
  const web = createProject(t, { webMobile: true })
  const repo = path.dirname(web)
  const before = stateOf(repo)

  const result = runUpdateCore(web, ['--version', TO], {
    installExit: 1,
    // Relative to the workspace root, where the install runs
    installWrites: { 'mobile/app.json': '{ "name": "rewritten" }\n', 'stray-from-postinstall.txt': 'x\n' },
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4}\?\? \.\.\/stray-from-postinstall\.txt\n/)
  assert.deepEqual(result.installDirs, [fs.realpathSync(repo)])
  assert.equal(rollbackIn(result.stderr).replace(/^git reset --hard \S+ && /, ''), 'git clean -fd :/ && rm -rf ../node_modules node_modules && pnpm --dir .. install --frozen-lockfile')
  assertRollbackRestores(web, result.stderr, before)
  assert.equal(fs.existsSync(path.join(repo, 'web/pnpm-lock.yaml')), false)
})

test('in a web-mobile project the install runs where pnpm-lock.yaml is, not in web/, which has a pnpm-workspace.yaml of its own', (t) => {
  const web = createProject(t, { webMobile: true })
  const repo = path.dirname(web)

  const result = runUpdateCore(web, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.deepEqual(result.installDirs, [fs.realpathSync(repo)])
  assert.equal(fs.existsSync(path.join(web, 'pnpm-lock.yaml')), false)
  assert.deepEqual(installedVersions(web), PACKAGES.map(() => TO))
  assert.equal(fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf8'), lockfileFor(PACKAGES.map((name) => [name, TO])))
  assert.match(result.stdout, /Roll back: git reset --hard \S+ && git clean -fd :\/ && rm -rf \.\.\/node_modules node_modules && pnpm --dir \.\. install --frozen-lockfile\n/)
})

test('a core.version.json that can\'t be written fails through the same report and rollback', (t) => {
  const root = createProject(t, { files: { 'core.version.json/keep': '' } })
  const before = stateOf(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 1, result.output)
  assert.match(result.stderr, /Update to 0\.1\.0-beta\.189 did not finish/)
  assert.match(result.stderr, /Failed during: write core\.version\.json \(EISDIR/)
  assert.match(result.stderr, /Done before that:[\s\S]*app\/ synced with core/)
  assert.doesNotMatch(result.output, /Update Complete|Update failed:/)
  assertRollbackRestores(root, result.stderr, before)
})

test('with --branch, the rollback also returns to the branch the update started on and deletes the update branch', (t) => {
  const root = createProject(t)
  const branch = git(root, 'symbolic-ref', '--short', 'HEAD')
  const before = stateOf(root)

  const result = runUpdateCore(root, ['--version', TO, '--branch'], { syncExit: 1 })

  assert.equal(result.status, 1, result.output)
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), 'update/0-1-0-beta-189')
  assert.match(result.stderr, /Done before that:\n {4}- created and switched to branch update\/0-1-0-beta-189\n/)
  assert.match(rollbackIn(result.stderr), new RegExp(`git checkout ${branch} && git update-ref -d refs/heads/update/0-1-0-beta-189 && rm -rf node_modules && pnpm install --frozen-lockfile$`))
  assertRollbackRestores(root, result.stderr, before)
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD'), branch)
})

/** A directory with a `git` that runs `script` for `git checkout -b` and the real git for everything else. */
function gitWithCheckout(t: { after: (fn: () => void) => void }, script: string) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-git-'))
  t.after(() => fs.rmSync(bin, { recursive: true, force: true }))
  const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim()
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nREAL_GIT='${real}'\nif [ "$1" = checkout ] && [ "$2" = -b ]; then\n${script}\nfi\nexec "$REAL_GIT" "$@"\n`, { mode: 0o755 })
  return bin
}

const PARTIAL_CHECKOUTS = [
  { name: 'creates and switches to the branch, then fails', script: '  "$REAL_GIT" "$@" >/dev/null 2>&1 || exit $?\n  echo "error: could not write the index" >&2\n  exit 42' },
  { name: 'fails without creating the branch', script: '  echo "fatal: cannot lock ref" >&2\n  exit 128' },
]

for (const checkout of PARTIAL_CHECKOUTS) {
  test(`with --branch, a git checkout -b that ${checkout.name} ends in the report and a rollback that restores the project`, (t) => {
    const root = createProject(t)
    const before = stateOf(root)
    const bin = gitWithCheckout(t, checkout.script)
    const pnpm = fakePnpm()
    t.after(() => pnpm.remove())

    const result = spawnSync(process.execPath, [UPDATE_CORE, '--version', TO, '--branch'], { cwd: root, encoding: 'utf8', timeout: 60_000, env: { ...pnpm.env, PATH: `${bin}${path.delimiter}${pnpm.env.PATH}` } })
    const output = `${result.stdout}${result.stderr}`

    assert.equal(result.status, 1, output)
    assert.match(result.stderr, /Update to 0\.1\.0-beta\.189 did not finish/)
    assert.match(result.stderr, /Failed during: create and switch to branch update\/0-1-0-beta-189 \(git checkout -b exited (?:42|128): /)
    assert.doesNotMatch(output, /Nothing was changed/)
    assert.deepEqual(pnpm.calls().filter((call) => !call.startsWith('view ')), [])
    assertRollbackRestores(root, result.stderr, before)
  })
}

test('a ^ or ~ range that starts at the installed target is set to the exact target, not taken for it', (t) => {
  const root = createProject(t, { pins: { '@nextsparkjs/core': `^${TO}`, '@nextsparkjs/cli': `^${TO}`, '@nextsparkjs/testing': `~${TO}` }, installed: TO })

  const result = runUpdateCore(root, ['--version', TO], {
    published: Object.fromEntries(PACKAGES.map((name) => [name, [FROM, TO, NEWER]])),
    latest: NEWER,
  })

  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /Already on/)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.deepEqual(PACKAGES.map((name) => manifest.dependencies[name] ?? manifest.devDependencies[name]), PACKAGES.map(() => TO))
  assert.deepEqual(installedVersions(root), PACKAGES.map(() => TO))
  assert.equal(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'), lockfileFor(PACKAGES.map((name) => [name, TO])))
})

test('the rollback installs what the commit\'s lockfile names, and fails without rewriting it when it doesn\'t match the commit\'s package.json', (t) => {
  // Ranges in package.json, exact specs in the lockfile: pnpm install would rewrite the lockfile
  const root = createProject(t, {
    pins: { '@nextsparkjs/core': `^${FROM}`, '@nextsparkjs/cli': `^${FROM}`, '@nextsparkjs/testing': `~${FROM}` },
    lockedSpecs: Object.fromEntries(PACKAGES.map((name) => [name, FROM])),
  })
  const before = stateOf(root)

  const result = runUpdateCore(root, ['--version', TO], { installExit: 1 })
  assert.equal(result.status, 1, result.output)

  const rollback = runRollback(root, rollbackIn(result.stderr))
  assert.notEqual(rollback.status, 0, rollback.output)
  assert.match(rollback.output, /ERR_PNPM_OUTDATED_LOCKFILE/)
  assertSameRepo(before)
})

/** Adds a repository of its own as the submodule vendor/sub of `root`, on its branch main, and commits it. */
function addSubmodule(t: { after: (fn: () => void) => void }, root: string, gitmodulesIgnore?: string) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'update-core-submodule-'))
  t.after(() => fs.rmSync(source, { recursive: true, force: true }))
  git(source, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(source, 'value.txt'), 'from the submodule\n')
  git(source, 'add', 'value.txt')
  git(source, 'commit', '-q', '-m', 'Submodule')
  git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', '-b', 'main', source, 'vendor/sub')
  if (gitmodulesIgnore) git(root, 'config', '-f', '.gitmodules', 'submodule.vendor/sub.ignore', gitmodulesIgnore)
  git(root, 'add', '.gitmodules')
  git(root, 'commit', '-q', '-m', 'Add vendor/sub')
  return path.join(root, 'vendor/sub')
}

test('the rollback also restores what lifecycle scripts wrote inside a submodule', (t) => {
  const root = createProject(t)
  const sub = addSubmodule(t, root)
  const before = stateOf(root)
  const subBefore = stateOf(sub)

  const result = runUpdateCore(root, ['--version', TO], {
    installExit: 1,
    installWrites: { 'vendor/sub/value.txt': 'written by postinstall\n', 'vendor/sub/stray.txt': 'x\n' },
  })

  assert.equal(result.status, 1, result.output)
  assert.match(result.stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4} [mM] vendor\/sub\n/)
  assertRollbackRestores(root, result.stderr, before)
  assertSameRepo(subBefore)
})

test('stops before changing anything when a submodule has changes its .gitmodules entry hides from git status', (t) => {
  const root = createProject(t)
  const sub = addSubmodule(t, root, 'all')
  fs.writeFileSync(path.join(sub, 'value.txt'), 'uncommitted work\n')
  const files = snapshot(root)

  const result = runUpdateCore(root, ['--version', TO])

  assert.notEqual(result.status, 0, result.output)
  assert.match(result.stderr, /Uncommitted changes[\s\S]*Nothing was changed/)
  assert.deepEqual(snapshot(root), files)
  assert.deepEqual(result.calls, [])
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`${signal} during pnpm install stops the install and ends in the report and a rollback that restores the project`, async (t) => {
    const root = createProject(t)
    const before = stateOf(root)
    const pnpm = fakePnpm({ installHangMs: 20_000, installWrites: { 'app/page.tsx': 'export default function Page() { return "half synced" }\n' } })
    t.after(() => pnpm.remove())

    const run = startUpdateCore(root, ['--version', TO], pnpm)
    const [installPid, lifecyclePid] = await hangingInstall(t, pnpm, run)

    // Only update-core gets the signal, as from kill or a process manager
    const signalled = Date.now()
    run.child.kill(signal)
    await run.gone
    const elapsed = Date.now() - signalled
    const { status, signal: exitSignal } = await run.exited
    const { stdout, stderr } = run

    // The install exits on the signal, so nothing is left to wait the 5 s for
    assert.ok(elapsed < 2500, `update-core exited ${elapsed} ms after the signal`)
    assert.equal(exitSignal, null, `update-core died of ${exitSignal} without reporting:\n${stdout}${stderr}`)
    assert.equal(status, 128 + os.constants.signals[signal], `${stdout}${stderr}`)
    assert.match(stderr, new RegExp(`Interrupted by ${signal} during: pnpm install\n {2}pnpm install and the processes it started exited after the signal\\.\n`))
    assert.match(stderr, /Done before that:\n {4}- package\.json: /)
    assert.match(stderr, /git status now[^\n]*\n(?: {4}.+\n)*? {4} M app\/page\.tsx\n/)
    assert.doesNotMatch(`${stdout}${stderr}`, /Update Complete/)
    assert.equal(pnpm.calls().includes('nextspark sync:app --force'), false)

    assert.equal(running(installPid), false, 'the install was still running after update-core exited')
    assert.equal(running(lifecyclePid), false, 'the install\'s lifecycle script was still running after update-core exited')
    assert.equal(fs.existsSync(`${pnpm.logPath}.finished`), false)
    assert.equal(fs.existsSync(`${pnpm.logPath}.lifecycle-finished`), false)

    assertRollbackRestores(root, stderr, before)
  })
}

test('an install that ignores the signal, and a second signal, are killed 5 s after the first signal, and the report says so', async (t) => {
  const root = createProject(t)
  const before = stateOf(root)
  const pnpm = fakePnpm({ installHangMs: 30_000, installIgnoreSignals: true })
  t.after(() => pnpm.remove())

  const run = startUpdateCore(root, ['--version', TO], pnpm)
  const [installPid, lifecyclePid] = await hangingInstall(t, pnpm, run)

  const signalled = Date.now()
  run.child.kill('SIGTERM')
  await sleep(300)
  run.child.kill('SIGTERM')
  const { status, signal } = await run.exited
  const elapsed = Date.now() - signalled
  const { stdout, stderr } = run

  assert.equal(signal, null, `${stdout}${stderr}`)
  assert.equal(status, 143, `${stdout}${stderr}`)
  assert.ok(elapsed >= 4500 && elapsed < 9000, `the report came ${elapsed} ms after the first signal:\n${stdout}${stderr}`)
  assert.match(stderr, /Interrupted by SIGTERM during: pnpm install\n {2}pnpm install or processes it started were still running 5 s after the signal, and were killed with SIGKILL\.\n/)
  assert.doesNotMatch(stderr, /may still write to the project/)
  assert.equal(running(installPid), false, 'the install was still running after update-core exited')
  assert.equal(running(lifecyclePid), false, 'the install\'s lifecycle script was still running after update-core exited')
  assert.equal(fs.existsSync(`${pnpm.logPath}.lifecycle-finished`), false)

  assertRollbackRestores(root, stderr, before)
})

test('SIGKILL to update-core during pnpm install kills the install as well, so it can\'t write over the rollback run after it', async (t) => {
  const root = createProject(t)
  const before = stateOf(root)
  const hangMs = 6000
  const pnpm = fakePnpm({ installHangMs: hangMs })
  t.after(() => pnpm.remove())

  const run = startUpdateCore(root, ['--version', TO], pnpm)
  const [installPid, lifecyclePid] = await hangingInstall(t, pnpm, run)
  const startedAt = Date.now()

  run.child.kill('SIGKILL')
  assert.equal(await run.gone, 'SIGKILL')
  for (const deadline = Date.now() + 2000; running(installPid) || running(lifecyclePid); await sleep(20)) {
    assert.ok(Date.now() < deadline, `the install (${running(installPid)}) or its lifecycle script (${running(lifecyclePid)}) was still running 2 s after update-core was killed`)
  }

  assertRollbackRestores(root, run.stdout, before, earlyRollbackIn(run.stdout))
  await sleep(Math.max(0, startedAt + hangMs + 1000 - Date.now()))
  assert.equal(fs.existsSync(`${pnpm.logPath}.finished`), false)
  assert.equal(fs.existsSync(`${pnpm.logPath}.lifecycle-finished`), false)
  assertSameRepo(before)
})

test('SIGKILL to update-core while it waits for a lifecycle script that outlived the stopped install still kills that script', async (t) => {
  const root = createProject(t)
  const hangMs = 8000
  const pnpm = fakePnpm({ installHangMs: hangMs, lifecycleIgnoresSignals: true })
  t.after(() => pnpm.remove())

  const run = startUpdateCore(root, ['--version', TO], pnpm)
  const [installPid, lifecyclePid] = await hangingInstall(t, pnpm, run)

  run.child.kill('SIGINT')
  for (const deadline = Date.now() + 2000; running(installPid); await sleep(20)) {
    assert.ok(Date.now() < deadline, 'the install did not exit on SIGINT')
  }
  assert.equal(running(lifecyclePid), true, 'the lifecycle script exited on SIGINT, so this does not test what it means to')
  run.child.kill('SIGKILL')
  assert.equal(await run.gone, 'SIGKILL')
  for (const deadline = Date.now() + 2000; running(lifecyclePid); await sleep(20)) {
    assert.ok(Date.now() < deadline, 'the lifecycle script was still running 2 s after update-core was killed')
  }
  await sleep(hangMs)
  assert.equal(fs.existsSync(`${pnpm.logPath}.lifecycle-finished`), false)
})

test('update-core exits as soon as the update is complete', async (t) => {
  const root = createProject(t)
  const pnpm = fakePnpm()
  t.after(() => pnpm.remove())

  const run = startUpdateCore(root, ['--version', TO], pnpm)
  let completed = 0
  run.child.stdout.on('data', () => {
    if (!completed && /Update Complete/.test(run.stdout)) completed = Date.now()
  })
  await run.gone
  const elapsed = Date.now() - completed

  assert.ok(completed, `${run.stdout}${run.stderr}`)
  assert.ok(elapsed < 1000, `update-core exited ${elapsed} ms after reporting the update complete`)
})

test('a process an install leaves running in its group is stopped before the update goes on, so it can\'t write later', async (t) => {
  const root = createProject(t)
  const leftoverMs = 3000
  const pnpm = fakePnpm({ installLeavesChildMs: leftoverMs })
  t.after(() => pnpm.remove())

  const run = startUpdateCore(root, ['--version', TO], pnpm)
  const { status } = await run.exited
  const leftover = Number(fs.readFileSync(`${pnpm.logPath}.leftover-running`, 'utf8'))
  t.after(() => {
    try { process.kill(leftover, 'SIGKILL') } catch {}
  })

  assert.equal(status, 0, `${run.stdout}${run.stderr}`)
  assert.match(run.stdout, /Processes pnpm install started were still running after it exited, and were stopped with SIGTERM\./)
  assert.equal(running(leftover), false, 'the process the install left was still running after update-core exited')
  await sleep(leftoverMs + 500)
  assert.equal(fs.existsSync(`${pnpm.logPath}.leftover-finished`), false)
})

test('a project with a packages/core of its own is not taken for the NextSpark monorepo', (t) => {
  const root = createProject(t, { files: { 'packages/core/package.json': `${JSON.stringify({ name: '@acme/core' })}\n` } })

  const result = runUpdateCore(root, ['--version', TO])

  assert.equal(result.status, 0, result.output)
  assert.doesNotMatch(result.output, /NextSpark monorepo/)
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
