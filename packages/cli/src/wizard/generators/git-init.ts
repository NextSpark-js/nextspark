/**
 * Git Initialization Generator
 *
 * Handles Git repository initialization, .gitignore creation, and initial commit.
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import type { GitSetupAnswers } from '../prompts/git-config.js'
import type { WizardConfig } from '../types.js'

/**
 * NextSpark .gitignore content
 * Keep in sync with packages/core/templates/.gitignore
 */
export const GITIGNORE_CONTENT = `# Dependencies
node_modules/

# Build
.next/
out/
dist/

# NextSpark
.nextspark/

# Generated Next.js host: nextspark prepare (and dev, build) writes all of it; never edit
src/app/

# Mocks
_tmp/

# Claude Code
.claude/

# Playwright MCP
.playwright-mcp/

# Cypress
tests/cypress/videos
tests/cypress/screenshots
tests/cypress/allure-results
tests/cypress/allure-report

# Jest
tests/jest/coverage

# Environment
.env
.env.local
.env*.local

# TypeScript
*.tsbuildinfo

# Next.js rewrites this on every dev and build
next-env.d.ts

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Files uploaded in development (no storage provider configured)
public/uploads/temp/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
*.pem
`

/** What NextSpark generates in a project and git must never track: the registries and the whole Next.js host. */
export const GENERATED_ROOTS = ['.nextspark/', 'src/app/']

/**
 * Check if Git is installed and available
 */
function isGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if the directory is already a Git repository
 */
async function isGitRepository(projectPath: string): Promise<boolean> {
  const gitDir = path.join(projectPath, '.git')
  return fs.pathExists(gitDir)
}

/**
 * Initialize a new Git repository
 */
function initGitRepository(projectPath: string): void {
  execSync('git init', {
    cwd: projectPath,
    stdio: 'pipe',
  })
}

/** What an existing .gitignore gains: what a NextSpark project builds and generates, and its secrets. Never editor or tool folders. */
const APPENDED_PATTERNS = ['node_modules/', '.next/', '*.tsbuildinfo', 'next-env.d.ts', '.nextspark/', 'src/app/', 'public/uploads/temp/', '.env', '.env.local', '.env*.local']

/**
 * The .gitignore a project ends up with: the whole of GITIGNORE_CONTENT when there is none, otherwise
 * the existing file plus the APPENDED_PATTERNS it does not already have (compared as trimmed lines, so
 * nothing is written twice), in the file's own line endings.
 */
export function mergeGitignore(current: string | null): string {
  if (current === null) return GITIGNORE_CONTENT
  const have = new Set(current.split('\n').map(line => line.trim()))
  const missing = APPENDED_PATTERNS.filter(pattern => !have.has(pattern))
  if (missing.length === 0) return current
  const eol = current.includes('\r\n') ? '\r\n' : '\n'
  const separator = current === '' || current.endsWith('\n') ? '' : eol
  return `${current}${separator}${eol}# NextSpark additions${eol}${missing.join(eol)}${eol}`
}

/**
 * Create or update the .gitignore of a flat project
 */
export async function writeGitignore(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore')
  const current = (await fs.pathExists(gitignorePath)) ? await fs.readFile(gitignorePath, 'utf-8') : null
  const merged = mergeGitignore(current)
  if (merged !== current) await fs.writeFile(gitignorePath, merged)
}

/**
 * Stage all files and create initial commit
 */
function createInitialCommit(projectPath: string, message: string): void {
  execSync('git add .', {
    cwd: projectPath,
    stdio: 'pipe',
  })

  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    cwd: projectPath,
    stdio: 'pipe',
  })
}

/**
 * Setup Git repository based on user preferences
 *
 * @param projectPath - Path to the project directory
 * @param answers - User's git setup preferences
 * @param config - Wizard configuration (for future extensibility)
 */
export async function setupGit(
  projectPath: string,
  answers: GitSetupAnswers,
  config: WizardConfig
): Promise<void> {
  // If user doesn't want git, skip everything
  if (!answers.initGit) {
    return
  }

  // Check if Git is available
  if (!isGitAvailable()) {
    console.warn('\n  Warning: Git is not installed or not available in PATH.')
    console.warn('  Skipping Git initialization.\n')
    return
  }

  try {
    // Check if already a Git repository
    const isExistingRepo = await isGitRepository(projectPath)

    if (!isExistingRepo) {
      // Initialize new Git repository
      initGitRepository(projectPath)
      console.log('  Initialized Git repository.')
    } else {
      console.log('  Git repository already exists, skipping init.')
    }

    // Create or update .gitignore
    await writeGitignore(projectPath)
    console.log('  Created .gitignore file.')

    // Create initial commit if requested
    if (answers.createCommit && answers.commitMessage) {
      try {
        createInitialCommit(projectPath, answers.commitMessage)
        console.log(`  Created initial commit: "${answers.commitMessage}"`)
      } catch (commitError) {
        // Commit might fail if there's nothing to commit or git user not configured
        const errorMessage = commitError instanceof Error ? commitError.message : String(commitError)
        if (errorMessage.includes('nothing to commit')) {
          console.log('  No changes to commit.')
        } else if (errorMessage.includes('user.email') || errorMessage.includes('user.name')) {
          console.warn('\n  Warning: Git user not configured.')
          console.warn('  Run: git config --global user.name "Your Name"')
          console.warn('  Run: git config --global user.email "your@email.com"\n')
        } else {
          console.warn(`\n  Warning: Could not create commit: ${errorMessage}\n`)
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`\n  Warning: Git setup failed: ${errorMessage}`)
    console.warn('  You can initialize Git manually later.\n')
  }
}
