import path from 'node:path'
import fs from 'fs-extra'
import { execFileSync } from 'node:child_process'

export const INITIAL_COMMIT_MESSAGE = 'Initial commit from create-nextspark-app'

export type GitSetupResult =
  | { status: 'committed' }
  | { status: 'initialized'; reason: string; commitFailed?: boolean }
  | { status: 'skipped'; reason: string }

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function errorText(error: unknown): string {
  const stderr = (error as { stderr?: string }).stderr
  return (stderr || (error instanceof Error ? error.message : String(error))).trim()
}

/**
 * Starts a repository in a freshly generated project, so `nextspark update-core` (which needs a clean
 * git tree) works from the first upgrade. Never throws: a failure is reported in the result.
 *
 * Skipped when git is missing or `projectPath` is already inside a work tree. Run it after the
 * dependencies are installed so the lockfile is in the commit. Without a .gitignore nothing is
 * committed, since `git add -A` would take node_modules and .env.
 */
export function setupGitRepository(projectPath: string): GitSetupResult {
  try {
    runGit(projectPath, ['--version'])
  } catch {
    return { status: 'skipped', reason: 'git is not installed' }
  }

  try {
    runGit(projectPath, ['rev-parse', '--is-inside-work-tree'])
    return { status: 'skipped', reason: 'the directory is already inside a git repository' }
  } catch {
    // not a repository: carry on
  }

  try {
    runGit(projectPath, ['init'])
  } catch (error) {
    return { status: 'skipped', reason: `git init failed: ${errorText(error)}` }
  }

  if (!fs.existsSync(path.join(projectPath, '.gitignore'))) {
    return { status: 'initialized', reason: 'the project has no .gitignore, so nothing was committed' }
  }

  try {
    runGit(projectPath, ['add', '-A'])
    runGit(projectPath, ['commit', '-m', INITIAL_COMMIT_MESSAGE])
    return { status: 'committed' }
  } catch (error) {
    return { status: 'initialized', reason: `the initial commit failed: ${errorText(error)}`, commitFailed: true }
  }
}
