import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { showError, showSuccess, showWarning } from './banner.js'

/**
 * Install the generated project's dependencies from its root.
 *
 * `--no-frozen-lockfile`: pnpm freezes the lockfile whenever CI is set, and
 * generating the project has just rewritten package.json, so a frozen install
 * stops at ERR_PNPM_OUTDATED_LOCKFILE. It does not resolve again what the
 * lockfile already holds: whether another pnpm can install the project later
 * depends on the release-age policy create-nextspark-app writes into
 * pnpm-workspace.yaml, and on the pnpm that created it.
 *
 * pnpm's exit code alone decides whether the install finished. pnpm writes
 * node_modules before it fails, so a project whose node_modules exists can
 * still be missing most of its dependencies.
 *
 * @throws when pnpm exits with anything but 0
 */
export function installProjectDependencies(projectRoot: string): void {
  try {
    execSync('pnpm install --force --no-frozen-lockfile', {
      cwd: projectRoot,
      stdio: 'inherit',
    })
  } catch (error) {
    const status = (error as { status?: number | null }).status ?? 'unknown'
    throw new Error(`pnpm install exited with code ${status}; its output above says why.`)
  }
}

export interface AIWorkflowSetup {
  projectRoot: string
  /** The assistant picked in the prompt, passed on to the package's setup script. */
  choice: string
  isMonorepo: boolean
  /** The @nextsparkjs/ai-workflow version to install: the CLI's own. */
  version: string
}

/**
 * Add @nextsparkjs/ai-workflow to the project and run its setup script.
 *
 * Returns `choice` once set up, or 'skip' when the install or the script fails.
 * A pnpm add that exits non-zero counts as failed even when the package already
 * landed in node_modules, and its setup script is not run.
 */
export function setupAIWorkflow({ projectRoot, choice, isMonorepo, version }: AIWorkflowSetup): string {
  // All generated projects use pnpm workspaces (web-only for themes/plugins,
  // monorepo for web/ + mobile/), so -w flag is always required
  try {
    // Pin to the CLI's exact version (not `latest`) so it matches the rest of
    // the install and isn't pulled to an old version by a stale pnpm cache.
    execSync(`pnpm add -D -w @nextsparkjs/ai-workflow@${version}`, {
      cwd: projectRoot,
      stdio: 'inherit',
    })

    // Find setup script — check root node_modules first, then web/ for monorepo hoisting
    let setupScript = join(projectRoot, 'node_modules', '@nextsparkjs', 'ai-workflow', 'scripts', 'setup.mjs')
    if (!existsSync(setupScript) && isMonorepo) {
      setupScript = join(projectRoot, 'web', 'node_modules', '@nextsparkjs', 'ai-workflow', 'scripts', 'setup.mjs')
    }

    if (existsSync(setupScript)) {
      // .claude/ always goes at project root (applies to both web and mobile)
      execSync(`node "${setupScript}" ${choice}`, {
        cwd: projectRoot,
        stdio: 'inherit',
      })
      showSuccess('AI workflow setup complete!')
    } else {
      showWarning('AI workflow package installed but setup script not found. Run "nextspark setup:ai" manually.')
    }
  } catch (error) {
    showError('Failed to install AI workflow package. Run "nextspark setup:ai" later.')
    return 'skip'
  }

  return choice
}
