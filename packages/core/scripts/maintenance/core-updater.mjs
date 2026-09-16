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
 * write, so a run that can't start says why and leaves the project as it was. A
 * run that fails later, in the install or the sync, says what it had changed,
 * and running it again picks up from there.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SCOPE = '@nextsparkjs/'
const CORE_PACKAGE = '@nextsparkjs/core'
const CLI_PACKAGE = '@nextsparkjs/cli'
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies']
const VERSION_FILE = 'core.version.json'
const LOCKFILE = 'pnpm-lock.yaml'
const WORKSPACE_FILE = 'pnpm-workspace.yaml'
const LIST_LIMIT = 20
/** What an update writes besides the lockfile and pnpm-workspace.yaml: package.json, and what nextspark sync:app writes */
const PROJECT_FILES_WRITTEN = ['package.json', '.gitignore', 'next.config.mjs', 'tsconfig.json', 'i18n.ts', 'proxy.ts', 'middleware.ts']
const PROJECT_DIRS_WRITTEN = ['app', '.nextspark']
const CHANGED_SHOWN = 20

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
const RANGE_PREFIX = /^[\^~]/

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
  package.json            Only the versions of the @nextsparkjs packages, all set to the target
  pnpm-lock.yaml, node_modules   Through pnpm install
  app/                    Synced with core's templates by nextspark sync:app, which keeps
                          files the project customized and rebuilds the registries
  next.config.mjs, tsconfig.json, i18n.ts, proxy.ts or middleware.ts
                          Also synced by sync:app, which keeps them when customized
  core.version.json       Written once everything above succeeded

What is never touched:
  The rest of package.json (name, scripts, other dependencies)
  contents/               The project's themes and plugins
  .env*                   Environment files

The update stops before changing anything when the project has uncommitted
changes, when a @nextsparkjs package isn't published at the target version, when
the target is older than the installed version, when package.json takes a
@nextsparkjs package from somewhere other than the registry, or when .env doesn't
set NEXT_PUBLIC_ACTIVE_THEME, which the registry build needs.

