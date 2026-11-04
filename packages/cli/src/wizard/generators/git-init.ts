/**
 * Git Initialization Generator
 *
 * The .gitignore of a flat project: its content and how an existing one is merged.
 */

import fs from 'fs-extra'
import path from 'path'

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
