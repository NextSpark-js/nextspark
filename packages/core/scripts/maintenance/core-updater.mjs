/**
 * Updates a NextSpark project to another release of the @nextsparkjs packages.
 *
 * A project takes NextSpark from npm: its package.json pins @nextsparkjs/core,
 * @nextsparkjs/cli and the other @nextsparkjs packages to one version, app/ is
 * kept in step with core's templates by `nextspark sync:app`, and contents/
 * holds the project's own themes and plugins. So an update sets those pins to
 * the new version, installs, and syncs app/. No framework source is copied into
 * the project, and of package.json only the @nextsparkjs versions change.
 *
 * What can be checked without changing anything is checked before the first
 * write, so a run that can't start says why and leaves the project as it was.
 * A run only starts from a clean git tree, because a run that fails or is
 * interrupted once it has started writing undoes nothing itself: pnpm install
 * runs lifecycle scripts, and those can write anywhere in the project, so the
 * one rollback that covers whatever was written is going back to the commit the
 * run started from. It exits non-zero and prints what it got through, what git
 * status shows and that rollback.
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCOPE = '@nextsparkjs/'
const CORE_PACKAGE = '@nextsparkjs/core'
const CLI_PACKAGE = '@nextsparkjs/cli'
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies']
const VERSION_FILE = 'core.version.json'
const LOCKFILE = 'pnpm-lock.yaml'
const LIST_LIMIT = 20
const STATUS_SHOWN = 40
/** Signals an update stops its running step for and reports on; SIGHUP is a closed terminal */
const HANDLED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']
/** How long a stopped step's processes get to exit before they are killed */
const STOP_GRACE_MS = 5000
/** How long processes sent SIGKILL, or a released step guard, get to be gone */
const KILL_WAIT_MS = 2000
/** How long a step's group gets to empty on its own once its command exited */
const SETTLE_MS = 500
/** Runs each long step and kills it if update-core goes away first */
const STEP_GUARD = fileURLToPath(new URL('./step-guard.mjs', import.meta.url))

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

const HELP = `
NextSpark Core Updater

Usage:
  pnpm update-core [options]

Options:
  --version <version>     Update to this version (e.g. 0.1.0-beta.189)
  --latest                Update to the version npm tags latest (default)
  --branch, -b            Create the branch update/<version> and update there
  --list                  List the published versions
  --check                 Say whether a newer version is published
  --current               Show the installed version
  --help, -h              Show this help message

What gets updated:
  package.json            Only the versions of the @nextsparkjs packages, all set to exactly
                          the target: a ^ or ~ range is replaced, since pnpm would install
                          the newest version the range allows instead of the target
  pnpm-lock.yaml, node_modules   Through pnpm install, run where pnpm-lock.yaml is (in a
                          web-mobile project, the directory above web/)
  app/                    Synced with core's templates by nextspark sync:app, which keeps
                          files the project customized and rebuilds the registries
  next.config.mjs, tsconfig.json, i18n.ts, proxy.ts or middleware.ts
                          Also synced by sync:app, which keeps them when customized
  core.version.json       Written once everything above succeeded

What update-core itself never writes:
  The rest of package.json (name, scripts, other dependencies)
  contents/               The project's themes and plugins
  .env*                   Environment files
Lifecycle scripts that pnpm install runs are not bound by this list.

The update stops before changing anything when the project isn't in a git
repository with a commit, when it has uncommitted changes or no committed
pnpm-lock.yaml, when a @nextsparkjs package isn't published at the target
version, when the target is older than the installed version, when package.json
takes a @nextsparkjs package from somewhere other than the registry, or when .env
doesn't set NEXT_PUBLIC_ACTIVE_THEME, which the registry build needs. When every
@nextsparkjs package is already installed and pinned exactly to the target, there
is nothing to do and nothing is changed; a ^ or ~ range is set to the exact
target like any other pin.

If a step fails, or the run is interrupted with Ctrl-C (SIGINT), SIGTERM or
SIGHUP, after it started changing the project, update-core stops the running
step (processes still running 5 s after the signal are killed), undoes nothing,
exits non-zero and prints what it got through, what git status shows and the
command that rolls the project back to the commit it started from:
  git reset --hard <commit> && git clean -fd && rm -rf node_modules && pnpm install --frozen-lockfile
That command is also printed before the first change, for a run that is killed
without a chance to report (SIGKILL); the step such a run was running is killed
with it. The rollback can't bring back files .gitignore ignores that a lifecycle
script overwrote, nor git refs a script changed, and removes untracked files
created while the update ran.
`

/** Runs a command to completion, printing its output as it goes unless `capture` asks for it back. */
export function runCommand(command, args, { cwd, capture = false }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32' && !path.isAbsolute(command),
  })
  return {
    status: result.error ? null : result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ?? null,
  }
}

