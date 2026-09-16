#!/usr/bin/env node
/**
 * NextSpark Core Updater
 *
 * Updates the project in the current directory to another release of the
 * @nextsparkjs packages. See core-updater.mjs for what it changes, what it
 * never touches and how a run that fails or is interrupted is rolled back.
 *
 * Usage:
 *   pnpm update-core                            # Update to latest
 *   pnpm update-core --version 0.1.0-beta.189   # Specific version
 *   pnpm update-core --branch                   # Create update branch
 *   pnpm update-core --list                     # List releases
 *   pnpm update-core --check                    # Check for updates
 *   pnpm update-core --current                  # Show current version
 *   pnpm update-core --help                     # Show help
 */

import { updateCore } from './core-updater.mjs'

// A closed terminal fails writes to it; the run still has to stop its step and set its exit code
for (const stream of [process.stdout, process.stderr]) stream.on('error', () => {})

try {
  process.exitCode = await updateCore(process.argv.slice(2))
} catch (error) {
  // Only reachable before the first write: from there on updateCore reports its own failures
  console.error(`\nUpdate failed: ${error.message}`)
  process.exitCode = 1
}
