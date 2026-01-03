#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Path from packages/core/scripts/setup/ to project root (4 levels up)
const projectRoot = path.resolve(__dirname, '../../../..')

const SOURCE_DIR = path.join(projectRoot, 'packages/core/presets/ai-workflow/claude')
const TARGET_DIR = path.join(projectRoot, '.claude')

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Setup Claude Code AI Workflow
 *
 * This script copies template files from core/presets/ai-workflow/claude/ to .claude/
 * while preserving user-created configuration files and session data.
 *
 * Update Strategy:
 * - config/*.example.* → Always copied (overwrite if exists)
 * - config/* (no .example) → NEVER touched (user files)
 * - agents/, commands/, tools/ → Always copied (overwrite)
 * - sessions/README.md + sessions/templates/ → Always copied
 * - sessions/[user-folders]/ → NEVER touched
 */

log('\n🤖 Claude Code AI Workflow Setup\n', 'cyan')

// Verify source directory exists
if (!fs.existsSync(SOURCE_DIR)) {
  log('❌ Error: Template directory not found at:', 'red')
  log(`   ${SOURCE_DIR}`, 'red')
  log('\n💡 This might be a development environment issue.', 'yellow')
  process.exit(1)
}

// Create target directory if it doesn't exist
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true })
}

/**
 * Copy a directory recursively
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Copy config directory with special handling for .example files
 */
function copyConfigDirectory() {
  const srcConfig = path.join(SOURCE_DIR, 'config')
  const destConfig = path.join(TARGET_DIR, 'config')

  if (!fs.existsSync(srcConfig)) {
    log('⚠️  No config directory found in templates', 'yellow')
    return { examplesCopied: 0, userFilesPreserved: 0 }
  }

  if (!fs.existsSync(destConfig)) {
    fs.mkdirSync(destConfig, { recursive: true })
  }

  const files = fs.readdirSync(srcConfig)
  let examplesCopied = 0
  let userFilesPreserved = 0

  for (const file of files) {
    const srcFile = path.join(srcConfig, file)
    const destFile = path.join(destConfig, file)

    // Skip if not a file
    const stats = fs.statSync(srcFile)
    if (!stats.isFile()) {
      continue
    }

    // Check if it's an .example file
    const isExample = file.includes('.example.')

    if (isExample) {
      // Always copy .example files (overwrite if exists)
      fs.copyFileSync(srcFile, destFile)
      examplesCopied++
      log(`   ✓ ${file}`, 'green')
    } else {
      // Check if user file exists
      if (fs.existsSync(destFile)) {
        // User file exists - DO NOT TOUCH
        userFilesPreserved++
        log(`   ↷ ${file} (preserved)`, 'blue')
      } else {
        // User file doesn't exist - copy from template
        fs.copyFileSync(srcFile, destFile)
        log(`   ✓ ${file} (new)`, 'green')
      }
    }
  }

  return { examplesCopied, userFilesPreserved }
}

/**
 * Copy sessions directory while preserving user session folders
 */
function copySessionsDirectory() {
  const srcSessions = path.join(SOURCE_DIR, 'sessions')
  const destSessions = path.join(TARGET_DIR, 'sessions')

  if (!fs.existsSync(srcSessions)) {
    log('⚠️  No sessions directory found in templates', 'yellow')
    return { userSessionsPreserved: 0 }
  }

  if (!fs.existsSync(destSessions)) {
    fs.mkdirSync(destSessions, { recursive: true })
  }

  // Get all existing session folders (user-created)
  const existingFolders = fs.existsSync(destSessions)
    ? fs.readdirSync(destSessions, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'templates')
        .map(entry => entry.name)
    : []

  // Copy README.md
  const readmeSrc = path.join(srcSessions, 'README.md')
  const readmeDest = path.join(destSessions, 'README.md')
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, readmeDest)
    log('   ✓ README.md', 'green')
  }

  // Copy templates directory
  const templatesSrc = path.join(srcSessions, 'templates')
  const templatesDest = path.join(destSessions, 'templates')
  if (fs.existsSync(templatesSrc)) {
    copyDirectory(templatesSrc, templatesDest)
    const templateCount = fs.readdirSync(templatesSrc).length
    log(`   ✓ templates/ (${templateCount} files)`, 'green')
  }

  return { userSessionsPreserved: existingFolders.length }
}

/**
 * Count files in directory
 */
function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter(file => {
    const filePath = path.join(dir, file)
    return fs.statSync(filePath).isFile()
  }).length
}

