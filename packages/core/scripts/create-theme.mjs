#!/usr/bin/env node

/**
 * Create Theme Script
 *
 * Scaffolds a new theme from the preset template.
 *
 * Usage:
 *   node scripts/create-theme.mjs <theme-name> [options]
 *   pnpm create:theme <theme-name> [options]
 *
 * Options:
 *   --description, -d    Theme description
 *   --author, -a         Theme author
 *   --display-name       Display name (defaults to capitalized theme name)
 *
 * Examples:
 *   pnpm create:theme my-app
 *   pnpm create:theme e-commerce --description "E-commerce platform" --author "John Doe"
 *   pnpm create:theme dashboard --display-name "Admin Dashboard"
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// CONFIGURATION
// =============================================================================

const ROOT_DIR = path.resolve(__dirname, '..')
const PRESET_DIR = path.join(ROOT_DIR, 'core', 'presets', 'theme')
const THEMES_DIR = path.join(ROOT_DIR, 'contents', 'themes')

// Files/patterns to process for placeholder replacement
// Note: .ts.template files will have the .template extension removed during copy
const FILES_TO_PROCESS = [
  'theme.config.ts.template',
  'app.config.ts.template',
  'dashboard.config.ts.template',
  'about.md',
  'permissions.config.ts.template',
  'messages/en.json',
  'messages/es.json',
  'docs/01-overview/01-introduction.md',
  'docs/01-overview/02-customization.md',
  'migrations/README.md',
  'migrations/001_example_schema.sql',
]

// Directories that should NOT copy .gitkeep files (they have real content now)
const SKIP_GITKEEP_IN = ['entities', 'blocks', 'templates', 'public', 'tests', 'docs', 'migrations']

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    themeName: null,
    description: 'A custom theme',
    author: 'Your Name',
    displayName: null,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[++i]

      switch (key) {
        case 'description':
        case 'd':
          result.description = value
          break
        case 'author':
        case 'a':
          result.author = value
          break
        case 'display-name':
          result.displayName = value
          break
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      const value = args[++i]

      switch (key) {
        case 'd':
          result.description = value
          break
        case 'a':
          result.author = value
          break
      }
    } else if (!result.themeName) {
      result.themeName = arg
    }
  }

  return result
}

/**
 * Convert theme name to different formats
 */
function formatThemeName(name) {
  // Slug: lowercase, hyphenated
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Display name: Title Case
  const displayName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Variable name: camelCase
  const varName = slug
    .split('-')
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('')

  return { slug, displayName, varName }
}

/**
 * Replace placeholders in content
 */
