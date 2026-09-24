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
import { createRequire } from 'module'
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

function readProjectManifest(projectRoot) {
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
  return manifest
}

export function projectImport(relativePath) {
  return `@/${posix.normalize(relativePath).replace(/^\.\//, '')}`
}

export function pluginImport(pluginName, relativePath = '') {
  return projectImport(posix.join('plugins', pluginName, relativePath))
}

function packagedPluginRoot(projectRoot, packageName) {
  const projectRequire = createRequire(join(projectRoot, 'package.json'))
  let packageJsonPath
  try {
    packageJsonPath = projectRequire.resolve(`${packageName}/package.json`)
  } catch {
    let entryPath
    try {
      entryPath = projectRequire.resolve(packageName)
    } catch {
      throw new Error(
        `Packaged plugin "${packageName}" is enabled in nextspark.config.ts but is not installed for ${projectRoot}. ` +
        `Declare it in this project's dependencies and run pnpm install.`
      )
    }

    let candidate = dirname(entryPath)
    while (true) {
      const manifestPath = join(candidate, 'package.json')
      if (existsSync(manifestPath)) {
        try {
          if (JSON.parse(readFileSync(manifestPath, 'utf8')).name === packageName) {
            packageJsonPath = manifestPath
            break
          }
        } catch {
          // Continue upward until the package's own manifest is found.
        }
      }
      const parent = dirname(candidate)
      if (parent === candidate) break
      candidate = parent
    }
  }

  if (!packageJsonPath) {
    throw new Error(`Packaged plugin "${packageName}" resolved, but its package.json could not be located.`)
  }
  return dirname(packageJsonPath)
}

/**
 * Resolve enabled plugin source roots without scanning node_modules.
 * Local directory names keep their existing meaning. Scoped package names
 * must be direct project dependencies and resolve through that project's own
 * Node dependency graph. A local plugin with the package's logical name wins.
 */
export function resolveProjectPluginSources(projectRoot, enabledPlugins, projectManifest = null) {
  const manifest = projectManifest ?? readProjectManifest(projectRoot)
  const declaredDependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  }
  const resolved = new Map()

  for (const request of enabledPlugins) {
    if (!request.startsWith('@')) {
      const sourceDir = join(projectRoot, 'plugins', request)
      if (!existsSync(sourceDir)) continue
      resolved.set(request, {
        name: request,
        request,
        packageName: null,
        sourceDir,
        importBase: pluginImport(request),
        kind: 'local',
      })
      continue
    }

    if (typeof declaredDependencies[request] !== 'string') {
      throw new Error(
        `Packaged plugin "${request}" is enabled in nextspark.config.ts but is not declared in ${join(projectRoot, 'package.json')}. ` +
        `Add it to this project's dependencies and run pnpm install.`
      )
    }

    const packageDir = packagedPluginRoot(projectRoot, request)
    let packageManifest
    try {
      packageManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    } catch (error) {
      throw new Error(`Invalid packaged plugin "${request}": could not read its package.json (${error.message}).`)
    }
    const pluginName = packageManifest.nextspark?.type === 'plugin' && packageManifest.nextspark?.name
    if (
      typeof pluginName !== 'string' ||
      pluginName.trim() === '' ||
      pluginName === '.' ||
      pluginName === '..' ||
      pluginName.includes('/') ||
      pluginName.includes('\\')
    ) {
      throw new Error(
        `Invalid packaged plugin "${request}": package.json must declare nextspark.type = "plugin" and a directory-safe nextspark.name.`
      )
    }

    const localDir = join(projectRoot, 'plugins', pluginName)
    const source = existsSync(join(localDir, 'plugin.config.ts'))
      ? {
          name: pluginName,
          request,
          packageName: request,
          sourceDir: localDir,
          importBase: pluginImport(pluginName),
          kind: 'local',
        }
      : {
          name: pluginName,
          request,
          packageName: request,
          sourceDir: packageDir,
          importBase: request,
          kind: 'packaged',
        }

    const previous = resolved.get(pluginName)
    if (previous?.kind === 'local' && source.kind === 'packaged') continue
    if (previous?.kind === 'packaged' && source.kind === 'packaged' && previous.packageName !== request) {
      throw new Error(
        `Packaged plugins "${previous.packageName}" and "${request}" both declare the NextSpark plugin name "${pluginName}".`
      )
    }
    resolved.set(pluginName, source)
  }

  return [...resolved.values()]
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
  readProjectManifest(projectRoot)

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
