#!/usr/bin/env node
/**
 * mobile-verify.mjs - Type-check and test apps/mobile and the template it ships in
 *
 * A web-mobile project gets packages/mobile/templates with apps/mobile/app
 * copied into it (pack.sh syncs it before packing), running against
 * @nextsparkjs/mobile. apps/mobile/src is the development app's own copy and
 * does not ship, so a pass on apps/mobile alone says nothing about the
 * template. This script:
 *
 *   1. runs every node:test suite next to it, one step each: this script's
 *      own process-group teardown and entrypoint guard, and the check that
 *      sync:all-templates copies apps/dev/app and apps/mobile/app into the
 *      generated templates,
 *   2. compares apps/mobile/src against packages/mobile/templates/src file
 *      by file, so the copy cannot drift from the package silently,
 *   3. installs apps/mobile on its own (it is outside the pnpm workspace),
 *   4. type-checks apps/mobile,
 *   5. exports apps/mobile for Android, the only step that actually asks
 *      Metro to bundle @nextsparkjs/ui and @nextsparkjs/mobile the way the
 *      app or a device build would,
 *   6. assembles the template in a temp directory, checks its dependency
 *      declarations and type-checks it, side-effect imports included,
 *   7. runs the packages/mobile Jest suite (the client, the entity factory,
 *      the providers - what apps/mobile only re-exports),
 *   8. runs the apps/mobile Jest suite.
 *
 * Both type-checks compile packages/mobile and packages/ui from source, and
 * their imports resolve from the root install, so `pnpm install` has to run at
 * the repo root first.
 *
 * Usage:
 *   pnpm mobile:verify
 *
 * Exit codes:
 *   0: every step passed
 *   1: a step failed, the root install is missing, or a step's process was
 *      left running
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// import.meta.url names the symlink itself instead of its target under
// --preserve-symlinks-main, which would put the repo root next to the link.
const REPO_ROOT = join(dirname(realpathSync(fileURLToPath(import.meta.url))), '../..')
const MOBILE_APP_DIR = join(REPO_ROOT, 'apps/mobile')
const MOBILE_PACKAGE_DIR = join(REPO_ROOT, 'packages/mobile')
const UI_PACKAGE_DIR = join(REPO_ROOT, 'packages/ui')
const TEMPLATES_DIR = join(MOBILE_PACKAGE_DIR, 'templates')
const MOBILE_SRC_DIR = join(MOBILE_APP_DIR, 'src')
const TEMPLATE_SRC_DIR = join(TEMPLATES_DIR, 'src')

// Paths (relative to src/) where apps/mobile/src is allowed to keep its own
// copy instead of importing @nextsparkjs/mobile. Empty: apps/mobile/src
// ships identical to the template today.
const MOBILE_SRC_EXCEPTIONS = new Set([])

// What sync-mobile-templates.ts leaves out when it copies apps/mobile/app.
const SYNC_EXCLUDES = new Set(['.DS_Store', 'node_modules', '.expo', '.turbo'])
const SOURCE_FILE = /\.[cm]?[jt]sx?$/

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

async function step(label, run) {
  console.log(`${CYAN}→ ${label}${NC}`)
  const promise = run()
  activeStepPromise = promise
  let passed
  try {
    passed = await promise
  } finally {
    activeStepPromise = null
  }
  console.log(passed ? `${GREEN}✓ ${label} passed${NC}` : `${RED}✗ ${label} failed${NC}`)
  return passed
}

// jest-worker bounds its own child teardown to about a second (FORCE_EXIT_DELAY,
// SIGKILL_DELAY in jest-worker's BaseWorkerPool/ChildProcessWorker), so a "worker
// process has failed to exit gracefully" warning does not explain a step that
// never returns. A step's own subprocess (a stalled network call from `expo
// export`, an unresponsive Metro/Watchman crawl) can still hang the whole check
// forever, so every step is bounded here and reported as failed instead.
//
// `expo export` alone runs Watchman's initial crawl plus Metro's cold bundle,
// minutes on a clean clone against most other steps' few seconds, so it gets
// its own, longer budget instead of sharing the default with steps two orders
// of magnitude faster.
const STEP_TIMEOUT_MS = 5 * 60 * 1000
const EXPORT_STEP_TIMEOUT_MS = 15 * 60 * 1000

// How long exec() waits for a timed-out child's `exit` event after trying to
// kill it before it stops waiting and leaves the child running, and how long
// cancelActiveChildrenAndExit waits for the active step's own cleanup (a stuck
// `finally`) before exiting anyway.
const KILL_FALLBACK_MS = 10 * 1000
const CLEANUP_TIMEOUT_MS = 10 * 1000

// How long exec() keeps reading a child's output once it has exited, for
// whatever it wrote last, before closing the pipes on a process that still
// holds them; and how long reportLeftoverChildren gives processes just killed
// to disappear before it names them as left running.
const OUTPUT_DRAIN_MS = 2 * 1000
const LEFTOVER_GRACE_MS = 1000

/**
 * SIGKILL to the negative pid targets the whole process group `detached: true`
 * made this child the leader of, so descendants a hung Jest or Metro spawned
 * (workers, the Watchman crawl, a bound port) die with it instead of being
 * reparented to init and outliving the script.
 *
 * Windows has no such thing as a process group signal: `detached: true` there
 * only frees the child from the parent's console, and a negative pid is not a
 * valid target for kill(2). `taskkill /T` walks the same process tree instead.
 *
 * Returns whether the kill signal was actually delivered. taskkill can fail
 * to run at all (missing from PATH) or run and refuse (access denied on a
 * more-privileged process), and kill(2) can refuse too (EPERM) - in every
 * such case the child may never receive it and its `exit` event may never
 * come. macOS also answers EPERM for a group whose processes have all exited
 * but are not reaped yet, so a failed kill only means "not confirmed": what
 * happens to the child is left to its `exit` event.
 * Reporting that instead of throwing matters because callers run this from a
 * timer or a signal handler, where a throw would crash this script and leave
 * the very process group it failed to kill running unsupervised.
 */
