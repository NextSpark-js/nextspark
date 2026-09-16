#!/usr/bin/env node
/**
 * NextSpark Core Updater
 *
 * Updates the project in the current directory to another release of the
 * @nextsparkjs packages. See core-updater.mjs for what it changes and what it
 * never touches.
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

try {
  process.exitCode = updateCore(process.argv.slice(2))
} catch (error) {
  console.error(`\nUpdate failed: ${error.message}`)
  process.exitCode = 1
}
