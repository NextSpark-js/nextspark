#!/usr/bin/env node
/**
 * Jest Theme Runner
 *
 * Cross-platform script to run Jest with theme-specific configuration.
 * Uses NEXT_PUBLIC_ACTIVE_THEME to determine which theme's jest.config.cjs to use.
 *
 * Usage:
 *   pnpm test:theme                    - Run all theme tests
 *   pnpm test:theme -- --watch         - Run in watch mode
 *   pnpm test:theme -- path/to/test    - Run specific test
 *
 * Supports both:
 *   - Monorepo mode: themes/{ACTIVE_THEME}/tests/jest/jest.config.cjs
 *   - NPM mode: contents/themes/{ACTIVE_THEME}/tests/jest/jest.config.cjs
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

const theme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

// Detect monorepo vs NPM mode
const monorepoPath = `themes/${theme}/tests/jest/jest.config.cjs`
const npmPath = `contents/themes/${theme}/tests/jest/jest.config.cjs`
const isMonorepo = existsSync(resolve(process.cwd(), monorepoPath))
const isNpmMode = existsSync(resolve(process.cwd(), npmPath))

// Determine config path based on mode
const configPath = isMonorepo ? monorepoPath : npmPath
const absoluteConfigPath = resolve(process.cwd(), configPath)

// Validate config file exists
if (!existsSync(absoluteConfigPath)) {
  console.error(`\x1b[31mError: Jest config not found for theme "${theme}"\x1b[0m`)
  console.error(`Expected: ${configPath}`)
  console.error(`\nMake sure the theme has a tests/jest/jest.config.cjs file.`)
  process.exit(1)
}

console.log(`\x1b[36mRunning Jest for theme: ${theme}\x1b[0m`)
console.log(`Config: ${configPath}\n`)

// Build args array - include any additional CLI args passed
const cliArgs = process.argv.slice(2)
const args = ['--config', absoluteConfigPath, ...cliArgs]

// Determine working directory
// In monorepo: run from packages/core where jest is installed
// In npm mode: run from project root
const cwd = isMonorepo
  ? resolve(process.cwd(), 'packages/core')
  : process.cwd()

const child = spawn('npx', ['jest', ...args], {
  stdio: 'inherit',
  cwd,
  shell: process.platform === 'win32' // Only use shell on Windows
})

child.on('close', (code) => {
  process.exit(code)
})