function killProcessGroup(pid, { platform = process.platform, kill = process.kill, spawnTaskkill = spawnSync } = {}) {
  if (platform === 'win32') {
    const result = spawnTaskkill('taskkill', ['/pid', String(pid), '/T', '/F'])
    if (result.error) {
      console.log(`${RED}taskkill did not run for pid ${pid}: ${result.error.message}${NC}`)
      return false
    }
    if (result.status !== 0) {
      console.log(`${RED}taskkill exited ${result.status} for pid ${pid}: ${String(result.stderr ?? '').trim()}${NC}`)
      return false
    }
    return true
  }
  try {
    kill(-pid, 'SIGKILL')
  } catch (error) {
    // ESRCH: the group is already gone, which is what the kill was for.
    if (error.code === 'ESRCH') return true
    console.log(`${RED}Could not confirm process group ${pid} was killed: ${error.message}${NC}`)
    return false
  }
  return true
}

// Every child exec() spawned whose `exit` it has not seen, by pid, with the
// command it runs. A step's subprocess is the leader of its own detached
// process group (see exec below), which is a different group from this
// script's, so a signal sent to this script's pid never reaches it on its
// own: tracking it here is what lets the SIGTERM/SIGINT handlers reach it
// too, and what lets reportLeftoverChildren name one that outlives the run.
const runningChildren = new Map()

// Process groups a step's leader left processes in when it exited, by process
// group id, with the leader's command.
const strayGroups = new Map()

