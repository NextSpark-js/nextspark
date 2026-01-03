#!/usr/bin/env node

/**
 * Registry Watch Script
 *
 * Watches for changes in documentation directories and rebuilds registries automatically.
 * Useful during development.
 */

import { watch } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect project root
 */
function detectProjectRoot() {
  let dir = process.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (dir !== '/' && depth < maxDepth) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces || existsSync(join(dir, 'pnpm-workspace.yaml'))) {
          return dir;
        }
      } catch (error) {
        // Continue searching
      }
    }
    dir = dirname(dir);
    depth++;
  }

  // Fallback
  return join(__dirname, '../../..');
}

const PROJECT_ROOT = process.env.NEXTSPARK_PROJECT_ROOT || detectProjectRoot();
const ACTIVE_THEME = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default';

// Paths to watch
const CORE_DOCS = join(PROJECT_ROOT, 'packages/core/docs');
const THEME_DOCS = join(PROJECT_ROOT, 'contents/themes', ACTIVE_THEME, 'docs');
const CONTENTS_DIR = join(PROJECT_ROOT, 'contents');

let buildTimeout = null;
let isBuilding = false;

/**
 * Run the build script
 */
function rebuild() {
  if (isBuilding) {
    console.log('⏳ Build already in progress, skipping...');
    return;
  }

  isBuilding = true;
  console.log('\n🔄 Change detected, rebuilding registries...');

  const child = spawn('node', [join(__dirname, 'registry-build.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXTSPARK_PROJECT_ROOT: PROJECT_ROOT
    }
  });

  child.on('close', (code) => {
    isBuilding = false;
    if (code === 0) {
      console.log('👀 Watching for changes... (Press Ctrl+C to stop)');
    } else {
      console.error('❌ Build failed');
    }
  });
}

/**
 * Debounced rebuild
 */
function scheduleRebuild() {
  if (buildTimeout) {
    clearTimeout(buildTimeout);
  }
  buildTimeout = setTimeout(rebuild, 500);
}

/**
 * Start watching
 */
function startWatcher() {
  console.log('👀 NextSpark Registry Watcher');
  console.log('============================\n');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Active theme: ${ACTIVE_THEME}\n`);
  console.log('Watching:');
  console.log(`  - ${CORE_DOCS}`);
  console.log(`  - ${THEME_DOCS}`);
  console.log(`  - ${CONTENTS_DIR}/plugins/*/docs\n`);

  // Initial build
  rebuild();

  // Watch core docs
  if (existsSync(CORE_DOCS)) {
    watch(CORE_DOCS, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`📝 ${eventType}: ${filename}`);
        scheduleRebuild();
      }
    });
  }

  // Watch theme docs
  if (existsSync(THEME_DOCS)) {
    watch(THEME_DOCS, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`📝 ${eventType}: ${filename}`);
        scheduleRebuild();
      }
    });
  }

  // Watch plugin docs
  if (existsSync(CONTENTS_DIR)) {
    watch(CONTENTS_DIR, { recursive: true }, (eventType, filename) => {
      if (filename && filename.includes('/plugins/') && filename.includes('/docs/') && filename.endsWith('.md')) {
        console.log(`📝 ${eventType}: ${filename}`);
        scheduleRebuild();
      }
    });
  }
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping watcher...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Stopping watcher...');
  process.exit(0);
});

// Start
startWatcher();
