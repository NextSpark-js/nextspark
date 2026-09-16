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
 *   1. compares apps/mobile/src against packages/mobile/templates/src file
 *      by file, so the copy cannot drift from the package silently again,
 *   2. installs apps/mobile on its own (it is outside the pnpm workspace),
 *   3. type-checks apps/mobile,
 *   4. exports apps/mobile for Android, the only step that actually asks
 *      Metro to bundle @nextsparkjs/ui and @nextsparkjs/mobile the way the
 *      app or a device build would,
 *   5. assembles the template in a temp directory, checks its dependency
 *      declarations and type-checks it, side-effect imports included,
 *   6. runs the packages/mobile Jest suite (the client, the entity factory,
 *      the providers - what apps/mobile only re-exports),
 *   7. runs the apps/mobile Jest suite.
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
 *   1: a step failed, or the root install is missing
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
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
// which measured ~233s (169.7s + 63.7s) on a clean clone against every other
// step's few seconds, so it gets its own, longer budget instead of sharing the
// default with steps two orders of magnitude faster.
const STEP_TIMEOUT_MS = 5 * 60 * 1000
const EXPORT_STEP_TIMEOUT_MS = 15 * 60 * 1000

/**
 * SIGKILL to the negative pid targets the whole process group `detached: true`
 * made this child the leader of, so descendants a hung Jest or Metro spawned
 * (workers, the Watchman crawl, a bound port) die with it instead of being
 * reparented to init and outliving the script.
 *
 * Windows has no such thing as a process group signal: `detached: true` there
 * only frees the child from the parent's console, and a negative pid is not a
 * valid target for kill(2). `taskkill /T` walks the same process tree instead.
 */
function killProcessGroup(pid, { platform = process.platform, kill = process.kill, spawnTaskkill = spawnSync } = {}) {
  if (platform === 'win32') {
    spawnTaskkill('taskkill', ['/pid', String(pid), '/T', '/F'])
    return
  }
  try {
    kill(-pid, 'SIGKILL')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

// A step's subprocess is the leader of its own detached process group (see
// exec below), which is a different group from this script's, so a signal
// sent to this script's pid never reaches it on its own. Tracking every
// active pid here is what lets the SIGTERM/SIGINT handlers reach it too.
const activeChildPids = new Set()

// The step currently in flight, so a signal handler can wait for its finally
// (see step below) before the process exits instead of racing it.
let activeStepPromise = null

function exec(command, args, cwd, { env, timeoutMs = STEP_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: env ? { ...process.env, ...env } : process.env,
      detached: true,
    })
    activeChildPids.add(child.pid)

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killProcessGroup(child.pid)
    }, timeoutMs)

    child.on('error', (error) => {
      clearTimeout(timer)
      activeChildPids.delete(child.pid)
      console.log(`${RED}${error.message}${NC}`)
      resolve(false)
    })

    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      activeChildPids.delete(child.pid)
      if (timedOut) {
        console.log(`${RED}Timed out after ${timeoutMs / 1000}s and its process group was killed${NC}`)
      } else if (signal) {
        console.log(`${RED}Killed with ${signal}${NC}`)
      }
      resolve(code === 0)
    })
  })
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
 */
async function cancelActiveChildrenAndExit(exitCode, { exit = process.exit } = {}) {
  for (const pid of activeChildPids) killProcessGroup(pid)
  if (activeStepPromise) await activeStepPromise.catch(() => {})
  exit(exitCode)
}
process.on('SIGTERM', () => cancelActiveChildrenAndExit(143))
process.on('SIGINT', () => cancelActiveChildrenAndExit(130))

/**
 * Bundling is the only step that runs Metro's resolveRequest, which is what
 * pointed @nextsparkjs/ui at a `packages/ui/dist` build nothing produced
 * before it was fixed to bundle straight from source: type-checking alone
 * resolves imports through tsconfig paths and never notices.
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

  const steps = [
    ['This script\'s process-group teardown (node:test)', () =>
      exec(process.execPath, ['--test', join(REPO_ROOT, 'scripts/packages/mobile-verify.test.mjs')], REPO_ROOT)],
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

export { exec, step, killProcessGroup, cancelActiveChildrenAndExit }

// Guards the run below so mobile-verify.test.mjs can import the functions
// above without kicking off the whole verify pipeline as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = await main()
  process.exitCode = ok ? 0 : 1
}