// EPERM is not counted: on macOS it is what a group holding only exited,
// unreaped processes answers, and a process in a step's own group that this
// script may not signal would have had to change its user id.
function groupHasProcesses(pgid) {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * A step's leader can exit while processes it started are still in its
 * process group - a server a test never closed, a worker nothing waited for -
 * and nothing else would ever stop or mention them. The group belongs to the
 * step, so they are killed with it. It stays tracked either way: a delivered
 * SIGKILL takes a moment to take effect, or none for a process stuck in
 * uninterruptible I/O, and reportLeftoverChildren only drops a group once it
 * is empty. Windows has no process group to find them by once their parent
 * is gone.
 */
function stopStragglers(pgid, commandLine, killGroup) {
  if (process.platform === 'win32' || !groupHasProcesses(pgid)) return
  console.log(`${RED}Process group ${pgid} (${commandLine}) still had processes after its leader exited; killing them${NC}`)
  strayGroups.set(pgid, commandLine)
  killGroup(pgid)
}

// The step currently in flight, so a signal handler can wait for its finally
// (see step below) before the process exits instead of racing it.
let activeStepPromise = null

function exec(command, args, cwd, {
  env,
  timeoutMs = STEP_TIMEOUT_MS,
  killFallbackMs = KILL_FALLBACK_MS,
  outputDrainMs = OUTPUT_DRAIN_MS,
  killProcessGroup: killGroup = killProcessGroup,
} = {}) {
  return new Promise((resolve) => {
    // stdout and stderr go through pipes this script reads instead of being
    // inherited: a child left running would otherwise hold a copy of this
    // script's own output, and whatever reads it to the end (a CI step,
    // `| cat`) would keep waiting for as long as that child lives.
    const child = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
      detached: true,
    })
    child.stdout.pipe(process.stdout, { end: false })
    child.stderr.pipe(process.stderr, { end: false })
    const commandLine = [command, ...args].join(' ')
    runningChildren.set(child.pid, commandLine)

    // With its pipes closed and its handle unref'd, nothing of the child ties
    // this script's event loop to it any longer.
    const release = () => {
      child.stdout.destroy()
      child.stderr.destroy()
      child.unref()
    }

    let timedOut = false
    let settled = false
    let giveUpTimer
    let drainTimer
    const settle = (value, message) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(giveUpTimer)
      clearTimeout(drainTimer)
      if (message) console.log(`${RED}${message}${NC}`)
      resolve(value)
    }

    const timer = setTimeout(() => {
      timedOut = true
      console.log(`${RED}Timed out after ${timeoutMs / 1000}s: ${commandLine}${NC}`)
      const delivered = killGroup(child.pid)
      // An undelivered kill never makes `exit` arrive, and a delivered one
      // does not either while the process is stuck in uninterruptible I/O.
      giveUpTimer = setTimeout(() => {
        release()
        const reason = delivered
          ? `still running ${killFallbackMs / 1000}s after its process group was killed`
          : 'its kill signal was never confirmed delivered'
        settle(false, `Gave up waiting for pid ${child.pid} (${commandLine}): ${reason}; left running`)
      }, killFallbackMs)
    }, timeoutMs)

    child.on('error', (error) => {
      runningChildren.delete(child.pid)
      settle(false, error.message)
    })

    child.on('exit', (code, signal) => {
      runningChildren.delete(child.pid)
      stopStragglers(child.pid, commandLine, killGroup)
      if (settled) return
      const how = signal ? `Killed with ${signal}` : `Exited with code ${code}`
      // A step that ran past its limit failed, however its process ends.
      const [value, message] = timedOut
        ? [false, `${how} after the time limit`]
        : [code === 0, signal ? how : undefined]
      // The verdict waits for the pipes to close so it prints after the
      // child's last output. A process that still holds them past
      // outputDrainMs (a straggler its kill has not stopped) loses them.
      child.once('close', () => settle(value, message))
      drainTimer = setTimeout(() => {
        child.stdout.destroy()
        child.stderr.destroy()
        settle(value, message)
      }, outputDrainMs)
    })
  })
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * Names every child exec() spawned that is still running, and every stray
 * process group that still has processes, so a run that ends or is cancelled
 * without having seen them go says what it left behind instead of looking
 * like it cleaned up. Returns how many there are.
 */
