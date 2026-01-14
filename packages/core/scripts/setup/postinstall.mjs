#!/usr/bin/env node

/**
 * Postinstall Setup Script
 *
 * Runs automatically after `pnpm install` to generate all required files.
 * This ensures the project is ready to use immediately after installation.
 *
 * Generated files:
 * - tsconfig.json (from tsconfig.base.json + dynamic theme exclusions)
 * - core/lib/registries/*.ts (entity, theme, plugin registries)
 * - public/theme/* (theme assets)
 *
 * Usage: node core/scripts/setup/postinstall.mjs
 *        (or automatically via package.json postinstall hook)
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Detect if running from npm package or monorepo
// When installed via npm: node_modules/@nextsparkjs/core/scripts/setup/postinstall.mjs
// When in monorepo: packages/core/scripts/setup/postinstall.mjs
function detectPaths() {
  // Check if we're in node_modules (npm install context)
  const isNpmPackage = __dirname.includes('node_modules')

  if (isNpmPackage) {
    // Find project root by looking for package.json going up from cwd
    let projectRoot = process.cwd()
    while (projectRoot !== '/' && !fs.existsSync(path.join(projectRoot, 'package.json'))) {
      projectRoot = path.dirname(projectRoot)
    }
    // Scripts are in the npm package directory
    const scriptsDir = path.join(__dirname, '..', 'build')
    return { rootDir: projectRoot, scriptsDir }
  } else {
    // Monorepo context: 4 levels up from packages/core/scripts/setup/
    const rootDir = path.join(__dirname, '..', '..', '..', '..')
    const scriptsDir = path.join(rootDir, 'packages/core/scripts/build')
    return { rootDir, scriptsDir }
  }
}

const { rootDir: ROOT_DIR, scriptsDir: SCRIPTS_DIR } = detectPaths()

/**
 * Run a script and return a promise
 */
function runScript(scriptPath, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Running ${name}...`)

    const child = spawn('node', [scriptPath], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${name} failed with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(new Error(`${name} error: ${err.message}`))
    })
  })
}

/**
 * Check if .env file exists, create from example if not
 */
function ensureEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env')
  const envExamplePath = path.join(ROOT_DIR, '.env.example')

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      console.log('📄 Creating .env from .env.example...')
      fs.copyFileSync(envExamplePath, envPath)
      console.log('   ⚠️  Please update .env with your configuration')
    } else {
      console.log('⚠️  No .env file found. Some scripts may not work correctly.')
      console.log('   Create a .env file with NEXT_PUBLIC_ACTIVE_THEME=default')
    }
  }
}

/**
 * Main setup function
 */
async function setup() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 Running postinstall setup...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Ensure .env exists
  ensureEnvFile()

  const scripts = [
    { path: path.join(SCRIPTS_DIR, 'update-tsconfig.mjs'), name: 'TSConfig Generator' },
    { path: path.join(SCRIPTS_DIR, 'registry.mjs'), name: 'Registry Generator' },
    { path: path.join(SCRIPTS_DIR, 'theme.mjs'), name: 'Theme Builder' },
  ]

  let hasErrors = false

  for (const script of scripts) {
    if (!fs.existsSync(script.path)) {
      console.warn(`⚠️  Script not found: ${script.path}`)
      continue
    }

    try {
      await runScript(script.path, script.name)
    } catch (error) {
      console.error(`❌ ${error.message}`)
      hasErrors = true
      // Continue with other scripts even if one fails
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (hasErrors) {
    console.log('⚠️  Setup completed with errors')
    console.log('   Some generated files may be missing.')
    console.log('   Run `pnpm dev` to regenerate them.')
  } else {
    console.log('✅ Setup completed successfully!')
    console.log('')
    console.log('Generated files:')
    console.log('  • tsconfig.json')
    console.log('  • core/lib/registries/*.ts')
    console.log('  • public/theme/*')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
}

// Run setup
setup().catch((error) => {
  console.error('❌ Setup failed:', error)
  process.exit(1)
})
