#!/usr/bin/env node
/**
 * @nextsparkjs/ai-workflow postinstall hook
 *
 * Automatically syncs AI workflow files (.claude/, .cursor/, etc.) when the package is updated.
 * Only runs in NextSpark projects that already have AI workflow set up.
 *
 * Debug mode: Set NEXTSPARK_DEBUG=1 to see detailed logs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const DEBUG = process.env.NEXTSPARK_DEBUG === '1';

function debug(message) {
  if (DEBUG) {
    console.log(`  [DEBUG] ${message}`);
  }
}

/**
 * Find the project root by walking up from the current directory
 * until we find a package.json that isn't inside node_modules
 */
function findProjectRoot() {
  // When running postinstall, we're in node_modules/@nextsparkjs/ai-workflow
  // We need to find the project root (where the user's package.json is)
  let current = process.cwd();

  // If we're inside node_modules, walk up to find the project root
  if (current.includes('node_modules')) {
    // Go up until we're out of node_modules
    const parts = current.split('node_modules');
    current = parts[0].replace(/[/\\]$/, ''); // Remove trailing slash
  }

  return current;
}

/**
 * Validate that the project root path is safe to use
 */
function validateProjectRoot(projectRoot) {
  // Must be an absolute path
  if (!isAbsolute(projectRoot)) {
    debug(`Invalid path: not absolute - ${projectRoot}`);
    return false;
  }

  // Must exist
  if (!existsSync(projectRoot)) {
    debug(`Invalid path: does not exist - ${projectRoot}`);
    return false;
  }

  // Resolve to canonical path and verify it doesn't escape
  const resolved = resolve(projectRoot);
  if (resolved !== projectRoot && !projectRoot.startsWith(resolved)) {
    debug(`Invalid path: resolution mismatch - ${projectRoot} vs ${resolved}`);
    return false;
  }

  return true;
}

/**
 * Detect if we're in the NextSpark development monorepo.
 * Consumer projects may also have pnpm-workspace.yaml (for themes/plugins),
 * so we check for packages/core/ which only exists in the dev monorepo.
 */
function isDevMonorepo(projectRoot) {
  const isMonorepo = existsSync(join(projectRoot, 'packages', 'core', 'package.json'));
  if (isMonorepo) {
    debug('Skipping: NextSpark development monorepo detected');
  }
  return isMonorepo;
}

/**
 * Detect if we're in a NextSpark consumer project
 */
function isNextSparkProject(projectRoot) {
  // If we're in the dev monorepo, skip
  if (isDevMonorepo(projectRoot)) {
    return false;
  }

  // Check for package.json with nextspark dependency
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    debug('Skipping: no package.json found');
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const hasNextSpark = !!(deps['@nextsparkjs/core'] || deps['@nextsparkjs/cli']);
    if (!hasNextSpark) {
      debug('Skipping: no NextSpark dependencies found');
    }
    return hasNextSpark;
  } catch {
    debug('Skipping: failed to parse package.json');
    return false;
  }
}

/**
 * Check if the project has a .claude/ folder (AI workflow already set up)
 */
function hasAIWorkflowSetup(projectRoot) {
  const hasClaudeDir = existsSync(join(projectRoot, '.claude'));
  if (!hasClaudeDir) {
    debug('Skipping: no .claude/ folder found (AI workflow not set up yet)');
  }
  return hasClaudeDir;
}

/**
 * Find the setup.mjs script path relative to this postinstall script
 */
function getSetupScriptPath() {
  // This script is at packages/ai-workflow/scripts/postinstall.mjs
  // setup.mjs is at packages/ai-workflow/scripts/setup.mjs
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const setupPath = join(__dirname, 'setup.mjs');

  if (existsSync(setupPath)) {
    return setupPath;
  }

  debug(`Setup script not found at ${setupPath}`);
  return null;
}

// Main execution
try {
  const projectRoot = findProjectRoot();
  debug(`Project root: ${projectRoot}`);

  // Validate project root path
  if (!validateProjectRoot(projectRoot)) {
    debug('Skipping: invalid project root path');
    process.exit(0);
  }

  // Only run in NextSpark projects with an existing .claude/ folder
  if (isNextSparkProject(projectRoot) && hasAIWorkflowSetup(projectRoot)) {
    console.log('\n  📦 @nextsparkjs/ai-workflow updated - syncing AI workflow files...\n');

    const setupScript = getSetupScriptPath();
    if (setupScript) {
      try {
        execSync(`node "${setupScript}" claude`, {
          stdio: 'inherit',
          cwd: projectRoot,
        });
      } catch (syncError) {
        console.warn('\n  ⚠️  Auto-sync failed. Run manually: npx nextspark sync:ai\n');
        debug(`Sync error: ${syncError.message}`);
      }
    } else {
      debug('Skipping: setup.mjs script not found');
    }
  }
} catch (error) {
  // Postinstall hooks should not break installations
  // The user can always run the sync manually
  if (DEBUG) {
    console.warn('\n  [DEBUG] Postinstall error:', error.message);
    if (error.stack) {
      console.warn(error.stack);
    }
  }
}
