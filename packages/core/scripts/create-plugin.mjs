#!/usr/bin/env node

/**
 * Create Plugin Script
 *
 * Scaffolds a new plugin from the preset template.
 *
 * Usage:
 *   node scripts/create-plugin.mjs <plugin-name> [options]
 *   pnpm create:plugin <plugin-name> [options]
 *
 * Options:
 *   --description, -d    Plugin description
 *   --author, -a         Plugin author
 *   --display-name       Display name (defaults to capitalized plugin name)
 *   --complexity, -c     Plugin complexity: utility | service | full (default: service)
 *
 * Examples:
 *   pnpm create:plugin analytics
 *   pnpm create:plugin payment-gateway --description "Payment processing" --author "John Doe"
 *   pnpm create:plugin notifications --complexity utility
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
const PRESET_DIR = path.join(ROOT_DIR, 'core', 'presets', 'plugin')
const PLUGINS_DIR = path.join(ROOT_DIR, 'contents', 'plugins')

// Files/patterns to process for placeholder replacement
const FILES_TO_PROCESS = [
  'plugin.config.ts.template',
  'README.md.template',
  '.env.example.template',
  'api/example/route.ts.template',
  'lib/core.ts.template',
  'lib/types.ts.template',
  'components/ExampleWidget.tsx.template',
  'hooks/usePlugin.ts.template',
  'tests/plugin.test.ts.template',
  'migrations/README.md',
  'messages/en.json',
  'messages/es.json',
]

// Files to rename after placeholder replacement
const FILES_TO_RENAME = {
  'hooks/usePlugin.ts': (varName) => `hooks/use${capitalize(varName)}.ts`,
  'components/ExampleWidget.tsx': (varName) => `components/${capitalize(varName)}Widget.tsx`,
}

// Directories that should NOT copy .gitkeep files
const SKIP_GITKEEP_IN = []

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    pluginName: null,
    description: 'A custom plugin',
    author: 'Your Name',
    displayName: null,
    complexity: 'service',
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
        case 'complexity':
        case 'c':
          if (['utility', 'service', 'full'].includes(value)) {
            result.complexity = value
          } else {
            console.warn(`\x1b[33mWarning: Invalid complexity "${value}". Using "service".\x1b[0m`)
          }
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
        case 'c':
          if (['utility', 'service', 'full'].includes(value)) {
            result.complexity = value
          }
          break
      }
    } else if (!result.pluginName) {
      result.pluginName = arg
    }
  }

  return result
}

/**
 * Convert plugin name to different formats
 */
