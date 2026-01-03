#!/usr/bin/env node

/**
 * NextSpark CLI
 *
 * Commands:
 *   nextspark dev      - Start development with watchers
 *   nextspark build    - Build for production
 *   nextspark generate - Regenerate app structure
 *
 * Usage:
 *   npx nextspark dev
 *   npx nextspark build
 *   npx nextspark generate
 */

import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const command = process.argv[2]
const projectRoot = process.cwd()

/**
 * Spawn a child process and return a promise
 *
 * @param {string} cmd - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<number>} Exit code
 */
function spawnAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true,
      ...options
    })

    child.on('error', (err) => {
      reject(err)
    })

    child.on('close', (code) => {
      resolve(code)
    })
  })
}

/**
 * Dev command - Start development with watchers
 */
async function dev() {
  console.log('🚀 Starting NextSpark development...')
  console.log('')

  try {
    // 1. Initial build
    console.log('🔧 Initial build...')
    const { buildRegistries } = await import('../scripts/build/registry.mjs')
    const { buildTheme } = await import('../scripts/build/theme.mjs')

    await buildRegistries(projectRoot)
    await buildTheme(projectRoot)

    console.log('')
    console.log('✅ Initial build complete')
    console.log('')

    // 2. Start Next.js dev server
    // Note: In full implementation, would also start watchers
    // For now, we'll use Next.js built-in watch capabilities
    console.log('🌐 Starting Next.js dev server...')
    console.log('')

    const exitCode = await spawnAsync('npx', ['next', 'dev'])
    process.exit(exitCode)

  } catch (err) {
    console.error('❌ Failed to start development server:', err.message)
    process.exit(1)
  }
}

/**
 * Build command - Build for production
 */
async function build() {
  console.log('🔨 Building NextSpark for production...')
  console.log('')

  try {
    // 1. Build registries
    console.log('🔧 Building registries...')
    const { buildRegistries } = await import('../scripts/build/registry.mjs')
    await buildRegistries(projectRoot)

    // 2. Build theme
    console.log('🎨 Building theme...')
    const { buildTheme } = await import('../scripts/build/theme.mjs')
    await buildTheme(projectRoot)

    // 3. Generate app (ensure latest)
    console.log('📁 Generating app structure...')
    const { generateApp } = await import('../scripts/generate-app.mjs')
    await generateApp(projectRoot)

    console.log('')
    console.log('✅ Pre-build complete')
    console.log('')

    // 4. Run Next.js build
    console.log('📦 Building Next.js app...')
    console.log('')

    const exitCode = await spawnAsync('npx', ['next', 'build'])

    if (exitCode === 0) {
      console.log('')
      console.log('✅ Build completed successfully!')
    } else {
      console.error('')
      console.error('❌ Build failed')
      process.exit(exitCode)
    }

  } catch (err) {
    console.error('❌ Build failed:', err.message)
    process.exit(1)
  }
}

/**
 * Generate command - Regenerate app structure
 */
async function generate() {
  console.log('📁 Regenerating app structure...')
  console.log('')

  try {
    const { generateApp } = await import('../scripts/generate-app.mjs')
    await generateApp(projectRoot)

    console.log('')
    console.log('✅ Done!')

  } catch (err) {
    console.error('❌ Generation failed:', err.message)
    process.exit(1)
  }
}

/**
 * Help command - Show usage information
 */
function showHelp() {
  console.log(`
NextSpark CLI

Usage:
  nextspark <command>

Commands:
  dev       Start development server with watchers
  build     Build for production
  generate  Regenerate app structure from templates

Examples:
  npx nextspark dev
  npx nextspark build
  npx nextspark generate

Options:
  -h, --help     Show this help message

Environment Variables:
  NEXTSPARK_DEBUG    Enable debug output
  NEXT_PUBLIC_ACTIVE_THEME    Set active theme (default: default)
`)
}

// Command router
switch (command) {
  case 'dev':
    dev()
    break
  case 'build':
    build()
    break
  case 'generate':
    generate()
    break
  case '-h':
  case '--help':
  case 'help':
    showHelp()
    break
  default:
    if (!command) {
      showHelp()
    } else {
      console.error(`Unknown command: ${command}`)
      console.error('')
      showHelp()
      process.exit(1)
    }
}