/**
 * Main setup process
 */
async function setup() {
  try {
    // 1. Copy config directory with special handling
    log('📋 Config files:', 'cyan')
    const configStats = copyConfigDirectory()

    // 2. Copy agents directory (always overwrite)
    log('\n🤖 Agent definitions:', 'cyan')
    const agentsDir = path.join(SOURCE_DIR, 'agents')
    if (fs.existsSync(agentsDir)) {
      const agentsCount = countFiles(agentsDir)
      copyDirectory(agentsDir, path.join(TARGET_DIR, 'agents'))
      log(`   ✓ Copied ${agentsCount} agent files`, 'green')
    }

    // 3. Copy commands directory (always overwrite)
    log('\n⚡ Commands:', 'cyan')
    const commandsDir = path.join(SOURCE_DIR, 'commands')
    if (fs.existsSync(commandsDir)) {
      const commandsCount = countFiles(commandsDir)
      copyDirectory(commandsDir, path.join(TARGET_DIR, 'commands'))
      log(`   ✓ Copied ${commandsCount} command files`, 'green')
    }

    // 4. Copy sessions with preservation of user folders
    log('\n📁 Sessions:', 'cyan')
    const sessionsStats = copySessionsDirectory()
    if (sessionsStats.userSessionsPreserved > 0) {
      log(`   ↷ Preserved ${sessionsStats.userSessionsPreserved} user session(s)`, 'blue')
    }

    // 5. Copy tools directory (always overwrite)
    log('\n🛠️  Tools:', 'cyan')
    const toolsSrc = path.join(SOURCE_DIR, 'tools')
    if (fs.existsSync(toolsSrc)) {
      copyDirectory(toolsSrc, path.join(TARGET_DIR, 'tools'))
      log('   ✓ Copied tools documentation', 'green')
    }

    // 6. Copy root README.md (always overwrite)
    log('\n📖 Documentation:', 'cyan')
    const readmeSrc = path.join(SOURCE_DIR, 'README.md')
    const readmeDest = path.join(TARGET_DIR, 'README.md')
    if (fs.existsSync(readmeSrc)) {
      fs.copyFileSync(readmeSrc, readmeDest)
      log('   ✓ README.md', 'green')
    }

    // Success message
    log('\n✅ Claude Code setup complete!\n', 'green')

    // Check if user needs to create config files
    const needsAgentsConfig = !fs.existsSync(path.join(TARGET_DIR, 'config/agents.md'))
    const needsWorkflowConfig = !fs.existsSync(path.join(TARGET_DIR, 'config/workflow.md'))
    const needsSettingsConfig = !fs.existsSync(path.join(TARGET_DIR, 'config/settings.local.json'))

    if (needsAgentsConfig || needsWorkflowConfig || needsSettingsConfig) {
      log('📝 Next Steps:\n', 'yellow')

      if (needsAgentsConfig) {
        log('1. Create your agents config:', 'yellow')
        console.log('   cp .claude/config/agents.example.md .claude/config/agents.md')
        console.log('   # Then edit agents.md with your ClickUp credentials\n')
      }

      if (needsWorkflowConfig) {
        log('2. Create your workflow config (optional):', 'yellow')
        console.log('   cp .claude/config/workflow.example.md .claude/config/workflow.md')
        console.log('   # Then customize for your project workflow\n')
      }

      if (needsSettingsConfig) {
        log('3. Create your settings config (optional):', 'yellow')
        console.log('   cp .claude/config/settings.local.example.json .claude/config/settings.local.json')
        console.log('   # Then adjust permissions as needed\n')
      }

      log('📚 Documentation:', 'cyan')
      console.log('   - Setup guide: core/presets/ai-workflow/claude/README.md')
      console.log('   - Project docs: CLAUDE.md')
      console.log('   - Slash commands: .claude/commands/\n')
    } else {
      log('🎉 Your configuration files are already set up!\n', 'green')

      if (configStats.examplesCopied > 0) {
        log('ℹ️  Example files were updated. Compare with your configs if needed:\n', 'blue')
        console.log('   diff .claude/config/agents.example.md .claude/config/agents.md')
        console.log('   diff .claude/config/workflow.example.md .claude/config/workflow.md\n')
      }
    }

  } catch (error) {
    log('\n❌ Setup failed:\n', 'red')
    log(error.message, 'red')
    console.log('\nStack trace:')
    console.log(error.stack)
    process.exit(1)
  }
}

// Run setup
setup()