async function reportLeftoverChildren() {
  const anyLeft = () =>
    [...runningChildren.keys()].some(isProcessRunning) || [...strayGroups.keys()].some(groupHasProcesses)
  for (const deadline = Date.now() + LEFTOVER_GRACE_MS; anyLeft() && Date.now() < deadline;) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  let count = 0
  for (const [pid, commandLine] of runningChildren) {
    if (!isProcessRunning(pid)) continue
    count++
    console.log(`${RED}Left running: pid ${pid} (${commandLine})${NC}`)
  }
  for (const [pgid, commandLine] of strayGroups) {
    if (!groupHasProcesses(pgid)) {
      strayGroups.delete(pgid)
      continue
    }
    count++
    console.log(`${RED}Left running: process group ${pgid} (${commandLine})${NC}`)
  }
  return count
}

/**
 * Node's default handling for both SIGTERM and SIGINT is to exit without
 * touching children, which would leave a step's process group (Jest, Metro,
 * expo export) reparented to init and free to keep running - and, for Jest,
 * keep holding its port - after the supervisor that was watching it is gone.
 *
 * Killing the children only asks their `exec` promise to settle; the active
 * step's own finally (exportAndroid's dist cleanup) still runs after that, on
 * a later microtask, so exiting has to wait for the step promise too - a bare
 * process.exit() right after the kill would cut that finally off mid-run.
 *
 * That wait is itself bounded: a stuck finally (a filesystem call that never
 * returns) would otherwise leave the supervisor process, and whatever it did
 * not get to remove, running forever past the signal that was meant to stop it.
 * Whatever it could not kill is named before it exits.
 */
async function cancelActiveChildrenAndExit(exitCode, {
  exit = process.exit,
  cleanupTimeoutMs = CLEANUP_TIMEOUT_MS,
  killProcessGroup: killGroup = killProcessGroup,
} = {}) {
  for (const pid of runningChildren.keys()) killGroup(pid)
  for (const pgid of strayGroups.keys()) {
    if (groupHasProcesses(pgid)) killGroup(pgid)
  }
  if (activeStepPromise) {
    let cleanupTimer
    // Cleared on whichever branch settles first: left running, the losing
    // side's timer would keep the process alive for cleanupTimeoutMs even
    // after a fast cleanup already resolved the race.
    const cleanedUp = await Promise.race([
      activeStepPromise.then(() => true, () => true),
      new Promise((resolve) => { cleanupTimer = setTimeout(() => resolve(false), cleanupTimeoutMs) }),
    ])
    clearTimeout(cleanupTimer)
    if (!cleanedUp) {
      console.log(`${RED}Gave up waiting for the active step's cleanup after ${cleanupTimeoutMs / 1000}s; it may not have finished${NC}`)
    }
  }
  await reportLeftoverChildren()
  exit(exitCode)
}
process.on('SIGTERM', () => cancelActiveChildrenAndExit(143))
process.on('SIGINT', () => cancelActiveChildrenAndExit(130))

/**
 * Bundling is the only step that runs Metro's resolveRequest, which decides
 * whether @nextsparkjs/ui resolves to its sources or to a `packages/ui/dist`
 * build nothing produces: type-checking alone resolves imports through
 * tsconfig paths and never notices.
 */
async function exportAndroid() {
  const exportDir = join(MOBILE_APP_DIR, 'dist')
  rmSync(exportDir, { recursive: true, force: true })
  try {
    return await exec('pnpm', ['exec', 'expo', 'export', '--platform', 'android'], MOBILE_APP_DIR, {
      env: { CI: '1' },
      timeoutMs: EXPORT_STEP_TIMEOUT_MS,
    })
  } finally {
    rmSync(exportDir, { recursive: true, force: true })
  }
}

