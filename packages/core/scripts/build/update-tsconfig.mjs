#!/usr/bin/env node

/**
 * Dynamic TSConfig Generator
 *
 * Generates tsconfig.json from tsconfig.base.json, adding dynamic exclusions
 * for inactive themes and plugins based on NEXT_PUBLIC_ACTIVE_THEME.
 *
 * This allows TypeScript to only check the active theme/plugins, preventing
 * errors in inactive themes from blocking development.
 *
 * Generated file: tsconfig.json (gitignored)
 * Source template: tsconfig.base.json (committed)
 *
 * Usage: node core/scripts/build/update-tsconfig.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Detect if running from npm package (node_modules) or source
// When installed as npm package, use process.cwd() (the consuming project root)
// When running from source, use relative path calculation
const isNpmPackage = __dirname.includes('node_modules')
const ROOT_DIR = isNpmPackage ? process.cwd() : path.join(__dirname, '..', '..', '..', '..')

// Load environment variables (override system env vars with .env values)
dotenv.config({
  path: path.join(ROOT_DIR, '.env'),
  override: true
})

const TSCONFIG_BASE_PATH = path.join(ROOT_DIR, 'tsconfig.base.json')
const TSCONFIG_PATH = path.join(ROOT_DIR, 'tsconfig.json')
const THEMES_DIR = path.join(ROOT_DIR, 'contents/themes')
const PLUGINS_DIR = path.join(ROOT_DIR, 'contents/plugins')

/**
 * Get all theme directories
 */
function getAllThemes() {
  if (!fs.existsSync(THEMES_DIR)) {
    return []
  }

  return fs.readdirSync(THEMES_DIR)
    .filter(item => {
      const themePath = path.join(THEMES_DIR, item)
      return fs.statSync(themePath).isDirectory()
    })
}

/**
 * Get all plugin directories
 */
function getAllPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return []
  }

  return fs.readdirSync(PLUGINS_DIR)
    .filter(item => {
      const pluginPath = path.join(PLUGINS_DIR, item)
      return fs.statSync(pluginPath).isDirectory()
    })
}

/**
 * Get active plugins from theme config
 */
