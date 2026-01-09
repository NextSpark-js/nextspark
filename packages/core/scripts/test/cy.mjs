#!/usr/bin/env node
/**
 * Cypress Theme Runner
 *
 * Cross-platform script to run Cypress with theme-specific configuration.
 * Uses NEXT_PUBLIC_ACTIVE_THEME to determine which theme's cypress.config.ts to use.
 *
 * Usage:
 *   pnpm cy:open                              - Open Cypress UI
 *   pnpm cy:run                               - Run tests headless
 *   pnpm cy:run --spec "auth/login.cy.ts"     - Run specific spec (auto-resolves path)
 *   pnpm cy:run --spec "/auth/login.cy.ts"    - Same with leading slash
 *   pnpm cy:tags "@smoke"                     - Run tests filtered by tag
 *
 * Spec Path Resolution:
 *   The --spec argument is automatically resolved to the active theme's test directory.
 *   Instead of: --spec "themes/default/tests/cypress/e2e/auth/login.cy.ts"
 *   Just use:   --spec "auth/login.cy.ts"
 *
 * Supports both:
 *   - Monorepo mode: themes/{ACTIVE_THEME}/tests/cypress.config.ts
 *   - NPM mode: contents/themes/{ACTIVE_THEME}/tests/cypress.config.ts
 */

import { spawn, execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

const theme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
let cmd = process.argv[2] || 'open'
const port = process.env.PORT || 5173

// Handle 'tags' command - convert to 'run' with grepTags env
let extraArgs = []
if (cmd === 'tags') {
  const tag = process.argv[3]
  if (!tag) {
    console.error('\x1b[31mError: Tag argument required\x1b[0m')
    console.error('Usage: pnpm cy:tags "@smoke"')
    process.exit(1)
  }
  cmd = 'run'
  extraArgs = ['--env', `grepTags=${tag}`]
  // Shift remaining args
  process.argv.splice(3, 1)
}

// Detect monorepo vs NPM mode
const monorepoPath = `themes/${theme}/tests/cypress.config.ts`
const npmPath = `contents/themes/${theme}/tests/cypress.config.ts`
const isMonorepo = existsSync(resolve(process.cwd(), monorepoPath))
const isNpmMode = existsSync(resolve(process.cwd(), npmPath))

// Handle 'e2e' command - full test suite with server
if (cmd === 'e2e') {
  console.log(`\x1b[36m🧪 Running E2E tests for theme: ${theme}\x1b[0m`)
  console.log(`Server port: ${port}\n`)

  // Build test entities first
  console.log(`\x1b[33m📦 Building test entities...\x1b[0m`)
  execSync('node scripts/build-test-entities.mjs', { stdio: 'inherit' })

  // Start server and run cypress
  console.log(`\n\x1b[33m🚀 Starting server and running tests...\x1b[0m`)
  execSync(`npx start-server-and-test 'pnpm dev' http://localhost:${port} 'node core/scripts/test/cy.mjs run'`, {
    stdio: 'inherit',
    shell: true
  })

  process.exit(0)
}

// Determine config path based on mode
const configPath = isMonorepo ? monorepoPath : npmPath
const absoluteConfigPath = resolve(process.cwd(), configPath)
const themesBase = isMonorepo ? 'themes' : 'contents/themes'
const allureResultsPath = resolve(process.cwd(), `${themesBase}/${theme}/tests/cypress/allure-results`)

// ============================================================================
// SPEC PATH RESOLUTION
// ============================================================================
// Automatically resolve short spec paths to full theme paths
// Example: "auth/login.cy.ts" -> "themes/default/tests/cypress/e2e/auth/login.cy.ts"

/**
 * Resolve a spec path to the full theme path
 * @param {string} specPath - The spec path from --spec argument
 * @returns {string} - The resolved full path
 */
function resolveSpecPath(specPath) {
  // If path already contains the theme base, return as-is
  if (specPath.includes(`${themesBase}/${theme}/tests/cypress/e2e/`)) {
    return specPath
  }

  // If path starts with full theme path pattern, return as-is
  if (specPath.startsWith('themes/') || specPath.startsWith('contents/themes/')) {
    return specPath
  }

  // Remove leading slash if present
  const cleanPath = specPath.startsWith('/') ? specPath.slice(1) : specPath

  // Build the full path
  const fullPath = `${themesBase}/${theme}/tests/cypress/e2e/${cleanPath}`

  return fullPath
}

/**
 * Process CLI args and resolve any --spec paths
 * @param {string[]} args - Original CLI arguments
 * @returns {string[]} - Processed arguments with resolved spec paths
 */
function processSpecArgs(args) {
  const processed = [...args]

  for (let i = 0; i < processed.length; i++) {
    if (processed[i] === '--spec' && processed[i + 1]) {
      const originalSpec = processed[i + 1]
      const resolvedSpec = resolveSpecPath(originalSpec)

      if (originalSpec !== resolvedSpec) {
        console.log(`\x1b[33m📂 Spec path resolved:\x1b[0m`)
        console.log(`   ${originalSpec} → ${resolvedSpec}\n`)
      }

      processed[i + 1] = resolvedSpec
    }
  }

  return processed
}

// Validate config file exists
if (!existsSync(absoluteConfigPath)) {
  console.error(`\x1b[31mError: Cypress config not found for theme "${theme}"\x1b[0m`)
  console.error(`Expected: ${configPath}`)
  console.error(`\nMake sure the theme has a tests/cypress.config.ts file.`)
  process.exit(1)
}

// Clean allure-results folder before running tests (only for 'run' command)
if (cmd === 'run' && existsSync(allureResultsPath)) {
  console.log(`\x1b[33m🧹 Cleaning allure-results folder...\x1b[0m`)
  rmSync(allureResultsPath, { recursive: true, force: true })
}

console.log(`\x1b[36mRunning Cypress for theme: ${theme}\x1b[0m`)
console.log(`Config: ${configPath}\n`)

// Build args array - include any additional CLI args passed
// Process spec paths to resolve short paths to full theme paths
const cliArgs = processSpecArgs([...extraArgs, ...process.argv.slice(3)])
const args = ['cypress', cmd, '--config-file', configPath, ...cliArgs]

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32' // Only use shell on Windows
})

child.on('close', (code) => {
  process.exit(code)
})
