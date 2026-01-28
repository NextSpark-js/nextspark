#!/usr/bin/env npx tsx
/**
 * validate-versions.ts - Pre-publish version validation
 *
 * Validates that all package versions are consistent before publishing.
 *
 * Checks:
 * 1. All package.json versions match (except mobile/ui)
 * 2. Inter-package dependencies use the same version
 * 3. No hardcoded versions in .ts files (warning)
 *
 * Exit codes:
 * - 0: All validations passed
 * - 1: Critical errors found
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')

// ANSI colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'

// Packages to validate (should have matching versions)
const VERSIONED_PACKAGES = [
  'packages/core',
  'packages/cli',
  'packages/create-nextspark-app',
  'packages/testing',
]

// Packages excluded from version matching (can have different versions)
const EXCLUDED_PACKAGES = [
  'packages/mobile',
  'packages/ui',
]

// @nextsparkjs/* packages that should use consistent versions
const NEXTSPARK_PACKAGES = [
  '@nextsparkjs/core',
  '@nextsparkjs/cli',
  '@nextsparkjs/testing',
]

interface ValidationResult {
  errors: string[]
  warnings: string[]
}

function readPackageJson(pkgPath: string): { name: string; version: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null {
  const fullPath = join(REPO_ROOT, pkgPath, 'package.json')
  if (!existsSync(fullPath)) {
    return null
  }
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

/**
 * Check 1: All versioned packages have the same version
 */
function validateVersionConsistency(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const versions: Map<string, string> = new Map()

  console.log(`${CYAN}Checking version consistency...${NC}`)

  for (const pkgPath of VERSIONED_PACKAGES) {
    const pkg = readPackageJson(pkgPath)
    if (!pkg) {
      warnings.push(`Package not found: ${pkgPath}`)
      continue
    }
    versions.set(pkgPath, pkg.version)
    console.log(`  ${pkg.name}: ${pkg.version}`)
  }

  // Check all versions match
  const uniqueVersions = new Set(versions.values())
  if (uniqueVersions.size > 1) {
    errors.push(`Version mismatch detected:`)
    for (const [pkg, version] of versions) {
      errors.push(`  - ${pkg}: ${version}`)
    }
  }

  return { errors, warnings }
}

/**
 * Check 2: Inter-package dependencies use correct versions
 */
function validateInterPackageDependencies(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  console.log(`${CYAN}Checking inter-package dependencies...${NC}`)

  // Get the expected version from core
  const corePkg = readPackageJson('packages/core')
  if (!corePkg) {
    errors.push('Could not read @nextsparkjs/core package.json')
    return { errors, warnings }
  }
  const expectedVersion = corePkg.version

  // Check all packages for @nextsparkjs/* dependencies
  const allPackages = [...VERSIONED_PACKAGES, ...EXCLUDED_PACKAGES]

  for (const pkgPath of allPackages) {
    const pkg = readPackageJson(pkgPath)
    if (!pkg) continue

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }

    for (const [depName, depVersion] of Object.entries(allDeps)) {
      // Skip workspace references (they're fine)
      if (depVersion === 'workspace:*') continue

      // Check @nextsparkjs/* dependencies
      if (NEXTSPARK_PACKAGES.includes(depName)) {
        // Parse the version (remove ^ or ~)
        const cleanVersion = depVersion.replace(/^[\^~]/, '')

        // For publish dependencies, we expect ^{version} format
        if (!depVersion.startsWith('^')) {
          warnings.push(`${pkg.name}: ${depName} should use caret range (^${cleanVersion})`)
        }

        // Check if version is outdated
        if (cleanVersion !== expectedVersion) {
          errors.push(`${pkg.name}: ${depName}@${depVersion} should be ^${expectedVersion}`)
        }
      }
    }
  }

  return { errors, warnings }
}

/**
 * Get all .ts files in a directory recursively
 */
function getTsFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...getTsFiles(fullPath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Check 3: No hardcoded versions in .ts files
 */
function validateNoHardcodedVersions(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  console.log(`${CYAN}Checking for hardcoded versions in source files...${NC}`)

  // Pattern to find .version('x.x.x') calls
  const versionPattern = /\.version\s*\(\s*['"`](\d+\.\d+\.\d+[^'"`]*)['"`]\s*\)/g

  // Search in CLI packages
  const searchDirs = [
    join(REPO_ROOT, 'packages/cli/src'),
    join(REPO_ROOT, 'packages/create-nextspark-app/src'),
  ]

  for (const dir of searchDirs) {
    const files = getTsFiles(dir)

    for (const fullPath of files) {
      const content = readFileSync(fullPath, 'utf-8')
      const relativePath = fullPath.replace(REPO_ROOT + '/', '')

      let match
      while ((match = versionPattern.exec(content)) !== null) {
        warnings.push(`Hardcoded version found: ${relativePath} -> .version('${match[1]}')`)
      }
    }
  }

  return { errors, warnings }
}

/**
 * Main validation runner
 */
async function main() {
  console.log()
  console.log(`${CYAN}========================================${NC}`)
  console.log(`${CYAN}  NextSpark - Version Validation${NC}`)
  console.log(`${CYAN}========================================${NC}`)
  console.log()

  const allErrors: string[] = []
  const allWarnings: string[] = []

  // Run all validations
  const check1 = validateVersionConsistency()
  allErrors.push(...check1.errors)
  allWarnings.push(...check1.warnings)
  console.log()

  const check2 = validateInterPackageDependencies()
  allErrors.push(...check2.errors)
  allWarnings.push(...check2.warnings)
  console.log()

  const check3 = validateNoHardcodedVersions()
  allErrors.push(...check3.errors)
  allWarnings.push(...check3.warnings)
  console.log()

  // Print summary
  console.log(`${CYAN}========================================${NC}`)
  console.log(`${CYAN}  Validation Summary${NC}`)
  console.log(`${CYAN}========================================${NC}`)
  console.log()

  if (allWarnings.length > 0) {
    console.log(`${YELLOW}Warnings (${allWarnings.length}):${NC}`)
    for (const warning of allWarnings) {
      console.log(`  ${YELLOW}⚠${NC} ${warning}`)
    }
    console.log()
  }

  if (allErrors.length > 0) {
    console.log(`${RED}Errors (${allErrors.length}):${NC}`)
    for (const error of allErrors) {
      console.log(`  ${RED}✗${NC} ${error}`)
    }
    console.log()
    console.log(`${RED}Validation FAILED${NC}`)
    console.log(`Fix the errors above before publishing.`)
    process.exit(1)
  }

  console.log(`${GREEN}✓ All validations passed${NC}`)
  console.log()
  process.exit(0)
}

main().catch((err) => {
  console.error(`${RED}Unexpected error:${NC}`, err)
  process.exit(1)
})
