#!/usr/bin/env node

/**
 * Registry Build Script
 *
 * Orchestrates the generation of all auto-generated registries.
 * Currently generates:
 * - docs-registry.ts (documentation index)
 *
 * Future: Will integrate other registry generators (theme, plugin, entity, etc.)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a script and wait for completion
 */
function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  ${description}...`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: process.env.NEXTSPARK_PROJECT_ROOT || process.cwd()
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Failed to run ${description}: ${error.message}`);
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${description} exited with code ${code}`));
      }
    });
  });
}

/**
 * Main build function
 */
async function buildAllRegistries() {
  const startTime = Date.now();

  console.log('🏗️  Building NextSpark Registries');
  console.log('================================\n');

  try {
    // Build docs registry
    await runScript(
      join(__dirname, 'build/docs-registry.mjs'),
      'Building Documentation Registry'
    );

    // Future: Add other registry generators here
    // await runScript(join(__dirname, 'build/theme-registry.mjs'), 'Building Theme Registry');
    // await runScript(join(__dirname, 'build/plugin-registry.mjs'), 'Building Plugin Registry');
    // await runScript(join(__dirname, 'build/entity-registry.mjs'), 'Building Entity Registry');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ All registries built successfully in ${duration}s`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Registry build failed:', error.message);
    process.exit(1);
  }
}

// Run the build
buildAllRegistries();
