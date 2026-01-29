#!/usr/bin/env node

/**
 * @nextsparkjs/ai-workflow - Setup Script
 *
 * Copies AI workflow templates to the consumer's project directory.
 * Uses file-by-file copy to preserve user-created files.
 *
 * Usage:
 *   node node_modules/@nextsparkjs/ai-workflow/scripts/setup.mjs [editor]
 *   nextspark setup:ai --editor claude
 *
 * Editor options:
 *   claude        Setup Claude Code (.claude/)
 *   cursor        Setup Cursor (coming soon)
 *   antigravity   Setup Antigravity (coming soon)
 *   all           Setup all available editors
 *   (no arg)      Defaults to "claude"
 *
 * Copy strategy:
 *   agents/, commands/, skills/, templates/, workflows/, _docs/
 *     → Overwrite matching files, preserve user-created files
 *   config/*.schema.json
 *     → Always overwrite (schema updates)
 *   config/*.json (non-schema)
 *     → Copy only if not exists (user config — never overwrite)
 *   sessions/
 *     → Create directory if not exists, never copy content
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Package root = where this script lives (packages/ai-workflow/ or node_modules/@nextsparkjs/ai-workflow/)
const PACKAGE_ROOT = path.resolve(__dirname, '..')

// Consumer project root = where the user runs from
const PROJECT_ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Editor definitions
// ---------------------------------------------------------------------------

const EDITORS = {
  claude: {
    enabled: true,
    source: 'claude',    // subdirectory in package
    target: '.claude',   // subdirectory in consumer project
  },
  cursor: {
    enabled: false,
    source: 'cursor',
    target: '.cursor',
  },
  antigravity: {
    enabled: false,
    source: 'antigravity',
    target: '.antigravity',
  },
}

// ---------------------------------------------------------------------------
// Copy strategies per directory
// ---------------------------------------------------------------------------

/** Directories where matching files are overwritten */
const OVERWRITE_DIRS = new Set([
  'agents',
  'commands',
  'skills',
  'templates',
  'workflows',
  '_docs',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

/**
 * Recursively get all files in a directory (relative paths).
 */
function getAllFiles(dir, baseDir = dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, baseDir))
    } else if (entry.name !== '.gitkeep') {
      results.push(path.relative(baseDir, fullPath))
    }
  }
  return results
}

/**
 * Copy a single file, creating parent directories as needed.
 */
function copyFile(src, dest) {
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  fs.copyFileSync(src, dest)
}

// ---------------------------------------------------------------------------
// Setup logic for a single editor
// ---------------------------------------------------------------------------

function setupEditor(name, cfg) {
  const sourceRoot = path.join(PACKAGE_ROOT, cfg.source)
  const targetRoot = path.join(PROJECT_ROOT, cfg.target)

  if (!fs.existsSync(sourceRoot)) {
    log(`  Source not found: ${sourceRoot}`, 'red')
    return { overwritten: 0, created: 0, preserved: 0 }
  }

  // Ensure target root exists
  if (!fs.existsSync(targetRoot)) {
    fs.mkdirSync(targetRoot, { recursive: true })
  }

  let overwritten = 0
  let created = 0
  let preserved = 0

  // 1. Process overwrite directories (agents, commands, skills, etc.)
  for (const dirName of OVERWRITE_DIRS) {
    const srcDir = path.join(sourceRoot, dirName)
    if (!fs.existsSync(srcDir)) continue

    const files = getAllFiles(srcDir)
    for (const relPath of files) {
      const srcFile = path.join(srcDir, relPath)
      const destFile = path.join(targetRoot, dirName, relPath)
      const existed = fs.existsSync(destFile)

      copyFile(srcFile, destFile)

      if (existed) {
        overwritten++
      } else {
        created++
      }
    }

    if (files.length > 0) {
      log(`  ${dirName}/: ${files.length} files`, 'green')
    }
  }

  // 2. Process config/ directory with mixed strategy
  const srcConfig = path.join(sourceRoot, 'config')
  const destConfig = path.join(targetRoot, 'config')

  if (fs.existsSync(srcConfig)) {
    if (!fs.existsSync(destConfig)) {
      fs.mkdirSync(destConfig, { recursive: true })
    }

    let schemasCopied = 0
    let configsCreated = 0
    let configsPreserved = 0

    for (const file of fs.readdirSync(srcConfig)) {
      const srcFile = path.join(srcConfig, file)
      const destFile = path.join(destConfig, file)

      // Skip non-files and .gitkeep
      if (!fs.statSync(srcFile).isFile() || file === '.gitkeep') continue

      const isSchema = file.endsWith('.schema.json')

      if (isSchema) {
        // Schema files: always overwrite
        copyFile(srcFile, destFile)
        schemasCopied++
        overwritten++
      } else {
        // Config files: copy only if not exists
        if (fs.existsSync(destFile)) {
          configsPreserved++
          preserved++
        } else {
          copyFile(srcFile, destFile)
          configsCreated++
          created++
        }
      }
    }

    if (schemasCopied > 0) {
      log(`  config/*.schema.json: ${schemasCopied} schemas updated`, 'green')
    }
    if (configsCreated > 0) {
      log(`  config/*.json: ${configsCreated} new configs created`, 'green')
    }
    if (configsPreserved > 0) {
      log(`  config/*.json: ${configsPreserved} user configs preserved`, 'blue')
    }
  }

  // 3. Ensure sessions/ directory exists (never copy content)
  const sessionsDir = path.join(targetRoot, 'sessions')
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true })
    log(`  sessions/: created (empty)`, 'green')
  } else {
    log(`  sessions/: exists (preserved)`, 'blue')
  }

  return { overwritten, created, preserved }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const editorArg = process.argv[2] || 'claude'

log(`\n${colors.bold}@nextsparkjs/ai-workflow — Setup${colors.reset}\n`, 'cyan')
log(`Package: ${PACKAGE_ROOT}`, 'dim')
log(`Project: ${PROJECT_ROOT}\n`, 'dim')

if (editorArg === 'all') {
  for (const [name, cfg] of Object.entries(EDITORS)) {
    if (cfg.enabled) {
      log(`Setting up ${name}:`, 'cyan')
      const stats = setupEditor(name, cfg)
      log(`  Total: ${stats.overwritten} updated, ${stats.created} created, ${stats.preserved} preserved\n`, 'dim')
    } else {
      log(`${name}: coming soon\n`, 'yellow')
    }
  }
} else {
  const cfg = EDITORS[editorArg]

  if (!cfg) {
    log(`Unknown editor: ${editorArg}`, 'red')
    log(`Available: ${Object.keys(EDITORS).join(', ')}, all`, 'dim')
    process.exit(1)
  }

  if (!cfg.enabled) {
    log(`${editorArg}: coming soon`, 'yellow')
    log(`Currently supported: claude`, 'dim')
    process.exit(0)
  }

  log(`Setting up ${editorArg}:`, 'cyan')
  const stats = setupEditor(editorArg, cfg)

  log('')
  log(`Setup complete!`, 'green')
  log(`  ${stats.overwritten} files updated`, 'dim')
  log(`  ${stats.created} files created`, 'dim')
  log(`  ${stats.preserved} files preserved`, 'dim')
  log('')
}
