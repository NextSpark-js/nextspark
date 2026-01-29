#!/usr/bin/env node
/**
 * CI Workflows Setup Script
 *
 * Copies CI workflow templates from core/templates/ci-workflows/github/ to .github/workflows/
 *
 * Usage: npm run setup:ci
 *
 * Options:
 *   --force    Overwrite existing workflows
 *   --list     List available workflows without installing
 *   --help     Show help message
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Path from packages/core/scripts/setup/ to project root (4 levels up)
const ROOT_DIR = path.resolve(__dirname, '../../../..')

const SOURCE_DIR = path.join(ROOT_DIR, 'packages/core/templates/ci-workflows/github')
const TARGET_DIR = path.join(ROOT_DIR, '.github/workflows')

// Parse arguments
const args = process.argv.slice(2)
const flags = {
  force: args.includes('--force'),
  list: args.includes('--list'),
  help: args.includes('--help') || args.includes('-h'),
}

// Workflows to copy with descriptions
const AVAILABLE_WORKFLOWS = {
  'cypress-smoke.yml': {
    description: 'Smoke tests on PRs',
    trigger: 'Pull requests to main/develop',
  },
  'cypress-regression.yml': {
    description: 'Full regression suite',
    trigger: 'Nightly (2 AM UTC) + manual',
  },
}

// Show help
if (flags.help) {
  console.log(`
CI Workflows Setup Script

Copies CI workflow templates from core/templates/ci-workflows/github/ to .github/workflows/

Usage:
  npm run setup:ci [options]

Options:
  --force    Overwrite existing workflows
  --list     List available workflows without installing
  -h, --help Show this help message

Available Workflows:
`)
  for (const [file, info] of Object.entries(AVAILABLE_WORKFLOWS)) {
    console.log(`  ${file}`)
    console.log(`    ${info.description}`)
    console.log(`    Trigger: ${info.trigger}`)
    console.log('')
  }
  process.exit(0)
}

// List mode
if (flags.list) {
  console.log('\n📋 Available CI Workflows:\n')

  for (const [file, info] of Object.entries(AVAILABLE_WORKFLOWS)) {
    const targetPath = path.join(TARGET_DIR, file)
    const exists = fs.existsSync(targetPath)
    const status = exists ? '✓ installed' : '○ not installed'

    console.log(`  ${file} [${status}]`)
    console.log(`    ${info.description}`)
    console.log(`    Trigger: ${info.trigger}`)
    console.log('')
  }

  console.log(`Run 'npm run setup:ci' to install workflows.\n`)
  process.exit(0)
}

// Setup mode
console.log('\n🔧 CI Workflows Setup\n')

// Check source directory exists
if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`❌ Source directory not found: ${SOURCE_DIR}`)
  console.error(`   Make sure core/templates/ci-workflows/github/ exists.`)
  process.exit(1)
}

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true })
  console.log(`   Created ${path.relative(ROOT_DIR, TARGET_DIR)}/`)
}

// Track results
const results = {
  copied: [],
  skipped: [],
  overwritten: [],
  errors: [],
}

// Copy workflows
for (const [file, info] of Object.entries(AVAILABLE_WORKFLOWS)) {
  const src = path.join(SOURCE_DIR, file)
  const dest = path.join(TARGET_DIR, file)

  // Check source exists
  if (!fs.existsSync(src)) {
    results.errors.push({ file, error: 'Source file not found' })
    continue
  }

  // Check if destination exists
  const exists = fs.existsSync(dest)

  if (exists && !flags.force) {
    results.skipped.push(file)
    console.log(`   ⚠️  ${file} already exists - skipping`)
  } else {
    try {
      fs.copyFileSync(src, dest)
      if (exists) {
        results.overwritten.push(file)
        console.log(`   ✓ ${file} - overwritten`)
      } else {
        results.copied.push(file)
        console.log(`   ✓ ${file} - ${info.description}`)
      }
    } catch (error) {
      results.errors.push({ file, error: error.message })
      console.error(`   ❌ ${file} - ${error.message}`)
    }
  }
}

// Summary
console.log('\n📊 Summary:')
if (results.copied.length > 0) {
  console.log(`   ✓ ${results.copied.length} workflow(s) installed`)
}
if (results.overwritten.length > 0) {
  console.log(`   ✓ ${results.overwritten.length} workflow(s) overwritten`)
}
if (results.skipped.length > 0) {
  console.log(`   ⚠️  ${results.skipped.length} workflow(s) skipped (use --force to overwrite)`)
}
if (results.errors.length > 0) {
  console.log(`   ❌ ${results.errors.length} error(s)`)
}

// Next steps
if (results.copied.length > 0 || results.overwritten.length > 0) {
  console.log('\n✅ CI workflows setup complete!')
  console.log('   Review and customize workflows in .github/workflows/')
  console.log('\n📝 Recommended next steps:')
  console.log('   1. Set repository variable: ACTIVE_THEME (if not using default)')
  console.log('   2. Review workflow triggers and adjust as needed')
  console.log('   3. Configure required secrets (DATABASE_URL, etc.)')
}

console.log('')
process.exit(results.errors.length > 0 ? 1 : 0)