/**
 * Whether a package is installed where a resolver starting at `fromDir` finds
 * it. Walks up node_modules instead of require.resolve('<name>/package.json'),
 * which fails for packages whose exports map hides package.json.
 */
function isInstalled(fromDir, name) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return true
    if (dir === REPO_ROOT || dirname(dir) === dir) return false
  }
}

function missingRootDependencies() {
  const missing = []
  // packages/ui's native entry, which both type-checks compile, imports
  // react-native even though the package declares it as an optional peer.
  const packages = [
    [MOBILE_PACKAGE_DIR, []],
    [UI_PACKAGE_DIR, ['react-native']],
  ]
  for (const [packageDir, alsoRequired] of packages) {
    const { peerDependencies = {}, peerDependenciesMeta = {} } = readJson(join(packageDir, 'package.json'))
    const required = Object.keys(peerDependencies).filter((name) => !peerDependenciesMeta[name]?.optional)
    for (const name of new Set([...required, ...alsoRequired])) {
      if (!isInstalled(packageDir, name)) missing.push(`${relative(REPO_ROOT, packageDir)} cannot find ${name}`)
    }
  }
  return missing
}

function listFiles(dir, include) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(path, include))
    else if (include(entry.name)) files.push(path)
  }
  return files
}

/**
 * Lay out what `nextspark` copies into a web-mobile project: the templates,
 * with apps/mobile/app as app/ and package.json.template as package.json.
 */
function assembleTemplate(dir, ts) {
  for (const entry of readdirSync(TEMPLATES_DIR)) {
    // templates/app is a gitignored copy left by a previous pack; the screens
    // that will ship come from apps/mobile/app.
    if (entry === 'app' || entry === 'package.json.template' || SYNC_EXCLUDES.has(entry)) continue
    cpSync(join(TEMPLATES_DIR, entry), join(dir, entry), { recursive: true })
  }
  cpSync(join(MOBILE_APP_DIR, 'app'), join(dir, 'app'), {
    recursive: true,
    filter: (source) => !relative(MOBILE_APP_DIR, source).split(sep).some((part) => SYNC_EXCLUDES.has(part)),
  })
  copyFileSync(join(TEMPLATES_DIR, 'package.json.template'), join(dir, 'package.json'))

  // The template's third-party dependencies are checked to be a subset of
  // apps/mobile's (see templateDependencyProblems), so its install stands in.
  symlinkSync(join(MOBILE_APP_DIR, 'node_modules'), join(dir, 'node_modules'), 'dir')

  // TypeScript only resolves side-effect imports (`import '@/src/x'`) with
  // noUncheckedSideEffectImports, which Metro would fail to bundle when they
  // do not resolve. Stylesheets are imported that way and have no types, so
  // each one gets an empty `.d.css.ts` next to it (read through
  // allowArbitraryExtensions): an existing stylesheet resolves, a missing one
  // fails like any other import.
  for (const stylesheet of listFiles(dir, (name) => name.endsWith('.css'))) {
    writeFileSync(stylesheet.replace(/\.css$/, '.d.css.ts'), 'export {}\n')
  }

  // @nextsparkjs/* compile from the sources this template is published with.
  // `paths` replaces the template's own mapping, so that one is carried over.
  const templatePaths = ts.readConfigFile(join(dir, 'tsconfig.json'), ts.sys.readFile).config?.compilerOptions?.paths
  const verifyConfig = {
    extends: './tsconfig.json',
    compilerOptions: {
      noUncheckedSideEffectImports: true,
      allowArbitraryExtensions: true,
      paths: {
        ...templatePaths,
        '@nextsparkjs/mobile': [join(MOBILE_PACKAGE_DIR, 'src/index.ts')],
        '@nextsparkjs/ui': [join(UI_PACKAGE_DIR, 'src/index.native.ts')],
      },
    },
  }
  writeFileSync(join(dir, 'tsconfig.verify.json'), JSON.stringify(verifyConfig, null, 2))
}