function getActivePlugins(activeTheme) {
  const themeConfigPath = path.join(THEMES_DIR, activeTheme, 'theme.config.ts')

  if (!fs.existsSync(themeConfigPath)) {
    // Try .js extension
    const jsConfigPath = path.join(THEMES_DIR, activeTheme, 'theme.config.js')
    if (!fs.existsSync(jsConfigPath)) {
      return []
    }
  }

  try {
    const configPath = fs.existsSync(path.join(THEMES_DIR, activeTheme, 'theme.config.ts'))
      ? path.join(THEMES_DIR, activeTheme, 'theme.config.ts')
      : path.join(THEMES_DIR, activeTheme, 'theme.config.js')

    const configContent = fs.readFileSync(configPath, 'utf8')

    // Match plugins array: plugins: ['plugin1', 'plugin2']
    const pluginsMatch = configContent.match(/plugins:\s*\[(.*?)\]/s)

    if (!pluginsMatch) {
      return []
    }

    // Extract plugin names from the matched array
    const pluginsString = pluginsMatch[1]
    const pluginNames = pluginsString
      .split(',')
      .map(p => p.trim().replace(/['"]/g, ''))
      .filter(p => p.length > 0)

    return pluginNames
  } catch (error) {
    console.warn(`⚠️  Failed to read theme config: ${error.message}`)
    return []
  }
}

/**
 * Generate tsconfig.json from base template with dynamic exclusions
 */
function generateTsConfig() {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  // Check if base template exists
  if (!fs.existsSync(TSCONFIG_BASE_PATH)) {
    console.error('❌ tsconfig.base.json not found!')
    console.error('   Please ensure tsconfig.base.json exists in the project root.')
    process.exit(1)
  }

  // Read base template
  const baseConfig = JSON.parse(fs.readFileSync(TSCONFIG_BASE_PATH, 'utf8'))

  // In NPM mode, add @nextspark/* aliases for registry and core resolution
  if (isNpmPackage) {
    baseConfig.compilerOptions = baseConfig.compilerOptions || {}
    baseConfig.compilerOptions.paths = baseConfig.compilerOptions.paths || {}

    // Add @nextsparkjs/registries/* alias to resolve to .nextspark/registries/*
    baseConfig.compilerOptions.paths['@nextsparkjs/registries/*'] = ['./.nextspark/registries/*']

    // Add @nextsparkjs/core/* alias to resolve to node_modules/@nextsparkjs/core/dist/*
    baseConfig.compilerOptions.paths['@nextsparkjs/core/*'] = ['./node_modules/@nextsparkjs/core/dist/*']

    // Add @/core/* alias (used by generated registries) to resolve to @nextsparkjs/core/dist/*
    baseConfig.compilerOptions.paths['@/core/*'] = ['./node_modules/@nextsparkjs/core/dist/*']

    // Add @/themes/* alias for theme imports
    baseConfig.compilerOptions.paths['@/themes/*'] = ['./contents/themes/*']

    // Add @/plugins/* alias for plugin imports
    baseConfig.compilerOptions.paths['@/plugins/*'] = ['./contents/plugins/*']

    // Add @/contents/* alias for content imports
    baseConfig.compilerOptions.paths['@/contents/*'] = ['./contents/*']

    // Include .nextspark folder
    baseConfig.include = baseConfig.include || []
    if (!baseConfig.include.includes('.nextspark/**/*.ts')) {
      baseConfig.include.push('.nextspark/**/*.ts')
    }
  }

  // Extract base excludes from template
  const baseExcludes = baseConfig.baseExclude || [
    'node_modules',
    'core/scripts/**/*',
    'core/tests/**/*',
    'cypress/**/*',
    'contents/themes/*/tests/**/*',
    'contents/plugins/*/tests/**/*',
    '_tmp/**/**'
  ]

  // Remove the baseExclude field (it's not a valid tsconfig field)
  delete baseConfig.baseExclude
  delete baseConfig._comment

  // If no active theme, just use base excludes
  if (!activeTheme) {
    console.warn('⚠️  NEXT_PUBLIC_ACTIVE_THEME not set')
    console.warn('   Using base excludes only (all themes/plugins will be checked)')
    baseConfig.exclude = baseExcludes
    fs.writeFileSync(TSCONFIG_PATH, JSON.stringify(baseConfig, null, 2) + '\n', 'utf8')
    console.log('📝 Generated tsconfig.json (no active theme)')
    return
  }

  // Get all themes and plugins
  const allThemes = getAllThemes()
  const allPlugins = getAllPlugins()

  // Determine inactive themes/plugins
  const inactiveThemes = allThemes.filter(theme => theme !== activeTheme)
  const activePlugins = getActivePlugins(activeTheme)
  const inactivePlugins = allPlugins.filter(plugin => !activePlugins.includes(plugin))

  // Build dynamic exclusions
  const themeExcludes = inactiveThemes.map(theme => `contents/themes/${theme}/**/*`)
  const pluginExcludes = inactivePlugins.map(plugin => `contents/plugins/${plugin}/**/*`)

  // Combine all exclusions
  baseConfig.exclude = [...baseExcludes, ...themeExcludes, ...pluginExcludes]

  // Write generated tsconfig
  fs.writeFileSync(TSCONFIG_PATH, JSON.stringify(baseConfig, null, 2) + '\n', 'utf8')

  console.log('📝 Generated tsconfig.json')
  console.log(`   Active theme: ${activeTheme}`)
  console.log(`   Active plugins: ${activePlugins.length > 0 ? activePlugins.join(', ') : 'none'}`)
  console.log(`   Excluded themes: ${inactiveThemes.length > 0 ? inactiveThemes.join(', ') : 'none'}`)
  console.log(`   Excluded plugins: ${inactivePlugins.length > 0 ? inactivePlugins.join(', ') : 'none'}`)
}

// Run the generator
try {
  generateTsConfig()
} catch (error) {
  console.error('❌ Failed to generate tsconfig.json:', error)
  process.exit(1)
}