function replacePlaceholders(content, replacements) {
  let result = content

  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g')
    result = result.replace(regex, value)
  }

  return result
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest, replacements) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      // Always copy directories recursively (they now have real content)
      copyDir(srcPath, destPath, replacements)
    } else {
      // Skip .gitkeep files in directories that have real content
      if (entry.name === '.gitkeep') {
        const parentDir = path.relative(PRESET_DIR, src)
        if (SKIP_GITKEEP_IN.some((dir) => parentDir.startsWith(dir) || parentDir === dir)) {
          continue
        }
      }

      const relativePath = path.relative(PRESET_DIR, srcPath)

      // Process files that need placeholder replacement
      if (FILES_TO_PROCESS.includes(relativePath)) {
        const content = fs.readFileSync(srcPath, 'utf-8')
        const processed = replacePlaceholders(content, replacements)
        // Remove .template extension from destination path
        const finalDestPath = destPath.endsWith('.template')
          ? destPath.slice(0, -'.template'.length)
          : destPath
        fs.writeFileSync(finalDestPath, processed)
      } else if (entry.name.endsWith('.template')) {
        // Skip .template files that aren't in FILES_TO_PROCESS
        continue
      } else {
        // Copy as-is
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

/**
 * Print usage help
 */
function printHelp() {
  console.log(`
\x1b[1mCreate Theme Script\x1b[0m

Scaffolds a new theme from the preset template.

\x1b[1mUsage:\x1b[0m
  pnpm create:theme <theme-name> [options]

\x1b[1mOptions:\x1b[0m
  --description, -d    Theme description (default: "A custom theme")
  --author, -a         Theme author (default: "Your Name")
  --display-name       Display name (default: capitalized theme name)

\x1b[1mExamples:\x1b[0m
  pnpm create:theme my-app
  pnpm create:theme e-commerce --description "E-commerce platform" --author "John Doe"
  pnpm create:theme dashboard --display-name "Admin Dashboard"

\x1b[1mOutput:\x1b[0m
  Creates a new theme directory at: contents/themes/<theme-name>/
`)
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2)

  // Show help if no arguments or --help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  // Parse arguments
  const options = parseArgs(args)

  if (!options.themeName) {
    console.error('\x1b[31mError: Theme name is required\x1b[0m')
    printHelp()
    process.exit(1)
  }

  // Format theme name
  const { slug, displayName, varName } = formatThemeName(options.themeName)
  const finalDisplayName = options.displayName || displayName

  // Check if theme already exists
  const themeDir = path.join(THEMES_DIR, slug)
  if (fs.existsSync(themeDir)) {
    console.error(`\x1b[31mError: Theme "${slug}" already exists at ${themeDir}\x1b[0m`)
    process.exit(1)
  }

  // Check if preset exists
  if (!fs.existsSync(PRESET_DIR)) {
    console.error(`\x1b[31mError: Preset directory not found at ${PRESET_DIR}\x1b[0m`)
    process.exit(1)
  }

  // Prepare replacements
  const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const replacements = {
    THEME_SLUG: slug,
    THEME_DISPLAY_NAME: finalDisplayName,
    THEME_VAR_NAME: varName,
    THEME_DESCRIPTION: options.description,
    THEME_AUTHOR: options.author,
    THEME_VERSION: '1.0.0',
    CURRENT_DATE: currentDate,
  }

  console.log('\n\x1b[1m📦 Creating new theme...\x1b[0m\n')
  console.log(`  Name:        \x1b[36m${slug}\x1b[0m`)
  console.log(`  Display:     \x1b[36m${finalDisplayName}\x1b[0m`)
  console.log(`  Description: \x1b[36m${options.description}\x1b[0m`)
  console.log(`  Author:      \x1b[36m${options.author}\x1b[0m`)
  console.log(`  Location:    \x1b[36m${themeDir}\x1b[0m\n`)

  // Copy preset to themes directory
  try {
    copyDir(PRESET_DIR, themeDir, replacements)

    console.log('\x1b[32m✓ Theme created successfully!\x1b[0m\n')
    console.log('\x1b[1mNext steps:\x1b[0m')
    console.log(`  1. Edit \x1b[33mcontents/themes/${slug}/theme.config.ts\x1b[0m to customize colors`)
    console.log(`  2. Edit \x1b[33mcontents/themes/${slug}/app.config.ts\x1b[0m for app settings`)
    console.log(`  3. Update \x1b[33m.env.local\x1b[0m with: NEXT_PUBLIC_ACTIVE_THEME='${slug}'`)
    console.log(`  4. Run \x1b[33mpnpm dev\x1b[0m to see your theme\n`)

    console.log('\x1b[1mOptional:\x1b[0m')
    console.log(`  • Add entities in \x1b[33mentities/\x1b[0m`)
    console.log(`  • Add page builder blocks in \x1b[33mblocks/\x1b[0m`)
    console.log(`  • Add brand assets in \x1b[33mpublic/brand/\x1b[0m`)
    console.log(`  • Override templates in \x1b[33mtemplates/\x1b[0m\n`)
  } catch (error) {
    console.error(`\x1b[31mError creating theme: ${error.message}\x1b[0m`)
    process.exit(1)
  }
}

main()
