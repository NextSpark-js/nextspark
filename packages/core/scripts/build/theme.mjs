#!/usr/bin/env node

/**
 * Theme Build System - Standalone Build Script
 *
 * Generates CSS for the active theme based on NEXT_PUBLIC_ACTIVE_THEME.
 * Transpiles theme CSS from contents/themes/[THEME]/styles/ to app/theme-styles.css
 *
 * Usage:
 *   node scripts/build-theme.mjs          # Build once
 *   node scripts/build-theme.mjs --watch  # Build and watch for changes
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { getConfig } from './registry/config.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Path from packages/core/scripts/build/ to project root (4 levels up)
const rootDir = path.join(__dirname, '..', '..', '..', '..')

// Load environment variables
dotenv.config({ override: true })

/**
 * Get active theme from environment or default
 */
function getActiveTheme() {
  return process.env.NEXT_PUBLIC_ACTIVE_THEME
}

/**
 * Sync app/globals.css to import from the active theme
 *
 * This ensures the import path in app/globals.css always matches
 * NEXT_PUBLIC_ACTIVE_THEME, handling both npm and monorepo modes.
 *
 * @param {object} config - Configuration from getConfig()
 * @param {string} activeTheme - Active theme name
 * @returns {boolean} - True if file was updated, false if already correct
 */
function syncAppGlobalsCss(config, activeTheme) {
  const appGlobalsCssPath = path.join(config.projectRoot, 'app', 'globals.css')

  // Calculate the correct relative path from app/ to theme globals.css
  const appDir = path.join(config.projectRoot, 'app')
  const themeGlobalsPath = path.join(config.themesDir, activeTheme, 'styles', 'globals.css')
  const relativePath = path.relative(appDir, themeGlobalsPath)

  // Expected import statement
  const expectedImport = `@import "${relativePath}";`

  // Template for app/globals.css
  const template = `/* =============================================
   GLOBAL STYLES - Import from Active Theme

   This file imports styles from the active theme.
   DO NOT edit directly - all styles are in:
   contents/themes/{theme}/styles/globals.css

   To customize colors, typography and tokens, edit
   the globals.css file in your active theme.
   ============================================= */

${expectedImport}
`

  // Check if file exists and has correct import
  if (fs.existsSync(appGlobalsCssPath)) {
    const currentContent = fs.readFileSync(appGlobalsCssPath, 'utf8')

    // Extract current import (handle various formats)
    const importMatch = currentContent.match(/@import\s+["']([^"']+)["'];?/)

    if (importMatch) {
      const currentImportPath = importMatch[1]

      // Check if it's already pointing to the correct theme
      if (currentImportPath === relativePath) {
        return false // Already correct, no update needed
      }

      // Update only the import line, preserving any custom comments
      const updatedContent = currentContent.replace(
        /@import\s+["'][^"']+["'];?/,
        expectedImport
      )

      fs.writeFileSync(appGlobalsCssPath, updatedContent)
      console.log(`   🔄 Updated app/globals.css import: ${relativePath}`)
      return true
    }
  }

  // File doesn't exist or has no import - write full template
  fs.writeFileSync(appGlobalsCssPath, template)
  console.log(`   ✅ Created app/globals.css with import: ${relativePath}`)
  return true
}

/**
 * Recursively copy directory contents
 */
function copyRecursive(src, dest) {
  const stats = fs.statSync(src)

  if (stats.isDirectory()) {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    // Read directory contents
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

/**
 * Count files in directory recursively
 */
function countFiles(dir) {
  let count = 0

  if (!fs.existsSync(dir)) {
    return 0
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name))
    } else {
      count++
    }
  }

  return count
}

/**
 * Copy block thumbnails from theme blocks to public/theme/blocks/
 * Copies thumbnail.png from each block folder to public/theme/blocks/{slug}/thumbnail.png
 */
