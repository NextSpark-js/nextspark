#!/usr/bin/env node
/**
 * Cypress Theme Runner
 *
 * Cross-platform script to run Cypress with theme-specific configuration.
 * Uses NEXT_PUBLIC_ACTIVE_THEME to determine which theme's cypress.config.ts to use.
 *
 * Usage:
 *   pnpm cy:open  - Open Cypress UI
 *   pnpm cy:run   - Run tests headless
 *
 * The script looks for cypress.config.ts at:
 *   contents/themes/{ACTIVE_THEME}/tests/cypress.config.ts
 */

import { spawn, execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

const theme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const cmd = process.argv[2] || 'open'
const port = process.env.PORT || 5173

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

const configPath = `contents/themes/${theme}/tests/cypress.config.ts`
const absoluteConfigPath = resolve(process.cwd(), configPath)
const allureResultsPath = resolve(process.cwd(), `contents/themes/${theme}/tests/cypress/allure-results`)

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
const args = ['cypress', cmd, '--config-file', configPath, ...process.argv.slice(3)]

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32' // Only use shell on Windows
})

child.on('close', (code) => {
  process.exit(code)
})
