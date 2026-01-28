#!/usr/bin/env npx tsx
/**
 * sync-templates.ts - Sync apps/dev/app with packages/core/templates/app
 *
 * Source of Truth:
 *   apps/dev/app/           <- SOURCE (development)
 *   packages/core/templates/app/ <- DISTRIBUTION (packaged)
 *
 * Usage:
 *   pnpm sync:templates          # Interactive mode - shows diff and asks to sync
 *   pnpm sync:templates --sync   # Copy from apps/dev → templates
 *   pnpm sync:templates --check  # Check only (for CI) - exits 1 if out of sync
 *
 * Exit codes:
 *   0: Templates are in sync (or sync completed)
 *   1: Templates are out of sync (--check mode)
 */

import { readFileSync, existsSync, statSync, readdirSync, cpSync, rmSync, mkdirSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')

// Paths
const SOURCE_DIR = join(REPO_ROOT, 'apps/dev/app')
const TARGET_DIR = join(REPO_ROOT, 'packages/core/templates/app')

// ANSI colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const NC = '\x1b[0m'

// Files/directories to exclude from sync
const EXCLUDE_PATTERNS = [
  '.DS_Store',
  'node_modules',
  '.next',
  '.turbo',
  // Development-only files that shouldn't be in templates
  '(templates)', // Template examples directory
]

interface FileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted'
  sourceHash?: string
  targetHash?: string
}

/**
 * Check if a path should be excluded from sync
 */
function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      // Simple glob matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(filePath)
    }
    return filePath.includes(pattern)
  })
}

/**
 * Calculate MD5 hash of a file
 */
function getFileHash(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('md5').update(content).digest('hex')
}

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = relative(baseDir, fullPath)

    if (shouldExclude(relativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      files.push(relativePath)
    }
  }

  return files
}

/**
 * Compare source and target directories
 */
function compareDirectories(): FileDiff[] {
  const diffs: FileDiff[] = []

  const sourceFiles = new Set(getAllFiles(SOURCE_DIR))
  const targetFiles = new Set(getAllFiles(TARGET_DIR))

  // Check for new and modified files
  for (const file of sourceFiles) {
    const sourcePath = join(SOURCE_DIR, file)
    const targetPath = join(TARGET_DIR, file)

    if (!targetFiles.has(file)) {
      diffs.push({ path: file, status: 'added' })
    } else {
      const sourceHash = getFileHash(sourcePath)
      const targetHash = getFileHash(targetPath)

      if (sourceHash !== targetHash) {
        diffs.push({ path: file, status: 'modified', sourceHash, targetHash })
      }
    }
  }

  // Check for deleted files
  for (const file of targetFiles) {
    if (!sourceFiles.has(file)) {
      diffs.push({ path: file, status: 'deleted' })
    }
  }

  return diffs
}

/**
 * Sync source to target
 */
function syncTemplates(diffs: FileDiff[]): void {
  console.log(`${CYAN}Syncing templates...${NC}`)

  for (const diff of diffs) {
    const sourcePath = join(SOURCE_DIR, diff.path)
    const targetPath = join(TARGET_DIR, diff.path)

    switch (diff.status) {
      case 'added':
      case 'modified':
        // Ensure parent directory exists
        mkdirSync(dirname(targetPath), { recursive: true })
        cpSync(sourcePath, targetPath)
        console.log(`  ${GREEN}+${NC} ${diff.path}`)
        break
      case 'deleted':
        if (existsSync(targetPath)) {
          rmSync(targetPath)
          console.log(`  ${RED}-${NC} ${diff.path}`)
        }
        break
    }
  }

  // Clean up empty directories in target
  cleanEmptyDirs(TARGET_DIR)

  console.log(`${GREEN}✓ Sync complete${NC}`)
}

/**
 * Remove empty directories recursively
 */