A run that failed partway can be run again as it is: uncommitted changes are
accepted when every @nextsparkjs package is already set to the target and they
are all in files an update writes.
`

/** Runs a command, printing its output as it goes unless `capture` asks for it back. */
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

/** The spec that pins `target` the way `spec` pinned its version: exact, or with its ^ or ~. */
function specFor(spec, target) {
  return `${spec.match(RANGE_PREFIX)?.[0] ?? ''}${target}`
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

  const installed = readJson(path.join(cwd, 'node_modules', CORE_PACKAGE, 'package.json'))?.version ?? null
  return { manifestText, manifest, packages, installed }
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

/** The absolute paths of the uncommitted changes (an untracked directory ends in a separator), or null when git can't say. */
function uncommittedPaths(run, cwd) {
  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd, capture: true })
  const status = run('git', ['status', '--porcelain=v1', '-z', '--no-renames'], { cwd, capture: true })
  if (top.status !== 0 || status.status !== 0) return null
  const root = realPath(top.stdout.trim())
  return status.stdout.split('\0').filter(Boolean).map((entry) => {
    const file = entry.slice(3)
    return path.join(root, file) + (file.endsWith('/') ? path.sep : '')
  })
}

function gitState(run, cwd) {
  const inside = run('git', ['rev-parse', '--is-inside-work-tree'], { cwd, capture: true })
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') return { repo: false }

  const head = run('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd, capture: true })
  const changed = uncommittedPaths(run, cwd)
  const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd, capture: true })
  return {
    repo: true,
    head: head.status === 0 ? head.stdout.trim() : null,
    changed,
    dirty: changed === null || changed.length > 0,
    branch: branch.status === 0 ? branch.stdout.trim() : null,
  }
}

/**
 * Whether the uncommitted changes are what an unfinished update to `target`
 * leaves: every @nextsparkjs package already set to it, and nothing changed
 * outside what an update writes. The commit the run started from is still HEAD,
 * so resetting to it rolls back the whole update.
 */
function unfinishedUpdate(git, { cwd, installRoot, packages, target }) {
  if (!git.repo || !git.changed || git.changed.length === 0) return false
  if (!packages.every(({ spec }) => spec.replace(RANGE_PREFIX, '') === target)) return false
  const project = realPath(cwd)
  const files = new Set([
    ...PROJECT_FILES_WRITTEN.map((file) => path.join(project, file)),
    ...[LOCKFILE, WORKSPACE_FILE].map((file) => path.join(realPath(installRoot), file)),
  ])
  const dirs = PROJECT_DIRS_WRITTEN.map((dir) => path.join(project, dir) + path.sep)
  return git.changed.every((file) => files.has(file) || dirs.some((dir) => file.startsWith(dir)))
}

/** The @nextsparkjs/core version package.json pins at HEAD, or null. */
function committedCoreVersion(run, cwd) {
  const shown = run('git', ['show', 'HEAD:./package.json'], { cwd, capture: true })
  if (shown.status !== 0) return null
  try {
    const manifest = JSON.parse(shown.stdout)
    const spec = DEPENDENCY_FIELDS.map((field) => manifest[field]?.[CORE_PACKAGE]).find(Boolean)
    const version = spec?.replace(RANGE_PREFIX, '')
    return isVersion(version) ? version : null
  } catch {
    return null
  }
}

function branchName(version) {
  return `update/${version.replace(/[.+]/g, '-')}`
}

function branchExists(run, cwd, name) {
  return run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { cwd, capture: true }).status === 0
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
 * The directory pnpm install writes the lockfile and pnpm-workspace.yaml in: the
 * nearest one up from `cwd` with a pnpm-workspace.yaml, which for a web-mobile
 * project is the directory above web/.
 */
function workspaceRoot(cwd) {
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, WORKSPACE_FILE))) return dir
    if (path.dirname(dir) === dir) return cwd
  }
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
 * The rollback a run can promise: back to the commit it started from, dropping
 * the files it created (the tree was clean, so every untracked file is one of
 * them) and reinstalling what that commit pins.
 */
function rollbackLines(git, branch) {
  if (!git.repo || !git.head) {
    return ['  Roll back: put back the package.json and pnpm-lock.yaml you had, then run pnpm install.']
  }
  const lines = [`  Roll back: git reset --hard ${git.head.slice(0, 12)} && git clean -fd && pnpm install`]
  if (branch && git.branch) {
    lines.push(`             then git checkout ${git.branch} && git branch -D ${branch}`)
  }
  return lines
}

/**
 * Runs `update-core` with `args` against the project in `cwd` and returns the
 * exit code. `run` executes commands and `out`/`err` print, so a test can hand
 * in its own.
 */
export function updateCore(args, { cwd = process.cwd(), env = process.env, run = runCommand, out = console.log, err = console.error, now = () => new Date() } = {}) {
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

  if (!hasActiveTheme(cwd, env)) {
    err('   NEXT_PUBLIC_ACTIVE_THEME is not set in .env, and sync:app skips the registry build without it, so app/(templates) would stay on the old core. Set it and run update-core again. Nothing was changed.')
    return 1
  }
  out(`   Installed: ${CORE_PACKAGE} ${installed}`)

  const git = gitState(run, cwd)
  if (!git.repo) {
    out('   Warning: not a git repository, so there is no commit to roll back to')
  }
  if (flags.branch && !git.repo) {
    err('   --branch needs a git repository. Nothing was changed.')
    return 1
  }

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

  const previousRecord = readJson(path.join(cwd, VERSION_FILE))
  const specsAtTarget = packages.every(({ spec }) => spec.replace(RANGE_PREFIX, '') === target)
  if (installed === target && specsAtTarget && previousRecord?.version === target) {
    out(`\n   Already on ${target}. Nothing to do.\n`)
    return 0
  }

  const installRoot = workspaceRoot(cwd)
  const resuming = git.repo && git.dirty && unfinishedUpdate(git, { cwd, installRoot, packages, target })
  if (git.repo && git.dirty && !resuming) {
    err('   Uncommitted changes. Commit or stash them first, so the update can be reviewed and rolled back on its own. Nothing was changed.')
    return 1
  }
  // A resumed update started from the version HEAD pins, which node_modules may no longer hold
  const from = resuming ? committedCoreVersion(run, cwd) ?? installed : installed
  if (resuming) {
    out(`   Resuming the update from ${from}: the uncommitted changes are the ones an unfinished update to ${target} leaves`)
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

  // From here on the project changes; `changed` is what a failure reports as done
  const changed = []
  const halfDone = ({ step, notDone }) => {
    banner(err, `Update to ${target} did not finish`)
    err(`\n  Failed: ${step}`)
    if (changed.length > 0) {
      err('\n  Already changed:')
      for (const line of changed) err(`    - ${line}`)
    }
    err('\n  Not done:')
    for (const line of notDone) err(`    - ${line}`)
    err(`    - ${VERSION_FILE} still says ${previousRecord?.version ?? 'nothing (not written)'}`)
    const uncommitted = git.repo ? uncommittedPaths(run, cwd) : null
    if (uncommitted?.length > 0) {
      const project = realPath(cwd)
      err('\n  Uncommitted now (git status):')
      for (const file of uncommitted.slice(0, CHANGED_SHOWN)) err(`    ${path.relative(project, file) || '.'}${file.endsWith(path.sep) ? '/' : ''}`)
      if (uncommitted.length > CHANGED_SHOWN) err(`    ... and ${uncommitted.length - CHANGED_SHOWN} more`)
    }
    const picksUp = uncommitted?.length > 0 ? ', leaving these changes uncommitted: it picks up from them' : ''
    err(`\n  To finish: fix what failed above and run pnpm update-core --version ${target} again${picksUp}.`)
    for (const line of rollbackLines(git, branch)) err(line)
    err('')
    return 1
  }

  if (branch) {
    out(`\n   Creating branch ${branch}...`)
    const created = run('git', ['checkout', '-b', branch], { cwd, capture: true })
    if (created.status !== 0) {
      err(`   Could not create branch ${branch}:\n${(created.stderr || created.stdout).trim()}\n   Nothing was changed.`)
      return 1
    }
    changed.push(`created and switched to branch ${branch}`)
  }

  out('\n[2/5] Setting the @nextsparkjs versions in package.json...')
  const manifestPath = path.join(cwd, 'package.json')
  // pnpm install rewrites these besides node_modules; a failed install puts them back
  const installWrites = [LOCKFILE, WORKSPACE_FILE].map((name) => {
    const file = path.join(installRoot, name)
    return { file, shown: path.relative(cwd, file), content: readOptional(file) }
  })
  const bumped = []
  for (const { field, name, spec } of packages) {
    const next = specFor(spec, target)
    if (next !== spec) {
      manifest[field][name] = next
      bumped.push(`${name} ${spec} -> ${next}`)
    }
  }
  if (bumped.length > 0) {
    fs.writeFileSync(manifestPath, manifestText(manifest, project.manifestText))
    for (const line of bumped) out(`   ${line}`)
    changed.push(`package.json: ${bumped.join(', ')}`)
  } else {
    out(`   Already set to ${target}`)
  }

  out('\n[3/5] Installing...')
  const migrationsBefore = new Set(coreMigrations(cwd))
  const [lockfile, workspaceFile] = installWrites
  const install = run('pnpm', ['install'], { cwd })
  if (install.status !== 0) {
    // Nothing but these files depends on the new pins yet, so they go back
    const putBack = ['package.json', lockfile.shown, workspaceFile.shown].join(', ')
    try {
      fs.writeFileSync(manifestPath, project.manifestText)
      for (const { file, content } of installWrites) {
        if (content !== null) fs.writeFileSync(file, content)
        else fs.rmSync(file, { force: true })
      }
      changed.splice(branch ? 1 : 0)
      changed.push(`${putBack} put back as they were; node_modules may hold part of the install, so run pnpm install`)
    } catch (error) {
      changed.push(`putting back ${putBack} failed too (${error.message})`)
    }
    return halfDone({
      step: `pnpm install (${install.error ? install.error.message : `exit ${install.status}`})`,
      notDone: ['install of the new versions', 'app/ sync and registry build'],
    })
  }

  const workspaceAfter = readOptional(workspaceFile.file)
  if (workspaceFile.content === null || workspaceAfter === null ? workspaceFile.content !== workspaceAfter : !workspaceFile.content.equals(workspaceAfter)) {
    changed.push(`${workspaceFile.shown}: changed by pnpm install`)
  }

  const nowInstalled = readJson(path.join(cwd, 'node_modules', CORE_PACKAGE, 'package.json'))?.version ?? null
  if (nowInstalled !== target) {
    changed.push(`${lockfile.shown} and node_modules updated by pnpm install`)
    return halfDone({
      step: `pnpm install left ${CORE_PACKAGE} at ${nowInstalled ?? 'nothing'} instead of ${target}`,
      notDone: ['app/ sync and registry build'],
    })
  }
  changed.push(`${lockfile.shown} and node_modules: ${CORE_PACKAGE} ${installed} -> ${target}`)

  out('\n[4/5] Syncing app/ with core and rebuilding the registries...')
  const cli = installedCli(cwd)
  if (!cli) {
    return halfDone({
      step: `node_modules has no nextspark CLI from ${CLI_PACKAGE} after the install`,
      notDone: ['app/ sync and registry build'],
    })
  }
  fs.rmSync(path.join(cwd, '.next'), { recursive: true, force: true })
  const sync = run(process.execPath, [cli, 'sync:app', '--force'], { cwd })
  if (sync.status !== 0) {
    changed.push('.next cache cleared')
    return halfDone({
      step: `nextspark sync:app (${sync.error ? sync.error.message : `exit ${sync.status}`}); what it reported is above`,
      notDone: ['app/ sync with core and registry build, or at least one of them (sync:app says which)'],
    })
  }

  out('\n[5/5] Recording the version...')
  const record = { version: target, previousVersion: from, updatedAt: now().toISOString() }
  fs.writeFileSync(path.join(cwd, VERSION_FILE), `${JSON.stringify(record, null, 2)}\n`)
  out(`   ${VERSION_FILE}: ${from} -> ${target}`)

  // node_modules held the target's migrations before a resumed run started, so it can't tell which are new
  const newMigrations = resuming ? null : coreMigrations(cwd).filter((file) => !migrationsBefore.has(file))

  banner(out, 'Update Complete')
  out(`\n  ${CORE_PACKAGE} ${from} -> ${target}`)
  if (branch) out(`  Branch: ${branch}`)
  if (newMigrations?.length > 0) out(`  New core migrations: ${newMigrations.length}`)
  out('\n  Next steps:')
  const steps = ['Review: git status && git diff', 'Test: pnpm build && pnpm dev']
  if (newMigrations === null) steps.push('Migrate: pnpm db:migrate, which applies whatever core migrations the database lacks')
  else if (newMigrations.length > 0) steps.push('Migrate: pnpm db:migrate')
  steps.push(branch ? `Commit on ${branch} and merge it` : 'Commit the update')
  steps.forEach((step, index) => out(`    ${index + 1}. ${step}`))
  out('')
  for (const line of rollbackLines(git, branch)) out(line)
  out('')
  return 0
}