function copyBlockThumbnails(themePath, activeTheme) {
  const blocksPath = path.join(themePath, 'blocks')
  const publicBlocksPath = path.join(rootDir, 'public', 'theme', 'blocks')

  if (!fs.existsSync(blocksPath)) {
    return 0
  }

  // Ensure public/theme/blocks directory exists
  if (!fs.existsSync(publicBlocksPath)) {
    fs.mkdirSync(publicBlocksPath, { recursive: true })
  }

  let copiedCount = 0
  const blockDirs = fs.readdirSync(blocksPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())

  for (const blockDir of blockDirs) {
    const thumbnailSrc = path.join(blocksPath, blockDir.name, 'thumbnail.png')

    if (fs.existsSync(thumbnailSrc)) {
      const thumbnailDestDir = path.join(publicBlocksPath, blockDir.name)
      const thumbnailDest = path.join(thumbnailDestDir, 'thumbnail.png')

      // Create destination directory if needed
      if (!fs.existsSync(thumbnailDestDir)) {
        fs.mkdirSync(thumbnailDestDir, { recursive: true })
      }

      fs.copyFileSync(thumbnailSrc, thumbnailDest)
      copiedCount++
    }
  }

  return copiedCount
}

/**
 * Copy all theme public assets to public/theme/
 * Recursively copies entire contents/themes/[THEME]/public/ directory
 */
function copyThemePublicAssets(themePath, activeTheme) {
  const themePublicPath = path.join(themePath, 'public')
  const publicThemePath = path.join(rootDir, 'public', 'theme')

  // Ensure public/theme directory exists
  if (!fs.existsSync(publicThemePath)) {
    fs.mkdirSync(publicThemePath, { recursive: true })
  }

  if (!fs.existsSync(themePublicPath)) {
    console.log(`   ℹ️  No public assets directory found for theme: ${activeTheme}`)
    return
  }

  try {
    // Copy entire public directory recursively
    copyRecursive(themePublicPath, publicThemePath)

    // Count files for reporting
    const fileCount = countFiles(publicThemePath)

    if (fileCount > 0) {
      console.log(`   ✅ Copied ${fileCount} asset(s) to public/theme/`)
    }
  } catch (error) {
    console.error(`   ❌ Failed to copy public assets:`, error)
  }
}

/**
 * Validate that theme globals.css has all required sections
 * @param {string} cssContent - Content of the globals.css file
 * @param {string} themeName - Name of the theme being validated
 * @returns {boolean} - True if valid, false if missing required sections
 */
function validateThemeCSS(cssContent, themeName) {
  const required = [
    { pattern: '@import "tailwindcss"', name: 'Tailwind import' },
    { pattern: ':root', name: 'Light mode variables' },
    { pattern: '.dark', name: 'Dark mode variables' },
    { pattern: '@theme', name: 'Tailwind v4 theme mapping' },
    { pattern: '--background:', name: '--background variable' },
    { pattern: '--primary:', name: '--primary variable' },
    { pattern: '--color-background:', name: '@theme background mapping' }
  ]

  const missing = required.filter(r => !cssContent.includes(r.pattern))

  if (missing.length > 0) {
    console.warn(`   ⚠️  Theme "${themeName}" globals.css missing required sections:`)
    missing.forEach(m => console.warn(`      - ${m.name}`))
    console.warn(`   💡 Theme globals.css should be self-contained with all variables and @theme mapping.`)
    console.warn(`   📚 See: contents/themes/starter/styles/globals.css for reference`)
    return false
  }

  return true
}

/**
 * Build theme CSS based on active theme
 * @param {string|null} projectRoot - Optional project root path (for NPM mode)
 */
