/**
 * How core is installed in a project, told from the project alone: from npm, or
 * as a package of the NextSpark monorepo. Nothing here reads configuration or
 * loads a .env, so a check that runs before the build - in the build itself or
 * in `nextspark` - can ask it.
 *
 * @module core/scripts/build/registry/project-mode
 */

import { existsSync, lstatSync, readlinkSync } from 'fs'
import { dirname, join } from 'path'

/**
 * Detect monorepo root by searching for pnpm-workspace.yaml
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Monorepo root path or null if not in monorepo
 */
export function detectMonorepoRoot(startDir = process.cwd()) {
  let dir = startDir
  const maxDepth = 10
  let depth = 0

  while (dir !== '/' && depth < maxDepth) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    dir = dirname(dir)
    depth++
  }

  return null
}

/**
 * Check if NextSpark is installed as a package (from npm registry)
 *
 * This handles both traditional npm/yarn AND pnpm:
 * - npm/yarn: packages are copied to node_modules (not symlinks)
 * - pnpm: ALL packages are symlinks, but npm packages point to .pnpm/ store
 * - pnpm workspace: local packages symlink to the actual package path
 *
 * @param {string} root - Project root path
 * @returns {boolean} True if installed from npm registry
 */
export function isInstalledAsPackage(root) {
  const corePath = join(root, 'node_modules/@nextsparkjs/core')
  if (!existsSync(corePath)) {
    return false
  }

  try {
    const stat = lstatSync(corePath)

    // If not a symlink, it's a traditional npm/yarn install
    if (!stat.isSymbolicLink()) {
      return true
    }

    // For symlinks (pnpm), check WHERE it points to:
    // - npm install: points to .pnpm/@nextsparkjs+core@version.../node_modules/@nextsparkjs/core
    // - workspace: points to ../../packages/core or similar
    const linkTarget = readlinkSync(corePath)

    // If symlink points to .pnpm/ or .pnpmN/ directory, it's a real npm installation via pnpm
    // The .pnpm/.pnpm2/etc directory is pnpm's content-addressable store
    if (/\.pnpm\d?[/\\]/.test(linkTarget)) {
      return true
    }

    // Otherwise it's a workspace symlink (monorepo development)
    return false
  } catch {
    return false
  }
}