/**
 * The template has to declare every package its files import, and apps/mobile
 * has to install every package the template declares, or the type-check
 * against apps/mobile's install would pass for a project that cannot build.
 */
function templateDependencyProblems(dir, ts) {
  const template = readJson(join(dir, 'package.json'))
  const app = readJson(join(MOBILE_APP_DIR, 'package.json'))
  const declared = new Set([...Object.keys(template.dependencies ?? {}), ...Object.keys(template.devDependencies ?? {})])
  const installed = new Set([...Object.keys(app.dependencies ?? {}), ...Object.keys(app.devDependencies ?? {})])
  const builtins = new Set(builtinModules)
  const problems = []

  for (const name of declared) {
    if (!name.startsWith('@nextsparkjs/') && !installed.has(name)) {
      problems.push(`package.json.template declares ${name}, which apps/mobile/package.json does not`)
    }
  }

  for (const file of listFiles(dir, (name) => SOURCE_FILE.test(name))) {
    const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
    for (const { fileName } of importedFiles) {
      if (fileName.startsWith('.') || fileName.startsWith('@/') || fileName.startsWith('node:')) continue
      if (builtins.has(fileName)) continue
      const segments = fileName.split('/')
      const name = fileName.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
      if (!declared.has(name)) {
        problems.push(`${relative(dir, file)} imports ${name}, which package.json.template does not declare`)
      }
    }
  }
  return problems
}

/** Which of these absolute paths git ignores (untracked build output, .DS_Store, ...). */
function gitIgnoredPaths(absolutePaths) {
  if (absolutePaths.length === 0) return new Set()
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd: REPO_ROOT,
    input: absolutePaths.join('\n'),
    encoding: 'utf8',
  })
  return new Set(result.stdout.split('\n').filter(Boolean))
}

function relativeFiles(dir) {
  const absolutePaths = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else absolutePaths.push(path)
    }
  }
  walk(dir)
  const ignored = gitIgnoredPaths(absolutePaths)
  const files = new Set()
  for (const path of absolutePaths) {
    if (!ignored.has(path)) files.add(relative(dir, path))
  }
  return files
}

/**
 * apps/mobile/src is the development app's own copy of what
 * @nextsparkjs/mobile ships (see the file header). Comparing both trees file
 * by file keeps that copy from drifting from the package silently.
 */
function verifyMobileSrcMatchesTemplate() {
  const appFiles = relativeFiles(MOBILE_SRC_DIR)
  const templateFiles = relativeFiles(TEMPLATE_SRC_DIR)
  const problems = []

  for (const file of new Set([...appFiles, ...templateFiles])) {
    if (MOBILE_SRC_EXCEPTIONS.has(file)) continue
    const inApp = appFiles.has(file)
    const inTemplate = templateFiles.has(file)
    if (inApp && !inTemplate) {
      problems.push(`apps/mobile/src/${file} has no counterpart in packages/mobile/templates/src`)
    } else if (!inApp && inTemplate) {
      problems.push(`packages/mobile/templates/src/${file} has no counterpart in apps/mobile/src`)
    } else if (readFileSync(join(MOBILE_SRC_DIR, file), 'utf8') !== readFileSync(join(TEMPLATE_SRC_DIR, file), 'utf8')) {
      problems.push(`apps/mobile/src/${file} differs from packages/mobile/templates/src/${file}`)
    }
  }
  for (const problem of problems) console.log(`  ${RED}${problem}${NC}`)
  return problems.length === 0
}

