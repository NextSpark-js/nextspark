#!/usr/bin/env node
/**
 * @nextsparkjs/core postinstall hook
 *
 * Automatically syncs /app folder with core templates when the package is updated.
 * Only runs in NextSpark projects (not in the monorepo or other contexts).
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Find the project root by walking up from the current directory
 * until we find a package.json that isn't inside node_modules
 */
function findProjectRoot() {
  // When running postinstall, we're in node_modules/@nextsparkjs/core
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
 * Detect if we're in a NextSpark project (not the monorepo)
 */
function isNextSparkProject(projectRoot) {
  // If we're in the monorepo, skip
  const pnpmWorkspace = join(projectRoot, 'pnpm-workspace.yaml');
  if (existsSync(pnpmWorkspace)) {
    return false;
  }

  // Check for package.json with nextspark dependency
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    return !!(deps['@nextsparkjs/core'] || deps['@nextsparkjs/cli']);
  } catch {
    return false;
  }
}

/**
 * Check if the project has an /app folder (already initialized)
 */
function hasAppFolder(projectRoot) {
  return existsSync(join(projectRoot, 'app'));
}

/**
 * Check if nextspark CLI is available
 */
function hasNextsparkCli(projectRoot) {
  // Check in node_modules/.bin
  const binPath = join(projectRoot, 'node_modules', '.bin', 'nextspark');
  return existsSync(binPath);
}

// Main execution
try {
  const projectRoot = findProjectRoot();

  // Only run in NextSpark projects with an existing /app folder
  if (isNextSparkProject(projectRoot) && hasAppFolder(projectRoot)) {
    console.log('\n  \uD83D\uDCE6 @nextsparkjs/core updated - syncing /app folder...\n');

    // Check if CLI is available
    if (hasNextsparkCli(projectRoot)) {
      try {
        execSync('npx nextspark sync:app --force', {
          stdio: 'inherit',
          cwd: projectRoot
        });
      } catch (syncError) {
        console.warn('\n  \u26A0\uFE0F  Auto-sync failed. Run manually: npx nextspark sync:app\n');
      }
    } else {
      // CLI not yet installed (first install or parallel install)
      // This is expected during initial setup, skip silently
    }
  }
} catch (error) {
  // Fail silently - postinstall hooks should not break installations
  // The user can always run the sync manually
}
