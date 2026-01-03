#!/usr/bin/env node
/**
 * Jest Theme Runner
 *
 * Runs Jest tests for the active theme (determined by NEXT_PUBLIC_ACTIVE_THEME).
 * Provides consistent UX with cy.mjs for Cypress tests.
 *
 * Usage:
 *   pnpm test:theme                    # Run tests for active theme
 *   pnpm test:theme -- --watch         # Watch mode
 *   pnpm test:theme -- --coverage      # With coverage
 *   pnpm test:theme -- people.test.ts  # Specific test file
 *
 *   NEXT_PUBLIC_ACTIVE_THEME=team-manager pnpm test:theme
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

const theme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const cmd = process.argv[2] || 'run'

const configPath = `contents/themes/${theme}/tests/jest/jest.config.ts`
const absoluteConfigPath = resolve(process.cwd(), configPath)

if (!existsSync(absoluteConfigPath)) {
  console.error(`\x1b[31mError: Jest config not found for theme "${theme}"\x1b[0m`)
  console.error(`Expected: ${configPath}`)
  console.error(`\nMake sure the theme has a Jest configuration at:`)
  console.error(`  contents/themes/${theme}/tests/jest/jest.config.ts`)
  process.exit(1)
}

console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
console.log(`\x1b[36m  Jest Theme Runner\x1b[0m`)
console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
console.log(`  Theme:  \x1b[33m${theme}\x1b[0m`)
console.log(`  Config: \x1b[90m${configPath}\x1b[0m`)
console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`)

// Build Jest arguments
const args = ['jest', '--config', configPath, ...process.argv.slice(2)]

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NEXT_PUBLIC_ACTIVE_THEME: theme,
  },
})

child.on('error', (error) => {
  console.error(`\x1b[31mFailed to start Jest: ${error.message}\x1b[0m`)
  process.exit(1)
})

child.on('close', (code) => process.exit(code ?? 0))