/**
 * Orders two semver versions: negative when `a` comes first, positive when `b`
 * does. A release comes after its prereleases, and prerelease identifiers
 * compare numerically when both are numbers.
 */
export function compareVersions(a, b) {
  const left = a.match(VERSION_PATTERN)
  const right = b.match(VERSION_PATTERN)
  for (let i = 1; i <= 3; i++) {
    const difference = Number(left[i]) - Number(right[i])
    if (difference !== 0) return Math.sign(difference)
  }
  if (!left[4] || !right[4]) return left[4] ? -1 : right[4] ? 1 : 0

  const leftIds = left[4].split('.')
  const rightIds = right[4].split('.')
  for (let i = 0; i < Math.max(leftIds.length, rightIds.length); i++) {
    if (leftIds[i] === undefined) return -1
    if (rightIds[i] === undefined) return 1
    const leftNumeric = /^\d+$/.test(leftIds[i])
    const rightNumeric = /^\d+$/.test(rightIds[i])
    if (leftNumeric && rightNumeric) {
      const difference = Number(leftIds[i]) - Number(rightIds[i])
      if (difference !== 0) return Math.sign(difference)
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1
    } else if (leftIds[i] !== rightIds[i]) {
      return leftIds[i] < rightIds[i] ? -1 : 1
    }
  }
  return 0
}

function isVersion(value) {
  return typeof value === 'string' && VERSION_PATTERN.test(value)
}

/** A spec with a protocol or a path takes the package from somewhere other than the registry. */
function takesFromRegistry(spec) {
  return !spec.includes(':') && !spec.includes('/')
}

function parseArguments(args) {
  const flags = { version: null, list: false, check: false, current: false, help: false, branch: false }
  const problems = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--version' || arg === '-v') {
      const value = args[i + 1]
      if (value === undefined || value.startsWith('-')) {
        problems.push(`${arg} needs a version, e.g. ${arg} 0.1.0-beta.189`)
      } else {
        flags.version = value
        i++
      }
    } else if (arg.startsWith('--version=')) {
      flags.version = arg.slice('--version='.length)
    } else if (arg === '--latest') {
      flags.version = null
    } else if (arg === '--list') {
      flags.list = true
    } else if (arg === '--check') {
      flags.check = true
    } else if (arg === '--current') {
      flags.current = true
    } else if (arg === '--branch' || arg === '-b') {
      flags.branch = true
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true
    } else {
      problems.push(`Unknown option: ${arg}`)
    }
  }

  if (flags.version !== null) {
    flags.version = flags.version.replace(/^v/, '')
    if (!isVersion(flags.version)) problems.push(`Not a version: ${flags.version}`)
  }

  return { flags, problems }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readOptional(file) {
  try {
    return fs.readFileSync(file)
  } catch {
    return null
  }
}

/** The version of `name` in the project's node_modules, or null. */
function installedVersion(cwd, name) {
  return readJson(path.join(cwd, 'node_modules', name, 'package.json'))?.version ?? null
}

/** The project's package.json and the @nextsparkjs packages it declares, or why it can't be updated. */
function readProject(cwd) {
  let manifestText
  try {
    manifestText = fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
  } catch {
    return { problem: 'No package.json here. Run update-core from the project root.' }
  }

  let manifest
  try {
    manifest = JSON.parse(manifestText)
  } catch (error) {
    return { problem: `package.json is not valid JSON: ${error.message}` }
  }

  if (readJson(path.join(cwd, 'packages', 'core', 'package.json'))?.name === CORE_PACKAGE) {
    return { problem: 'This is the NextSpark monorepo, where core is developed. update-core updates a project that installs @nextsparkjs/core.' }
  }

  const packages = []
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith(SCOPE)) packages.push({ field, name, spec })
    }
  }

  if (!packages.some(({ name }) => name === CORE_PACKAGE)) {
    if (fs.existsSync(path.join(cwd, 'core'))) {
      return {
        problem: 'This project keeps the framework in core/, the layout from before NextSpark shipped as npm packages, and update-core only updates projects that install @nextsparkjs/core. Nothing was changed.\n' +
          '  To move it over, create a project with create-nextspark-app and bring your contents/ across.',
      }
    }
    return { problem: `package.json doesn't depend on ${CORE_PACKAGE}, so there is nothing for update-core to update.` }
  }

  return { manifestText, manifest, packages, installed: installedVersion(cwd, CORE_PACKAGE) }
}

/** Whatever `pnpm view <spec> <field> --json` prints, parsed, or the error it gave. */
function viewRegistry(run, cwd, spec, field) {
  const result = run('pnpm', ['view', spec, field, '--json'], { cwd, capture: true })
  if (result.error?.code === 'ENOENT') return { error: 'pnpm is not installed or not on PATH' }
  if (result.status !== 0) {
    return { error: (result.stderr || result.stdout || `pnpm view exited with ${result.status}`).trim() }
  }
  try {
    return { value: JSON.parse(result.stdout) }
  } catch {
    return { error: `pnpm view ${spec} ${field} printed something other than JSON` }
  }
}

