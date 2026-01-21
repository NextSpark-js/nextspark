#!/usr/bin/env node

// Check Node.js version before importing anything
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error('\x1b[31m✗ NextSpark requires Node.js 18 or higher\x1b[0m');
  console.error(`  Current version: ${process.versions.node}`);
  console.error('  Please upgrade Node.js: https://nodejs.org/');
  process.exit(1);
}

import '../dist/index.js'
