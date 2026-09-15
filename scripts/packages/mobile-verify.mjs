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
 *   1. installs apps/mobile on its own (it is outside the pnpm workspace),
 *   2. type-checks apps/mobile,
 *   3. assembles the template in a temp directory, checks its dependency
 *      declarations and type-checks it, side-effect imports included,
 *   4. runs the apps/mobile Jest suite.
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

import { spawnSync } from 'node:child_process'
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

// What sync-mobile-templates.ts leaves out when it copies apps/mobile/app.
const SYNC_EXCLUDES = new Set(['.DS_Store', 'node_modules', '.expo', '.turbo'])
const SOURCE_FILE = /\.[cm]?[jt]sx?$/

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

function step(label, run) {
  console.log(`${CYAN}→ ${label}${NC}`)
  const passed = run()
  console.log(passed ? `${GREEN}✓ ${label} passed${NC}` : `${RED}✗ ${label} failed${NC}`)
  return passed
}

function exec(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) console.log(`${RED}${result.error.message}${NC}`)
  return result.status === 0
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

function verifyTemplate() {
  const ts = createRequire(join(MOBILE_APP_DIR, 'package.json'))('typescript')
  const dir = mkdtempSync(join(tmpdir(), 'nextspark-mobile-template-'))
  try {
    assembleTemplate(dir, ts)
    const problems = templateDependencyProblems(dir, ts)
    for (const problem of problems) console.log(`  ${RED}${problem}${NC}`)
    if (problems.length > 0) return false
    const tsc = join(MOBILE_APP_DIR, 'node_modules/typescript/bin/tsc')
    return exec(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.verify.json'], dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
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
    ['Install apps/mobile (isolated, frozen lockfile)', () =>
      exec('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile'], MOBILE_APP_DIR)],
    ['Typecheck apps/mobile', () => exec('pnpm', ['run', 'typecheck'], MOBILE_APP_DIR)],
    ['Typecheck the shipped template (packages/mobile/templates + apps/mobile/app)', verifyTemplate],
    ['Test apps/mobile (jest)', () => exec('pnpm', ['run', 'test'], MOBILE_APP_DIR)],
  ]
  for (const [label, run] of steps) {
    if (!step(label, run)) return false
  }

  console.log()
  console.log(`${GREEN}✓ apps/mobile and the mobile template verified${NC}`)
  return true
}

process.exitCode = main() ? 0 : 1
