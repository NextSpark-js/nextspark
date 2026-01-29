#!/usr/bin/env node

/**
 * @nextsparkjs/ai-workflow - Sync Script
 *
 * Syncs the monorepo's working .claude/ directory into the publishable
 * packages/ai-workflow/claude/ directory. Run manually before npm publish.
 *
 * Usage:
 *   node packages/ai-workflow/scripts/sync.mjs
 *   # or from package dir:
 *   pnpm sync
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Package root = packages/ai-workflow/
const PACKAGE_ROOT = path.resolve(__dirname, '..')
// Monorepo root = repo/
const MONOREPO_ROOT = path.resolve(PACKAGE_ROOT, '../..')

// ---------------------------------------------------------------------------
// Editor definitions (future-proof)
// ---------------------------------------------------------------------------

const EDITORS = {
  claude: {
    sourceDir: '.claude',
    targetDir: 'claude',
    enabled: true,
  },
  cursor: {
    sourceDir: '.cursor',
    targetDir: 'cursor',
    enabled: false,
  },
  antigravity: {
    sourceDir: '.antigravity',
    targetDir: 'antigravity',
    enabled: false,
  },
}

// ---------------------------------------------------------------------------
// Sync mapping: directories and files to copy from .claude/ to claude/
// ---------------------------------------------------------------------------

/** Directories to sync (cleaned before copy) */
const SYNC_DIRS = [
  'agents',
  'commands',
  'skills',
  'templates',
  'workflows',
  '_docs',
]

/** File globs within config/ to sync (only schemas) */
const CONFIG_SYNC_PATTERN = /\.schema\.json$/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

function getAllFiles(dir, baseDir = dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, baseDir))
    } else {
      results.push(path.relative(baseDir, fullPath))
    }
  }
  return results
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  fs.copyFileSync(src, dest)
}

// ---------------------------------------------------------------------------
// Main sync logic
// ---------------------------------------------------------------------------

function syncEditor(name, cfg) {
  const sourceRoot = path.join(MONOREPO_ROOT, cfg.sourceDir)
  const targetRoot = path.join(PACKAGE_ROOT, cfg.targetDir)

  if (!fs.existsSync(sourceRoot)) {
    log(`  Source not found: ${sourceRoot}`, 'red')
    return { copied: 0, removed: 0, skipped: 0 }
  }

  let copied = 0
  let removed = 0
  let skipped = 0

  // 1. Sync directories: clean target then copy
  for (const dirName of SYNC_DIRS) {
    const srcDir = path.join(sourceRoot, dirName)
    const destDir = path.join(targetRoot, dirName)

    if (!fs.existsSync(srcDir)) {
      skipped++
      continue
    }

    // Clean target directory (remove stale files)
    if (fs.existsSync(destDir)) {
      const oldFiles = getAllFiles(destDir)
      removeDir(destDir)
      removed += oldFiles.length
    }

    // Copy all files
    const files = getAllFiles(srcDir)
    for (const relPath of files) {
      copyFile(
        path.join(srcDir, relPath),
        path.join(destDir, relPath)
      )
      copied++
    }

    log(`  ${dirName}/: ${files.length} files`, 'green')
  }

  // 2. Sync config/ schemas only
  const srcConfig = path.join(sourceRoot, 'config')
  const destConfig = path.join(targetRoot, 'config')

  if (fs.existsSync(srcConfig)) {
    let schemaCount = 0
    for (const file of fs.readdirSync(srcConfig)) {
      if (CONFIG_SYNC_PATTERN.test(file)) {
        copyFile(
          path.join(srcConfig, file),
          path.join(destConfig, file)
        )
        schemaCount++
        copied++
      }
    }
    log(`  config/*.schema.json: ${schemaCount} files`, 'green')
    log(`  config/*.json (templates): preserved`, 'dim')
  }

  return { copied, removed, skipped }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

log('\n@nextsparkjs/ai-workflow — Sync\n', 'cyan')
log(`Source: ${MONOREPO_ROOT}/.claude/`, 'dim')
log(`Target: ${PACKAGE_ROOT}/claude/\n`, 'dim')

let totalCopied = 0
let totalRemoved = 0

for (const [name, cfg] of Object.entries(EDITORS)) {
  if (!cfg.enabled) {
    log(`${name}: coming soon (skipped)`, 'dim')
    continue
  }

  log(`Syncing ${name}:`, 'cyan')
  const stats = syncEditor(name, cfg)
  totalCopied += stats.copied
  totalRemoved += stats.removed
}

log(`\nDone: ${totalCopied} files copied, ${totalRemoved} stale files removed.\n`, 'green')