async function verifyTemplate() {
  const ts = createRequire(join(MOBILE_APP_DIR, 'package.json'))('typescript')
  const dir = mkdtempSync(join(tmpdir(), 'nextspark-mobile-template-'))
  try {
    assembleTemplate(dir, ts)
    const problems = templateDependencyProblems(dir, ts)
    for (const problem of problems) console.log(`  ${RED}${problem}${NC}`)
    if (problems.length > 0) return false
    const tsc = join(MOBILE_APP_DIR, 'node_modules/typescript/bin/tsc')
    return await exec(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.verify.json'], dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main() {
  console.log()
  console.log(`${CYAN}========================================${NC}`)
  console.log(`${CYAN}  NextSpark - Mobile Verify${NC}`)
  console.log(`${CYAN}========================================${NC}`)
  console.log()

  const missing = missingRootDependencies()
  if (missing.length > 0) {
    console.log(`${RED}✗ The root dependencies are not installed:${NC}`)
    for (const item of missing) console.log(`    ${item}`)
    console.log('  apps/mobile and its template compile packages/mobile and packages/ui from')
    console.log('  source, which resolve their imports from the root install. At the repo root, run:')
    console.log('    pnpm install --frozen-lockfile')
    return false
  }

  // mobile-verify-guard.test.mjs runs copies of this script, which is safe as
  // a step of it: the copies run from a throwaway root whose suites are
  // stand-ins, so none of them reaches a step that runs that file again.
  const nodeTest = (suite) => () =>
    exec(process.execPath, ['--test', join(REPO_ROOT, 'scripts/packages', suite)], REPO_ROOT)
  const steps = [
    ['This script\'s process-group teardown (node:test)', nodeTest('mobile-verify.test.mjs')],
    ['This script\'s entrypoint guard (node:test)', nodeTest('mobile-verify-guard.test.mjs')],
    ['sync:all-templates fills both generated template directories (node:test)', nodeTest('sync-all-templates.test.mjs')],
    ['apps/mobile/src matches packages/mobile/templates/src', verifyMobileSrcMatchesTemplate],
    ['Install apps/mobile (isolated, frozen lockfile)', () =>
      exec('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile'], MOBILE_APP_DIR)],
    ['Typecheck apps/mobile', () => exec('pnpm', ['run', 'typecheck'], MOBILE_APP_DIR)],
    ['Export apps/mobile for Android', exportAndroid],
    ['Typecheck the shipped template (packages/mobile/templates + apps/mobile/app)', verifyTemplate],
    ['Test @nextsparkjs/mobile (jest)', () => exec('pnpm', ['run', 'test'], MOBILE_PACKAGE_DIR)],
    ['Test apps/mobile (jest)', () => exec('pnpm', ['run', 'test'], MOBILE_APP_DIR)],
  ]
  for (const [label, run] of steps) {
    if (!(await step(label, run))) return false
  }

  console.log()
  console.log(`${GREEN}✓ apps/mobile and the mobile template verified${NC}`)
  return true
}

/**
 * Whether this module was invoked directly (`node mobile-verify.mjs`, through
 * a symlink or a wrapper included), as opposed to only imported by its tests.
 * import.meta.url and process.argv[1] name the same file in different forms:
 * a percent-encoded file: URL with forward slashes against a plain OS path,
 * and, through a symlink, node's resolved target against the link as typed -
 * or the link on both sides under --preserve-symlinks-main. Turning the URL
 * back into a path and resolving both through realpath compares the file
 * itself, whichever form each side arrived in.
 */
function isMainModule(moduleUrl, argv1, { windows = process.platform === 'win32' } = {}) {
  if (!argv1) return false
  const resolveFile = (path) => {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
  return resolveFile(fileURLToPath(moduleUrl, { windows })) === resolveFile(argv1)
}

export { exec, step, killProcessGroup, cancelActiveChildrenAndExit, isMainModule }

// Guards the run below so the tests can import the functions above without
// kicking off the whole verify pipeline as a side effect.
if (isMainModule(import.meta.url, process.argv[1])) {
  const ok = await main()
  const leftovers = await reportLeftoverChildren()
  process.exitCode = ok && leftovers === 0 ? 0 : 1
}
