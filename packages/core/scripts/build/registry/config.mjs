/**
 * Root-first registry build configuration.
 *
 * All filesystem paths come from project-mode.mjs. Discovery modules consume
 * the resolved project root and never select or search for a theme.
 *
 * @module core/scripts/build/registry/config
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { resolveProjectPaths, resolveProjectPluginSources, detectMonorepoRoot, isInstalledAsPackage } from './project-mode.mjs'
import { loadNextSparkConfigSync } from '../config-loader.mjs'

export { detectMonorepoRoot, isInstalledAsPackage }

export function detectProjectRoot(startDir = process.cwd()) {
  return resolveProjectPaths(startDir).projectRoot
}

export function getConfig(projectRoot = null) {
  const paths = resolveProjectPaths(projectRoot || process.cwd())
  const nextsparkConfig = loadNextSparkConfigSync(paths.projectRoot)
  const pluginSources = resolveProjectPluginSources(paths.projectRoot, nextsparkConfig.plugins)
  const themeConfigPath = join(paths.projectRoot, 'config', 'theme.config.ts')
  const themeConfig = existsSync(themeConfigPath) ? readFileSync(themeConfigPath, 'utf8') : ''
  const projectName = themeConfig.match(/\bname:\s*['"]([^'"]+)['"]/)?.[1] || 'project'

  return {
    ...paths,
    projectName,
    pluginRequests: nextsparkConfig.plugins,
    pluginSources,
    pluginDirs: pluginSources.map(plugin => plugin.sourceDir),
    plugins: pluginSources.map(plugin => plugin.name),
    features: nextsparkConfig.features,
    watchMode: process.argv.includes('--watch') && !process.argv.includes('--build'),
    buildMode: process.argv.includes('--build'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  }
}

export function validateEnvironment() {
  return { valid: true, errors: [] }
}

// Legacy named export for modules that accept an explicit config; compiler entrypoints call getConfig().
export const CONFIG = null

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
