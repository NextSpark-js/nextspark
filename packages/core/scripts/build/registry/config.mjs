/**
 * Registry Build Configuration
 *
 * Central configuration for the registry build process.
 * Contains paths, flags, and content type definitions.
 *
 * Supports three modes:
 * 1. Monorepo mode: themes/plugins at repo root as workspace packages
 * 2. NPM mode: @nextsparkjs/core installed in node_modules
 * 3. User project mode: themes/plugins in contents/ directory
 *
 * @module core/scripts/build/registry/config
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, lstatSync, readlinkSync } from 'fs'
import dotenv from 'dotenv'
import { loadNextSparkConfigSync } from '../config-loader.mjs'

// Load .env from the correct project root
// Priority: NEXTSPARK_PROJECT_ROOT env var > cwd
// This is critical for npm mode where cwd might be node_modules/@nextsparkjs/core
const envPath = process.env.NEXTSPARK_PROJECT_ROOT
  ? join(process.env.NEXTSPARK_PROJECT_ROOT, '.env')
  : undefined
dotenv.config({ path: envPath, override: true })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Root directory (5 levels up from packages/core/scripts/build/registry/)
export const rootDir = join(__dirname, '../../../../..')

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
 * Detect project root by searching for nextspark.config.ts or apps/dev in monorepo
 * @returns {string} Project root path
 */
export function detectProjectRoot() {
  // Check for explicit project root from CLI
  if (process.env.NEXTSPARK_PROJECT_ROOT) {
    return process.env.NEXTSPARK_PROJECT_ROOT
  }

  let dir = process.cwd()
  const maxDepth = 10
  let depth = 0

  // Search upward for nextspark.config.ts
  while (dir !== '/' && depth < maxDepth) {
    // Primary: nextspark.config.ts
    if (existsSync(join(dir, 'nextspark.config.ts'))) {
      return dir
    }
    // Secondary: monorepo with apps/dev (development mode)
    if (existsSync(join(dir, 'apps/dev'))) {
      return join(dir, 'apps/dev')
    }
    dir = dirname(dir)
    depth++
  }

  // If not found, use current working directory
  return process.cwd()
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

    // If symlink points to .pnpm/ directory, it's a real npm installation via pnpm
    // The .pnpm directory is pnpm's content-addressable store
    if (linkTarget.includes('.pnpm/') || linkTarget.includes('.pnpm\\')) {
      return true
    }

    // Otherwise it's a workspace symlink (monorepo development)
    return false
  } catch {
    return false
  }
}

/**
 * Get dynamic configuration based on project root
 * @param {string|null} projectRoot - Optional project root path
 * @returns {object} Configuration object
 */
export function getConfig(projectRoot = null) {
  // Determine project root
  const root = projectRoot || detectProjectRoot()

  // Check if running in npm mode
  const isNpmMode = isInstalledAsPackage(root)

  // Check if running in monorepo mode
  const monorepoRoot = detectMonorepoRoot(root)
  const isMonorepoMode = !isNpmMode && monorepoRoot !== null

  // Determine paths based on mode
  // In monorepo mode, core is at monorepoRoot/packages/core
  // In npm mode, core is at projectRoot/node_modules/@nextsparkjs/core
  const coreDir = isNpmMode
    ? join(root, 'node_modules/@nextsparkjs/core')
    : join(isMonorepoMode ? monorepoRoot : root, 'packages/core')

  // ALWAYS generate in .nextspark/registries/ of the project
  // This unifies npm mode and monorepo mode to use the same location
  const outputDir = join(root, '.nextspark/registries')

  // Load nextspark.config.ts for features and other settings
  const nextsparkConfig = loadNextSparkConfigSync(root)

  // Determine content directories based on mode
  // Monorepo: themes/plugins at repo root as workspace packages
  // User project: themes/plugins in contents/ directory
  let contentsDir, themesDir, pluginsDir

  if (isMonorepoMode) {
    // Monorepo mode: themes and plugins are at the repo root
    contentsDir = join(monorepoRoot, 'contents') // Legacy, kept for compatibility
    themesDir = join(monorepoRoot, 'themes')
    pluginsDir = join(monorepoRoot, 'plugins')
  } else {
    // User project mode (npm or standalone)
    contentsDir = join(root, 'contents')
    themesDir = join(root, 'contents/themes')
    pluginsDir = join(root, 'contents/plugins')
  }

  return {
    projectRoot: root,
    monorepoRoot,
    isNpmMode,
    isMonorepoMode,
    coreDir,
    outputDir,
    contentsDir,
    themesDir,
    pluginsDir,
    watchMode: process.argv.includes('--watch') && !process.argv.includes('--build'),
    buildMode: process.argv.includes('--build'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    activeTheme: process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, ''),
    features: nextsparkConfig?.features || {
      billing: true,
      teams: true,
      superadmin: true,
      aiChat: true
    }
  }
}

/**
 * Build configuration (legacy - for backward compatibility)
 * Uses getConfig() with no projectRoot (auto-detect)
 */
export const CONFIG = getConfig()

/**
 * Convert @/core/ import paths based on NPM mode
 * @param {string} importPath - Original import path (e.g., '@/core/lib/permissions/types')
 * @param {string} outputFilePath - Path where the registry file will be written
 * @param {object} config - Configuration object from getConfig()
 * @returns {string} Converted import path
 */
export function convertCorePath(importPath, outputFilePath, config) {
  // In monorepo mode, keep @/core/ aliases as-is
  if (!config.isNpmMode) {
    return importPath
  }

  // In NPM mode, convert @/core/* to @nextsparkjs/core/*
  // This allows the consuming project's tsconfig to resolve the path
  if (importPath.startsWith('@/core/')) {
    const relativePart = importPath.replace('@/core/', '')
    return `@nextsparkjs/core/${relativePart}`
  }

  // Return unchanged if not a @/core/ path
  return importPath
}

/**
 * Content type definitions with their discovery and generation functions
 * Note: Functions are imported and assigned in the main registry.mjs
 */
export const CONTENT_TYPES = {
  plugins: {
    dir: 'plugins',
    configPattern: 'plugin.config.ts',
    generator: null, // Set by main registry
    discoverer: null
  },
  entities: {
    dir: 'entities',
    configPattern: '.config.ts',
    generator: null,
    discoverer: null
  },
  auth: {
    dir: 'auth',
    configPattern: 'roles.json',
    generator: null,
    discoverer: null
  },
  themes: {
    dir: 'themes',
    configPattern: 'theme.config.ts',
    generator: null,
    discoverer: null
  },
  blocks: {
    dir: 'themes',
    configPattern: 'block.config.ts',
    generator: null,
    discoverer: null
  },
  templates: {
    dir: 'themes',
    configPattern: null,
    generator: null,
    discoverer: null
  }
}