function formatPluginName(name) {
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

  // Environment prefix: SCREAMING_SNAKE_CASE
  const envPrefix = slug.toUpperCase().replace(/-/g, '_') + '_PLUGIN'

  return { slug, displayName, varName, envPrefix }
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
function copyDir(src, dest, replacements, varName) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    let destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, replacements, varName)
    } else {
      // Skip .gitkeep files in specified directories
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
        if (destPath.endsWith('.template')) {
          destPath = destPath.slice(0, -'.template'.length)
        }

        // Check if file needs renaming
        const relativeDestPath = path.relative(dest, destPath)
        for (const [pattern, renameFn] of Object.entries(FILES_TO_RENAME)) {
          if (relativeDestPath === pattern || relativeDestPath.endsWith(pattern)) {
            const newName = renameFn(varName)
            const destDir = path.dirname(destPath)
            destPath = path.join(dest, newName)
            // Ensure directory exists
            if (!fs.existsSync(path.dirname(destPath))) {
              fs.mkdirSync(path.dirname(destPath), { recursive: true })
            }
            break
          }
        }

        fs.writeFileSync(destPath, processed)
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
\x1b[1mCreate Plugin Script\x1b[0m

Scaffolds a new plugin from the preset template.

\x1b[1mUsage:\x1b[0m
  pnpm create:plugin <plugin-name> [options]

\x1b[1mOptions:\x1b[0m
  --description, -d    Plugin description (default: "A custom plugin")
  --author, -a         Plugin author (default: "Your Name")
  --display-name       Display name (default: capitalized plugin name)
  --complexity, -c     Plugin complexity: utility | service | full (default: service)

\x1b[1mComplexity Levels:\x1b[0m
  utility    Functions only, no UI components
  service    API + components + hooks (default)
  full       Entities + migrations + API + UI

\x1b[1mExamples:\x1b[0m
  pnpm create:plugin analytics
  pnpm create:plugin payment-gateway --description "Payment processing" --author "John Doe"
  pnpm create:plugin notifications --complexity utility --display-name "Push Notifications"

\x1b[1mOutput:\x1b[0m
  Creates a new plugin directory at: contents/plugins/<plugin-name>/
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

  if (!options.pluginName) {
    console.error('\x1b[31mError: Plugin name is required\x1b[0m')
    printHelp()
    process.exit(1)
  }

  // Format plugin name
  const { slug, displayName, varName, envPrefix } = formatPluginName(options.pluginName)
  const finalDisplayName = options.displayName || displayName

  // Check if plugin already exists
  const pluginDir = path.join(PLUGINS_DIR, slug)
  if (fs.existsSync(pluginDir)) {
    console.error(`\x1b[31mError: Plugin "${slug}" already exists at ${pluginDir}\x1b[0m`)
    process.exit(1)
  }

  // Check if preset exists
  if (!fs.existsSync(PRESET_DIR)) {
    console.error(`\x1b[31mError: Preset directory not found at ${PRESET_DIR}\x1b[0m`)
    process.exit(1)
  }

  // Prepare replacements
  const currentDate = new Date().toISOString().split('T')[0]
  const replacements = {
    PLUGIN_SLUG: slug,
    PLUGIN_DISPLAY_NAME: finalDisplayName,
    PLUGIN_VAR_NAME: varName,
    PLUGIN_ENV_PREFIX: envPrefix,
    PLUGIN_DESCRIPTION: options.description,
    PLUGIN_AUTHOR: options.author,
    PLUGIN_VERSION: '1.0.0',
    CURRENT_DATE: currentDate,
  }

  console.log('\n\x1b[1m🔌 Creating new plugin...\x1b[0m\n')
  console.log(`  Name:        \x1b[36m${slug}\x1b[0m`)
  console.log(`  Display:     \x1b[36m${finalDisplayName}\x1b[0m`)
  console.log(`  Description: \x1b[36m${options.description}\x1b[0m`)
  console.log(`  Author:      \x1b[36m${options.author}\x1b[0m`)
  console.log(`  Complexity:  \x1b[36m${options.complexity}\x1b[0m`)
  console.log(`  Location:    \x1b[36m${pluginDir}\x1b[0m\n`)

  // Copy preset to plugins directory
  try {
    copyDir(PRESET_DIR, pluginDir, replacements, varName)

    console.log('\x1b[32m✓ Plugin created successfully!\x1b[0m\n')
    console.log('\x1b[1mNext steps:\x1b[0m')
    console.log(`  1. Edit \x1b[33mcontents/plugins/${slug}/plugin.config.ts\x1b[0m to configure exports`)
    console.log(`  2. Implement your plugin logic in \x1b[33mlib/core.ts\x1b[0m`)
    console.log(`  3. Copy \x1b[33m.env.example\x1b[0m to \x1b[33m.env\x1b[0m and configure variables`)
    console.log(`  4. Run \x1b[33mnode scripts/build-registry.mjs\x1b[0m to register the plugin`)
    console.log(`  5. Run \x1b[33mpnpm dev\x1b[0m to test your plugin\n`)

    console.log('\x1b[1mPlugin Structure:\x1b[0m')
    console.log(`  • \x1b[33mplugin.config.ts\x1b[0m  - Plugin configuration and exports`)
    console.log(`  • \x1b[33mlib/core.ts\x1b[0m       - Core plugin logic`)
    console.log(`  • \x1b[33mlib/types.ts\x1b[0m      - TypeScript type definitions`)
    console.log(`  • \x1b[33mapi/example/\x1b[0m      - API endpoints`)
    console.log(`  • \x1b[33mcomponents/\x1b[0m       - React components`)
    console.log(`  • \x1b[33mhooks/\x1b[0m            - Custom React hooks`)
    console.log(`  • \x1b[33mmessages/\x1b[0m         - i18n translations\n`)

    console.log('\x1b[1mTesting in plugin-sandbox theme:\x1b[0m')
    console.log(`  Add your plugin to the sandbox theme's plugins array:`)
    console.log(`  \x1b[33mcontents/themes/plugin-sandbox/theme.config.ts\x1b[0m`)
    console.log(`  \x1b[90mplugins: ['${slug}']\x1b[0m\n`)
  } catch (error) {
    console.error(`\x1b[31mError creating plugin: ${error.message}\x1b[0m`)
    process.exit(1)
  }
}

main()
