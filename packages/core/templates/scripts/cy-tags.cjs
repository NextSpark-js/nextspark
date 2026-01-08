#!/usr/bin/env node
/**
 * Cypress Tags Runner
 *
 * A wrapper script that converts --tags to --env grepTags for @cypress/grep
 *
 * Usage:
 *   pnpm cy:tags "@smoke"           # Run tests with @smoke tag
 *   pnpm cy:tags "@P0+@auth"        # Run tests with @P0 AND @auth tags
 *   pnpm cy:tags "@smoke @auth"     # Run tests with @smoke OR @auth tags
 *   pnpm cy:tags "-@slow"           # Exclude tests with @slow tag
 *   pnpm cy:tags "@smoke" --headed  # Run with browser visible
 */

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Get arguments after script name
const args = process.argv.slice(2)

// First argument is the tag(s), rest are additional cypress args
const tags = args[0] || ''
const extraArgs = args.slice(1)

// Find the active theme's cypress config
function findCypressConfig() {
  const contentsDir = path.join(process.cwd(), 'contents', 'themes')

  if (!fs.existsSync(contentsDir)) {
    console.error('Error: contents/themes directory not found')
    process.exit(1)
  }

  const themes = fs.readdirSync(contentsDir).filter((name) => {
    const themePath = path.join(contentsDir, name)
    return fs.statSync(themePath).isDirectory()
  })

  // Check NEXT_PUBLIC_ACTIVE_THEME env var first
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  if (activeTheme && themes.includes(activeTheme)) {
    const configPath = path.join(contentsDir, activeTheme, 'tests', 'cypress.config.ts')
    if (fs.existsSync(configPath)) {
      return configPath
    }
  }

  // Otherwise use the first theme found
  for (const theme of themes) {
    const configPath = path.join(contentsDir, theme, 'tests', 'cypress.config.ts')
    if (fs.existsSync(configPath)) {
      return configPath
    }
  }

  console.error('Error: No cypress.config.ts found in any theme')
  process.exit(1)
}

const configFile = findCypressConfig()

// Build cypress arguments
const cypressArgs = ['cypress', 'run', '--config-file', configFile]

if (tags) {
  cypressArgs.push('--env', `grepTags=${tags}`)
}

// Add any extra arguments
cypressArgs.push(...extraArgs)

console.log(`Running: npx ${cypressArgs.join(' ')}`)

// Execute cypress
const result = spawnSync('npx', cypressArgs, {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
})

process.exit(result.status || 0)