function publishedVersions(run, cwd, name) {
  const { value, error } = viewRegistry(run, cwd, name, 'versions')
  if (error) return { error }
  return { versions: (Array.isArray(value) ? value : [value]).filter(isVersion) }
}

function latestVersion(run, cwd) {
  const { value, error } = viewRegistry(run, cwd, CORE_PACKAGE, 'dist-tags')
  if (error) return { error }
  if (!isVersion(value?.latest)) return { error: `npm has no latest tag for ${CORE_PACKAGE}` }
  return { version: value.latest }
}

function realPath(file) {
  try {
    return fs.realpathSync(file)
  } catch {
    return path.resolve(file)
  }
}

/**
 * Where the project stands in git: the commit and branch it is on, whether
 * anything is uncommitted, and whether the commit has submodules. Changes
 * inside a submodule count as uncommitted even where .gitmodules or the git
 * config tells git status to ignore them, since the rollback resets submodules
 * too.
 */
function gitState(run, cwd) {
  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd, capture: true })
  if (top.status !== 0) return { repo: false }

  const head = run('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd, capture: true })
  const status = run('git', ['status', '--porcelain=v1', '--ignore-submodules=none'], { cwd, capture: true })
  const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd, capture: true })
  const gitmodules = run('git', ['ls-files', '--', ':/.gitmodules'], { cwd, capture: true })
  return {
    repo: true,
    top: top.stdout.trim(),
    head: head.status === 0 ? head.stdout.trim() : null,
    dirty: status.status !== 0 || status.stdout.trim() !== '',
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    submodules: gitmodules.status !== 0 || gitmodules.stdout.trim() !== '',
  }
}

function branchName(version) {
  return `update/${version.replace(/[.+]/g, '-')}`
}

function branchExists(run, cwd, name) {
  return run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { cwd, capture: true }).status === 0
}

/** `value` as one shell word. */
function shellWord(value) {
  return /^[\w./@%+=:,-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`
}

/**
 * The directory the project's pnpm install runs in: the nearest one from `cwd`
 * up to the top of the repository with a pnpm-lock.yaml, which for a web-mobile
 * project is the one above web/, or null when there is none. Run from a web/
 * that carries a pnpm-workspace.yaml of its own, pnpm would take that file for
 * the whole workspace and install web/ on its own.
 */
function installRoot(cwd, top) {
  const stop = realPath(top)
  for (let dir = realPath(cwd); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, LOCKFILE))) return dir
    if (dir === stop || path.dirname(dir) === dir) return null
  }
}

/**
 * The command that puts the project back at the commit the update started from.
 * The tree was clean then, so resetting tracked files and removing untracked ones
 * undoes whatever the update and the scripts it ran wrote in the repository;
 * `git clean` only cleans below the directory it runs in, so from web/ in a
 * web-mobile project it is pointed at the top of the repository. Neither goes
 * into submodules: when the commit has any, each checked-out submodule is reset
 * to its own HEAD, moved back to the commit the project records for it if a
 * script moved it (which leaves that one detached), and cleaned. With --branch,
 * the update branch is deleted with update-ref, which also succeeds when the run
 * stopped before creating it. node_modules is removed before installing because
 * an install that was stopped can leave it holding the new versions while the
 * lockfile still names the old ones, and pnpm install then finds nothing to do;
 * the install is frozen to the commit's lockfile, so it fails instead of
 * rewriting a lockfile that doesn't match the commit's package.json.
 */
function rollbackCommand(git, { cwd, root, branch }) {
  const commit = git.head.slice(0, 12)
  const project = realPath(cwd)
  const commands = [`git reset --hard ${commit}`]
  if (git.submodules) commands.push('git submodule foreach --recursive git reset --hard', 'git submodule update --recursive')
  commands.push(realPath(git.top) === project ? 'git clean -fd' : 'git clean -fd :/')
  if (git.submodules) commands.push('git submodule foreach --recursive git clean -fd')
  if (branch) {
    commands.push(git.branch ? `git checkout ${shellWord(git.branch)}` : `git checkout --detach ${commit}`, `git update-ref -d refs/heads/${branch}`)
  }
  const fromProject = path.relative(project, root)
  commands.push(
    `rm -rf ${[...(fromProject ? [path.join(fromProject, 'node_modules')] : []), 'node_modules'].map(shellWord).join(' ')}`,
    fromProject ? `pnpm --dir ${shellWord(fromProject)} install --frozen-lockfile` : 'pnpm install --frozen-lockfile',
  )
  return commands.join(' && ')
}

/** package.json text with `manifest` in it, keeping the indentation and line endings it had. */
function manifestText(manifest, original) {
  const indent = original.match(/^[ \t]+(?=")/m)?.[0] ?? 2
  let text = JSON.stringify(manifest, null, indent)
  if (original.endsWith('\n')) text += '\n'
  if (original.includes('\r\n')) text = text.replace(/\r?\n/g, '\r\n')
  return text
}

/**
 * The entry point of the nextspark CLI installed in the project. Running it with
 * node skips `pnpm exec`, which checks the install against the lockfile first
 * and, under pnpm 11, fetches the registry metadata of every package to do so.
 */
function installedCli(cwd) {
  const cliDir = path.join(cwd, 'node_modules', CLI_PACKAGE)
  const bin = readJson(path.join(cliDir, 'package.json'))?.bin
  const entry = typeof bin === 'string' ? bin : bin?.nextspark
  return entry ? path.join(cliDir, entry) : null
}

/**
 * Whether the registry build sync:app runs has a theme to build: it reads
 * NEXT_PUBLIC_ACTIVE_THEME from the project's .env or the environment, and
 * without one it skips the build and still exits 0.
 */
function hasActiveTheme(cwd, env) {
  if (env.NEXT_PUBLIC_ACTIVE_THEME) return true
  const text = readOptional(path.join(cwd, '.env'))?.toString('utf8') ?? ''
  const lines = text.split(/\r?\n/).filter((line) => /^\s*(?:export\s+)?NEXT_PUBLIC_ACTIVE_THEME\s*=/.test(line))
  if (lines.length === 0) return false
  const raw = lines.at(-1).slice(lines.at(-1).indexOf('=') + 1).trim()
  const quoted = raw.match(/^(["'`])(.*?)\1/)
  const value = quoted ? quoted[2] : raw.replace(/\s+#.*$/, '').trim()
  return value !== ''
}