export async function buildTheme(projectRoot = null) {
  // Get dynamic configuration
  const config = getConfig(projectRoot)
  const activeTheme = getActiveTheme()

  console.log(`🎨 Building theme system...`)
  console.log(`📋 Active theme: ${activeTheme}`)
  if (config.isNpmMode) {
    console.log(`📦 NPM Mode: Using project root ${config.projectRoot}`)
  }

  const outputDir = path.join(config.projectRoot, '.next')
  const outputPath = path.join(outputDir, 'theme-generated.css')
  const themePath = path.join(config.contentsDir, 'themes', activeTheme)

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Sync app/globals.css to import from the active theme
  // This handles path differences between npm and monorepo modes
  syncAppGlobalsCss(config, activeTheme)

  // Copy theme public assets (for all themes, including default)
  if (fs.existsSync(themePath)) {
    copyThemePublicAssets(themePath, activeTheme)

    // Copy block thumbnails to public/theme/blocks/
    const thumbnailCount = copyBlockThumbnails(themePath, activeTheme)
    if (thumbnailCount > 0) {
      console.log(`   ✅ Copied ${thumbnailCount} block thumbnail(s) to public/theme/blocks/`)
    }
  }

  // Build theme (including default - all themes load their own styles)
  if (!fs.existsSync(themePath)) {
    console.error(`❌ Theme directory not found: ${themePath}`)
    console.log('📁 Available themes:')

    const themesDir = path.join(rootDir, 'contents', 'themes')
    const availableThemes = fs.readdirSync(themesDir)
      .filter(item => {
        const itemPath = path.join(themesDir, item)
        return fs.statSync(itemPath).isDirectory() && item !== 'node_modules'
      })

    availableThemes.forEach(theme => console.log(`   - ${theme}`))

    // Fallback to empty (core styles only)
    console.log('🔄 Falling back to core styles only')
    fs.writeFileSync(outputPath, `/* Fallback: Theme '${activeTheme}' not found, using core styles */\n`)
    return
  }

  try {
    console.log(`🔄 Building custom theme: ${activeTheme}`)

    // Read theme CSS files
    const globalStylesPath = path.join(themePath, 'styles', 'globals.css')
    const componentStylesPath = path.join(themePath, 'styles', 'components.css')

    let globalCSS = ''
    let componentCSS = ''

    if (fs.existsSync(globalStylesPath)) {
      globalCSS = fs.readFileSync(globalStylesPath, 'utf8')
      console.log(`   ✅ Loaded globals.css (${globalCSS.length} chars)`)

      // Validate that theme has all required sections
      validateThemeCSS(globalCSS, activeTheme)
    } else {
      console.warn(`   ⚠️  globals.css not found: ${globalStylesPath}`)
    }

    if (fs.existsSync(componentStylesPath)) {
      componentCSS = fs.readFileSync(componentStylesPath, 'utf8')
      console.log(`   ✅ Loaded components.css (${componentCSS.length} chars)`)
    } else {
      console.warn(`   ⚠️  components.css not found: ${componentStylesPath}`)
    }

    // Generate final CSS
    const buildTimestamp = new Date().toISOString()
    const finalCSS = `/*
 * Generated Theme CSS
 * Theme: ${activeTheme}
 * Build time: ${buildTimestamp}
 *
 * This file is auto-generated. Do not edit manually.
 * To modify themes, edit files in contents/themes/${activeTheme}/
 */

${globalCSS}

${componentCSS}
`

    // Write final CSS to .next directory (for build cache)
    fs.writeFileSync(outputPath, finalCSS)

    console.log(`✅ Theme built successfully!`)
    console.log(`📄 Output: ${outputPath} (${finalCSS.length} chars)`)

  } catch (error) {
    console.error(`❌ Theme build failed:`, error)

    // Write error information
    const errorCSS = `/*
 * Theme Build Error
 * Theme: ${activeTheme}
 * Error: ${error.message}
 *
 * Falling back to core styles only.
 */
`
    fs.writeFileSync(outputPath, errorCSS)

    throw error
  }
}

/**
 * Watch theme files for changes
 */
async function watchTheme() {
  const activeTheme = getActiveTheme()
  const themePath = path.join(rootDir, 'contents', 'themes', activeTheme)
  const stylesPath = path.join(themePath, 'styles')

  console.log(`👀 Watching theme files: ${stylesPath}`)
  console.log(`   Watching: globals.css, components.css`)

  let debounceTimer = null

  try {
    const watcher = fs.watch(stylesPath, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.css'))) {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          console.log()
          console.log(`🔄 Theme file changed: ${filename}`)
          await buildTheme()
        }, 300)
      }
    })

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log()
      console.log('👋 Stopping theme watch...')
      watcher.close()
      process.exit(0)
    })

  } catch (error) {
    console.error('❌ Failed to watch theme files:', error)
    throw error
  }
}

// Main execution
const watchMode = process.argv.includes('--watch') || process.argv.includes('-w')

console.log('🎨 Starting theme build process...')

try {
  await buildTheme()
  console.log('✅ Theme build process completed successfully!')

  if (watchMode) {
    console.log()
    console.log('👀 Starting watch mode...')
    await watchTheme()
  }
} catch (error) {
  console.error('❌ Theme build process failed:', error)
  process.exit(1)
}
