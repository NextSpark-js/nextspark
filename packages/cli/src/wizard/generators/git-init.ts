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
const GITIGNORE_CONTENT = `# Dependencies
node_modules/

# Build
.next/
out/
dist/

# NextSpark
.nextspark/

# Auto-generated templates (from theme templates at build time)
app/(templates)/

# Mocks
app/(public)/mock-demo/
_tmp/

# Claude Code
.claude/

# Playwright MCP
.playwright-mcp/

# Cypress (theme-based)
contents/themes/*/tests/cypress/videos
contents/themes/*/tests/cypress/screenshots
contents/themes/*/tests/cypress/allure-results
contents/themes/*/tests/cypress/allure-report

# Jest (theme-based)
contents/themes/*/tests/jest/coverage

# Environment
.env
.env.local
.env*.local

# TypeScript
*.tsbuildinfo

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
*.pem
`

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

/**
 * Create or update .gitignore file
 */
async function createGitignore(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore')

  if (await fs.pathExists(gitignorePath)) {
    // Append NextSpark entries if not already present
    const currentContent = await fs.readFile(gitignorePath, 'utf-8')
    if (!currentContent.includes('.nextspark/')) {
      const separator = currentContent.endsWith('\n') ? '' : '\n'
      await fs.appendFile(gitignorePath, `${separator}\n# NextSpark additions\n.nextspark/\n`)
    }
  } else {
    // Create new .gitignore
    await fs.writeFile(gitignorePath, GITIGNORE_CONTENT)
  }
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
    await createGitignore(projectPath)
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