function coreMigrations(cwd) {
  try {
    return fs.readdirSync(path.join(cwd, 'node_modules', CORE_PACKAGE, 'migrations')).filter((file) => file.endsWith('.sql'))
  } catch {
    return []
  }
}

/** Sends `signal` to every process of the group a step runs in. */
function signalGroup(pid, signal) {
  if (process.platform === 'win32') {
    // Windows has no process groups: taskkill /T ends the step's process tree
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 })
    return
  }
  try {
    process.kill(-pid, signal)
  } catch {
    // ESRCH: nothing left in the group
  }
}

/**
 * Whether any process of a step's group may still be running. EPERM counts as
 * running: a process in the group can't be signalled, which on macOS is also
 * the answer while its processes have exited and wait to be reaped.
 */
function groupRunning(pid) {
  if (process.platform === 'win32') return false
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * `promise`'s value, or `fallback` once `ms` pass. The timer is cleared as soon
 * as either settles, so a wait that ended early doesn't keep update-core running.
 */
function within(promise, ms, fallback) {
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, Math.max(0, ms), fallback) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Waits until the group is empty or `deadline` passes, and says whether it emptied. */
async function groupGone(pid, deadline) {
  while (Date.now() < deadline) {
    if (!groupRunning(pid)) return true
    await pause(Math.min(100, Math.max(0, deadline - Date.now())))
  }
  return !groupRunning(pid)
}

/**
 * Watches for the signals an update reports on while it writes. The first one
 * is passed on to the running step's group, if any, and kept for the report,
 * and from it the step's processes have STOP_GRACE_MS to exit. A repeat changes
 * nothing: `pnpm update-core` passes on the signals it gets, so the Ctrl-C a
 * terminal sends to both can arrive twice.
 */
function watchSignals() {
  let interrupt
  const watch = {
    signal: null,
    /** When the processes of a step stopped by the signal get killed */
    deadline: null,
    /** The pid of the running step, which is its group's id, once known */
    step: null,
    interrupted: new Promise((resolve) => { interrupt = resolve }),
  }
  const onSignal = (signal) => {
    if (watch.signal) return
    watch.signal = signal
    watch.deadline = Date.now() + STOP_GRACE_MS
    if (watch.step) signalGroup(watch.step, signal)
    interrupt()
  }
  for (const signal of HANDLED_SIGNALS) process.on(signal, onSignal)
  watch.stop = () => {
    for (const signal of HANDLED_SIGNALS) process.off(signal, onSignal)
  }
  return watch
}

/**
 * Stops what is left of a step's group: sends `signal` unless it was already
 * sent, waits for the group to empty until `deadline`, and then kills it.
 * Returns how it stopped: 'exited' or 'killed', and whether anything was still
 * running after being killed.
 */
async function stopGroup(pid, { signal, deadline }) {
  if (signal) signalGroup(pid, signal)
  if (await groupGone(pid, deadline)) return { stop: 'exited', leftRunning: false }
  signalGroup(pid, 'SIGKILL')
  return { stop: 'killed', leftRunning: !(await groupGone(pid, Date.now() + KILL_WAIT_MS)) }
}

/**
 * Runs a step's command and resolves once it is done with it: when it exited
 * and its group emptied, or, when the run was interrupted, when its group
 * emptied or its processes were killed STOP_GRACE_MS after the signal, without
 * waiting for the command itself to exit. The command runs through
 * step-guard.mjs, in a process group of its own that also holds the lifecycle
 * scripts pnpm install starts, so nothing keeps writing after the step: when
 * the command exits, failing or not, whatever is still left of its group after
 * SETTLE_MS gets SIGTERM and is killed STOP_GRACE_MS later, and if update-core
 * is killed before it is done with the step, the guard kills the group. Ctrl-C
 * reaches update-core only, which passes it on. The step's stdin is closed: from
 * a background group, reading the terminal would stop it instead of failing.
 */
async function runStep(command, args, { cwd, signals }) {
  const guard = spawn(process.execPath, [STEP_GUARD, command, ...args], {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    detached: process.platform !== 'win32',
  })

  let started
  let finished
  const startedStep = new Promise((resolve) => { started = resolve })
  const exited = new Promise((resolve) => { finished = resolve })
  guard.on('message', (message) => {
    if (message?.pid) {
      signals.step = message.pid
      // A signal that came before the pid did is passed on now
      if (signals.signal) signalGroup(message.pid, signals.signal)
      started(message.pid)
    } else if (message?.exit) {
      finished({ status: message.exit.code, signal: message.exit.signal, error: null })
    } else if (message?.error) {
      started(null)
      finished({ status: null, signal: null, error: message.error })
    }
  })
  const guardGone = new Promise((resolve) => {
    guard.on('error', (error) => resolve({ status: null, signal: null, error }))
    guard.once('exit', (code, signal) => resolve({ status: null, signal: null, error: { message: `its guard process exited (${signal ?? `exit ${code}`})` } }))
  })
  guardGone.then((result) => {
    started(null)
    finished(result)
  })

  // A signal waits for the step's pid only until its deadline
  const pid = await Promise.race([
    startedStep,
    signals.interrupted.then(() => within(startedStep, signals.deadline - Date.now(), undefined)),
  ])
  if (pid === undefined) {
    // Without the pid the step's group is out of reach: closing the channel has the guard kill it, if the guard can still run
    guard.kill('SIGCONT')
    guard.disconnect()
    if (!(await within(guardGone.then(() => true), KILL_WAIT_MS, false))) guard.kill('SIGKILL')
    signals.step = null
    return { status: null, signal: null, error: null, stop: 'unreached', leftRunning: false }
  }

  const result = await Promise.race([exited, signals.interrupted.then(() => null)])
  let outcome = { stop: null, leftRunning: false }
  if (pid !== null) {
    if (signals.signal) {
      outcome = await stopGroup(pid, { deadline: signals.deadline })
    } else if (!(await groupGone(pid, Date.now() + SETTLE_MS))) {
      // The command exited, failing or not, and left processes running that could still write
      outcome = await stopGroup(pid, { signal: 'SIGTERM', deadline: Math.min(Date.now() + STOP_GRACE_MS, signals.deadline ?? Infinity) })
    }
  }
  signals.step = null
  guard.send('release', () => {})
  if (!(await within(guardGone.then(() => true), KILL_WAIT_MS, false))) guard.kill('SIGKILL')
  return { ...(result ?? { status: null, signal: null, error: null }), ...outcome }
}

function describeExit(result) {
  if (result.error) return result.error.code === 'ENOENT' ? 'not found on PATH' : result.error.message
  return result.signal ? `killed by ${result.signal}` : `exit ${result.status}`
}

function listReleases({ run, cwd, installed, out, err }) {
  const published = publishedVersions(run, cwd, CORE_PACKAGE)
  if (published.error) {
    err(`Could not read the published versions of ${CORE_PACKAGE}:\n${published.error}`)
    return 1
  }
  const latest = latestVersion(run, cwd).version

  const versions = [...published.versions].sort(compareVersions).reverse()
  out(`Published versions of ${CORE_PACKAGE}:\n`)
  for (const version of versions.slice(0, LIST_LIMIT)) {
    const marks = [version === latest && 'latest', version === installed && 'installed'].filter(Boolean)
    out(`  ${version}${marks.length > 0 ? ` (${marks.join(', ')})` : ''}`)
  }
  if (versions.length > LIST_LIMIT) out(`  ... and ${versions.length - LIST_LIMIT} older`)
  return 0
}

function checkUpdates({ run, cwd, installed, out, err }) {
  const latest = latestVersion(run, cwd)
  if (latest.error) {
    err(`Could not read the latest version of ${CORE_PACKAGE}:\n${latest.error}`)
    return 1
  }
  out(`Installed: ${installed ?? 'not installed'}`)
  out(`Latest:    ${latest.version}`)
  if (!installed || compareVersions(latest.version, installed) > 0) {
    out('\nUpdate available. Run: pnpm update-core')
  } else {
    out("\nYou're up to date.")
  }
  return 0
}

function banner(out, title) {
  out('\n========================================')
  out(`  ${title}`)
  out('========================================')
}

/**
 * The report of an update that stopped after it started writing: what stopped
 * it, how the processes of the step it stopped ended, the steps it finished and
 * the ones it never reached, what git status shows now, and the rollback.
 * Returns the exit code, 128 plus the signal's number for an interrupted run.
 */
function stoppedReport({ run, cwd, err, target, rollback, signal, step, started, reason, stop, leftRunning, done, notReached }) {
  const grace = `${STOP_GRACE_MS / 1000} s`
  banner(err, `Update to ${target} did not finish`)
  err('')
  if (signal) err(`  Interrupted by ${signal} ${started ? 'during' : 'before'}: ${step}`)
  else err(`  Failed during: ${step} (${reason})`)
  if (signal && stop === 'exited') err(`  ${step} and the processes it started exited after the signal.`)
  if (signal && stop === 'killed') err(`  ${step} or processes it started were still running ${grace} after the signal, and were killed with SIGKILL.`)
  if (signal && stop === 'unreached') err(`  The process that runs ${step} didn't say which process group it runs in within ${grace} of the signal, and was stopped; ${step} may still be running and write to the project.`)
  if (!signal && stop === 'exited') err('  Processes it started were still running after it exited, and exited after SIGTERM.')
  if (!signal && stop === 'killed') err(`  Processes it started were still running after it exited and ${grace} after SIGTERM, and were killed with SIGKILL.`)
  if (leftRunning) err('  Some of its processes were still running after being killed, and may still write to the project.')
  if (done.length > 0) {
    err('\n  Done before that:')
    for (const line of done) err(`    - ${line}`)
  }
  if (notReached.length > 0) {
    err('\n  Not reached:')
    for (const line of notReached) err(`    - ${line}`)
  }

  err('\n  Nothing was undone. A step that stopped may have written part of its work, and the')
  err('  lifecycle scripts pnpm install runs can write anywhere in the project.')
  const status = run('git', ['status', '--short', '--ignore-submodules=none'], { cwd, capture: true })
  if (status.status !== 0) {
    err(`  git status failed: ${(status.stderr || status.stdout).trim()}`)
  } else {
    const lines = status.stdout.split('\n').filter(Boolean)
    if (lines.length === 0) {
      err('  git status shows no changes.')
    } else {
      err('  git status now (files .gitignore ignores, like node_modules, are not listed):')
      for (const line of lines.slice(0, STATUS_SHOWN)) err(`    ${line}`)
      if (lines.length > STATUS_SHOWN) err(`    ... and ${lines.length - STATUS_SHOWN} more (git status lists them all)`)
    }
  }

  err('\n  To put the project back at the commit the update started from, run here:')
  err(`    ${rollback}`)
  err(`  Then ${signal ? '' : 'fix what failed and '}run update-core --version ${target} again.`)
  err('')
  return signal ? 128 + (os.constants.signals[signal] ?? 0) : 1
}

/**
 * Runs `update-core` with `args` against the project in `cwd` and resolves to
 * the exit code. `run` executes the commands that only read and `out`/`err`
 * print, so a test can hand in its own.
 */
export async function updateCore(args, { cwd = process.cwd(), env = process.env, run = runCommand, out = console.log, err = console.error, now = () => new Date() } = {}) {
  const { flags, problems } = parseArguments(args)
  if (problems.length > 0) {
    for (const problem of problems) err(problem)
    err('Run pnpm update-core --help for the options.')
    return 1
  }
  if (flags.help) {
    out(HELP)
    return 0
  }

  const project = readProject(cwd)
  if (project.problem) {
    err(`update-core: ${project.problem}`)
    return 1
  }
  const { manifest, packages, installed } = project

  if (flags.current) {
    const spec = packages.find(({ name }) => name === CORE_PACKAGE).spec
    out(installed ? `${CORE_PACKAGE} ${installed}` : `${CORE_PACKAGE} is not installed (package.json asks for ${spec})`)
    return 0
  }
  if (flags.list) return listReleases({ run, cwd, installed, out, err })
  if (flags.check) return checkUpdates({ run, cwd, installed, out, err })

  out('\n========================================')
  out('  NextSpark Core Updater')
  out('========================================\n')

  // Every check comes before the first write
  out('[1/5] Checking the project...')

  const fromElsewhere = packages.filter(({ spec }) => !takesFromRegistry(spec))
  if (fromElsewhere.length > 0) {
    err('   package.json takes these from somewhere other than the registry, so there is no version for update-core to set:')
    for (const { name, spec } of fromElsewhere) err(`     ${name}: ${spec}`)
    err('   Nothing was changed.')
    return 1
  }

  if (!packages.some(({ name }) => name === CLI_PACKAGE)) {
    err(`   update-core syncs app/ through the nextspark CLI, and package.json doesn't depend on ${CLI_PACKAGE}. Nothing was changed.`)
    return 1
  }

  if (!installed) {
    err(`   node_modules has no ${CORE_PACKAGE}. Run pnpm install first, so the update starts from a known version. Nothing was changed.`)
    return 1
  }

  const git = gitState(run, cwd)
  if (!git.repo || !git.head) {
    err(`   update-core needs the project in a git repository with a commit to start from: an update that fails or is interrupted is rolled back by returning to that commit. ${git.repo ? 'Make a first commit' : 'Run git init and commit the project'} first. Nothing was changed.`)
    return 1
  }
  if (git.dirty) {
    err('   Uncommitted changes. Commit or stash them first: an update that fails or is interrupted is rolled back by returning to the commit it started from, which would discard them. Nothing was changed.')
    return 1
  }

  // The rollback installs exactly what the commit's lockfile records, so the commit needs one
  const root = installRoot(cwd, git.top)
  const lockfile = root && run('git', ['ls-files', '--error-unmatch', '--', path.join(root, LOCKFILE)], { cwd, capture: true })
  if (!root || lockfile.status !== 0) {
    err(`   ${root ? `${path.relative(cwd, path.join(root, LOCKFILE)) || LOCKFILE} isn't committed` : `No ${LOCKFILE} here or above, up to the top of the repository`}. An update that fails or is interrupted is rolled back by installing what the lockfile of the commit it started from records, so commit ${LOCKFILE} first. Nothing was changed.`)
    return 1
  }

  if (!hasActiveTheme(cwd, env)) {
    err('   NEXT_PUBLIC_ACTIVE_THEME is not set in .env, and sync:app skips the registry build without it, so app/(templates) would stay on the old core. Set it and run update-core again. Nothing was changed.')
    return 1
  }
  out(`   Installed: ${CORE_PACKAGE} ${installed}`)

  let target = flags.version
  if (!target) {
    const latest = latestVersion(run, cwd)
    if (latest.error) {
      err(`   Could not read the latest version of ${CORE_PACKAGE}:\n${latest.error}\n   Nothing was changed.`)
      return 1
    }
    target = latest.version
  }
  out(`   Target:    ${target}`)

  if (compareVersions(target, installed) < 0) {
    err(`   ${target} is older than the installed ${installed}. update-core doesn't downgrade: app/ would be synced back and applied migrations can't be undone. Nothing was changed.`)
    return 1
  }

  if (packages.every(({ name, spec }) => spec === target && installedVersion(cwd, name) === target)) {
    out(`\n   Already on ${target}: every @nextsparkjs package in package.json is pinned to it and node_modules holds it. Nothing was changed.\n`)
    return 0
  }

  const missing = []
  for (const { name } of packages) {
    const published = publishedVersions(run, cwd, name)
    if (published.error) {
      err(`   Could not read the published versions of ${name}:\n${published.error}\n   Nothing was changed.`)
      return 1
    }
    if (!published.versions.includes(target)) missing.push(name)
  }
  if (missing.length > 0) {
    err(`   Not published at ${target}: ${missing.join(', ')}. Nothing was changed.`)
    return 1
  }
  out(`   Published: all ${packages.length} @nextsparkjs packages at ${target}`)

  const branch = flags.branch ? branchName(target) : null
  if (branch && branchExists(run, cwd, branch)) {
    err(`   Branch ${branch} already exists. Delete it (git branch -D ${branch}) or update without --branch. Nothing was changed.`)
    return 1
  }

  const rollback = rollbackCommand(git, { cwd, root, branch })
  out(`\n   Starting from commit ${git.head.slice(0, 12)}. If this run is killed before it can report (SIGKILL), roll back with:`)
  out(`     ${rollback}`)
  out('   Killing this run also kills the install or sync it is running, but not processes that left that step\'s process group.')
  out('   The rollback removes files created in the repository while the update runs, and can\'t bring back ignored files, like .env, that a lifecycle script overwrites.')

  // From here on the project changes, and whatever stops the run goes through stoppedReport
  const signals = watchSignals()
  const done = []
  const steps = [
    ...(branch ? [`create and switch to branch ${branch}`] : []),
    'set the @nextsparkjs versions in package.json',
    'pnpm install',
    'nextspark sync:app --force',
    `write ${VERSION_FILE}`,
  ]
  let current = 0
  const stopped = ({ reason = null, started = true, stop = null, leftRunning = false } = {}) => stoppedReport({
    run, cwd, err, target, rollback, reason, started, stop, leftRunning,
    signal: signals.signal,
    step: steps[current],
    done,
    notReached: steps.slice(current + 1),
  })
  // A signal that came in while a synchronous write ran is only delivered on the next turn of the event loop
  const signalled = async () => {
    await new Promise((resolve) => setImmediate(resolve))
    return signals.signal !== null
  }

  try {
    if (branch) {
      out(`\n   Creating branch ${branch}...`)
      const created = run('git', ['checkout', '-b', branch], { cwd, capture: true })
      if (created.status !== 0) {
        // git can have created the branch, or switched to it, before failing
        const exit = created.error ? created.error.message : `exited ${created.status}`
        return stopped({ reason: `git checkout -b ${exit}: ${(created.stderr || created.stdout).trim()}` })
      }
      done.push(`created and switched to branch ${branch}`)
      current++
      if (await signalled()) return stopped({ started: false })
    }

    out('\n[2/5] Setting the @nextsparkjs versions in package.json...')
    const bumped = []
    for (const { field, name, spec } of packages) {
      if (spec !== target) {
        manifest[field][name] = target
        bumped.push(`${name} ${spec} -> ${target}`)
      }
    }
    if (bumped.length > 0) {
      fs.writeFileSync(path.join(cwd, 'package.json'), manifestText(manifest, project.manifestText))
      for (const line of bumped) out(`   ${line}`)
      done.push(`package.json: ${bumped.join(', ')}`)
    } else {
      out(`   Already set to ${target}`)
    }
    current++
    if (await signalled()) return stopped({ started: false })

    out('\n[3/5] Installing...')
    const migrationsBefore = new Set(coreMigrations(cwd))
    const install = await runStep('pnpm', ['install'], { cwd: root, signals })
    if (signals.signal) return stopped({ stop: install.stop, leftRunning: install.leftRunning })
    if (install.status !== 0) return stopped({ reason: describeExit(install), stop: install.stop, leftRunning: install.leftRunning })
    if (install.leftRunning) return stopped({ reason: 'it exited 0, but processes it started were still running after being killed', stop: install.stop, leftRunning: true })
    if (install.stop) out(`   Processes pnpm install started were still running after it exited, and were ${install.stop === 'killed' ? 'killed' : 'stopped with SIGTERM'}.`)
    const offTarget = packages
      .map(({ name }) => ({ name, version: installedVersion(cwd, name) }))
      .filter(({ version }) => version !== target)
    if (offTarget.length > 0) {
      return stopped({ reason: `it exited 0, but node_modules holds ${offTarget.map(({ name, version }) => `${name} ${version ?? '(missing)'}`).join(', ')} instead of ${target}` })
    }
    done.push(`pnpm install: every @nextsparkjs package installed at ${target}`)
    current++

    out('\n[4/5] Syncing app/ with core and rebuilding the registries...')
    const cli = installedCli(cwd)
    if (!cli) return stopped({ reason: `node_modules has no nextspark CLI from ${CLI_PACKAGE}` })
    fs.rmSync(path.join(cwd, '.next'), { recursive: true, force: true })
    done.push('.next removed')
    if (await signalled()) return stopped({ started: false })
    const sync = await runStep(process.execPath, [cli, 'sync:app', '--force'], { cwd, signals })
    if (signals.signal) return stopped({ stop: sync.stop, leftRunning: sync.leftRunning })
    if (sync.status !== 0) return stopped({ reason: `${describeExit(sync)}; what it reported is above`, stop: sync.stop, leftRunning: sync.leftRunning })
    if (sync.leftRunning) return stopped({ reason: 'it exited 0, but processes it started were still running after being killed', stop: sync.stop, leftRunning: true })
    if (sync.stop) out(`   Processes nextspark sync:app started were still running after it exited, and were ${sync.stop === 'killed' ? 'killed' : 'stopped with SIGTERM'}.`)
    done.push('app/ synced with core and registries rebuilt by nextspark sync:app')
    current++

    if (await signalled()) return stopped({ started: false })

    out('\n[5/5] Recording the version...')
    const record = { version: target, previousVersion: installed, updatedAt: now().toISOString() }
    fs.writeFileSync(path.join(cwd, VERSION_FILE), `${JSON.stringify(record, null, 2)}\n`)
    out(`   ${VERSION_FILE}: ${installed} -> ${target}`)

    const newMigrations = coreMigrations(cwd).filter((file) => !migrationsBefore.has(file))

    banner(out, 'Update Complete')
    out(`\n  ${CORE_PACKAGE} ${installed} -> ${target}`)
    if (branch) out(`  Branch: ${branch}`)
    if (newMigrations.length > 0) out(`  New core migrations: ${newMigrations.length}`)
    out('\n  Next steps:')
    const nextSteps = ['Review: git status && git diff', 'Test: pnpm build && pnpm dev']
    if (newMigrations.length > 0) nextSteps.push('Migrate: pnpm db:migrate')
    nextSteps.push(branch ? `Commit on ${branch} and merge it` : 'Commit the update')
    nextSteps.forEach((step, index) => out(`    ${index + 1}. ${step}`))
    out('')
    out(`  Roll back: ${rollback}`)
    out('')
    return 0
  } catch (error) {
    return stopped({ reason: error.message })
  } finally {
    signals.stop()
  }
}
