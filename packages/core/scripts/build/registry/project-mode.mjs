/**
 * The single owner of compiler path resolution.
 *
 * A NextSpark project is the nearest ancestor containing nextspark.config.ts.
 * Its host, source, configuration, plugins, and generated output all live
 * under that same root; no theme or sibling project is selected.
 *
 * @module core/scripts/build/registry/project-mode
 */

import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs'
import { dirname, join, posix, resolve } from 'path'
import { fileURLToPath } from 'url'

const CORE_PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const GENERATED_APP_RELATIVE = 'src/app'
export const GENERATED_TEMPLATES_RELATIVE = `${GENERATED_APP_RELATIVE}/(templates)`
export const REGISTRIES_RELATIVE = '.nextspark/registries'
export const BACKUPS_RELATIVE = '.nextspark/backups'
export const TEST_FIXTURES_RELATIVE = 'tests/cypress/fixtures'

export function detectMonorepoRoot(startDir = process.cwd()) {
  let dir = resolve(startDir)
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function isInstalledAsPackage(root) {
  const corePath = join(root, 'node_modules/@nextsparkjs/core')
  if (!existsSync(corePath)) return false

  try {
    const stat = lstatSync(corePath)
    if (!stat.isSymbolicLink()) return true
    return /\.pnpm\d?[/\\]/.test(readlinkSync(corePath))
  } catch {
    return false
  }
}

export function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir)
  while (true) {
    if (existsSync(join(dir, 'nextspark.config.ts'))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`No NextSpark project found from ${startDir}: expected nextspark.config.ts in this directory or an ancestor.`)
    }
    dir = parent
  }
}

function assertNextDependency(projectRoot) {
  const packagePath = join(projectRoot, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
  } catch (error) {
    throw new Error(`Invalid NextSpark project at ${projectRoot}: could not read package.json (${error.message}).`)
  }
  const next = manifest.dependencies?.next ?? manifest.devDependencies?.next
  if (typeof next !== 'string' || next.trim() === '') {
    throw new Error(`Invalid NextSpark project at ${projectRoot}: package.json must declare a non-empty "next" dependency.`)
  }
}

export function projectImport(relativePath) {
  return `@/${posix.normalize(relativePath).replace(/^\.\//, '')}`
}

export function pluginImport(pluginName, relativePath = '') {
  return projectImport(posix.join('plugins', pluginName, relativePath))
}

export function projectGeneratedAppDir(projectRoot) {
  return join(projectRoot, GENERATED_APP_RELATIVE)
}

export function projectGeneratedTemplatesDir(projectRoot) {
  return join(projectRoot, GENERATED_TEMPLATES_RELATIVE)
}

export function projectRegistriesDir(projectRoot) {
  return join(projectRoot, REGISTRIES_RELATIVE)
}

export function projectBackupsDir(projectRoot) {
  return join(projectRoot, BACKUPS_RELATIVE)
}

export function projectTestFixturesDir(projectRoot) {
  return join(projectRoot, TEST_FIXTURES_RELATIVE)
}

export function resolveProjectPaths(startDir = process.cwd()) {
  const projectRoot = findProjectRoot(startDir)
  assertNextDependency(projectRoot)

  const isNpmMode = isInstalledAsPackage(projectRoot)
  const monorepoRoot = detectMonorepoRoot(projectRoot)
  const isMonorepoMode = !isNpmMode && monorepoRoot !== null
  const coreDir = isNpmMode
    ? join(projectRoot, 'node_modules/@nextsparkjs/core')
    : isMonorepoMode
      ? join(monorepoRoot, 'packages/core')
      : CORE_PACKAGE_DIR

  return {
    projectRoot,
    projectSourceDir: projectRoot,
    sourceDirs: ['api', 'blocks', 'components', 'config', 'entities', 'lib', 'messages', 'styles', 'templates'].map(name => join(projectRoot, name)),
    pluginsDir: join(projectRoot, 'plugins'),
    generatedAppDir: projectGeneratedAppDir(projectRoot),
    generatedTemplatesDir: projectGeneratedTemplatesDir(projectRoot),
    outputDir: projectRegistriesDir(projectRoot),
    backupsDir: projectBackupsDir(projectRoot),
    testFixturesDir: projectTestFixturesDir(projectRoot),
    coreDir,
    monorepoRoot,
    isNpmMode,
    isMonorepoMode,
  }
}