function cleanEmptyDirs(dir: string): boolean {
  if (!existsSync(dir)) return true

  const entries = readdirSync(dir, { withFileTypes: true })
  let isEmpty = true

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!cleanEmptyDirs(fullPath)) {
        isEmpty = false
      }
    } else {
      isEmpty = false
    }
  }

  if (isEmpty && dir !== TARGET_DIR) {
    rmSync(dir, { recursive: true })
  }

  return isEmpty
}

/**
 * Print diff summary
 */
function printDiff(diffs: FileDiff[]): void {
  const added = diffs.filter(d => d.status === 'added')
  const modified = diffs.filter(d => d.status === 'modified')
  const deleted = diffs.filter(d => d.status === 'deleted')

  if (added.length > 0) {
    console.log(`${GREEN}New files (${added.length}):${NC}`)
    for (const diff of added.slice(0, 10)) {
      console.log(`  ${GREEN}+${NC} ${diff.path}`)
    }
    if (added.length > 10) {
      console.log(`  ${DIM}... and ${added.length - 10} more${NC}`)
    }
    console.log()
  }

  if (modified.length > 0) {
    console.log(`${YELLOW}Modified files (${modified.length}):${NC}`)
    for (const diff of modified.slice(0, 10)) {
      console.log(`  ${YELLOW}~${NC} ${diff.path}`)
    }
    if (modified.length > 10) {
      console.log(`  ${DIM}... and ${modified.length - 10} more${NC}`)
    }
    console.log()
  }

  if (deleted.length > 0) {
    console.log(`${RED}Deleted files (${deleted.length}):${NC}`)
    for (const diff of deleted.slice(0, 10)) {
      console.log(`  ${RED}-${NC} ${diff.path}`)
    }
    if (deleted.length > 10) {
      console.log(`  ${DIM}... and ${deleted.length - 10} more${NC}`)
    }
    console.log()
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)
  const syncMode = args.includes('--sync')
  const checkMode = args.includes('--check')

  console.log()
  console.log(`${CYAN}========================================${NC}`)
  console.log(`${CYAN}  NextSpark - Template Sync${NC}`)
  console.log(`${CYAN}========================================${NC}`)
  console.log()

  console.log(`${DIM}Source:${NC} apps/dev/app/`)
  console.log(`${DIM}Target:${NC} packages/core/templates/app/`)
  console.log()

  // Check directories exist
  if (!existsSync(SOURCE_DIR)) {
    console.log(`${RED}Error: Source directory not found: ${SOURCE_DIR}${NC}`)
    process.exit(1)
  }

  if (!existsSync(TARGET_DIR)) {
    console.log(`${YELLOW}Warning: Target directory not found, will create: ${TARGET_DIR}${NC}`)
    mkdirSync(TARGET_DIR, { recursive: true })
  }

  // Compare directories
  console.log(`${CYAN}Comparing directories...${NC}`)
  const diffs = compareDirectories()
  console.log()

  if (diffs.length === 0) {
    console.log(`${GREEN}✓ Templates are in sync${NC}`)
    console.log()
    process.exit(0)
  }

  // Print diff
  printDiff(diffs)

  console.log(`${CYAN}Summary: ${diffs.length} file(s) differ${NC}`)
  console.log()

  // Handle modes
  if (checkMode) {
    console.log(`${RED}✗ Templates are out of sync${NC}`)
    console.log(`Run ${CYAN}pnpm sync:templates --sync${NC} to update templates.`)
    process.exit(1)
  }

  if (syncMode) {
    syncTemplates(diffs)
    process.exit(0)
  }

  // Interactive mode - just show diff
  console.log(`${YELLOW}Templates are out of sync.${NC}`)
  console.log(`Run ${CYAN}pnpm sync:templates --sync${NC} to copy changes to templates.`)
  console.log(`Run ${CYAN}pnpm sync:templates --check${NC} for CI validation.`)
  console.log()
  process.exit(0)
}

main().catch((err) => {
  console.error(`${RED}Unexpected error:${NC}`, err)
  process.exit(1)
})
