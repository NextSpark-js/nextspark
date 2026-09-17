#!/usr/bin/env node

// Check the runtime floor before importing the package entry point.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 14)) {
  console.error('\x1b[31m✗ NextSpark requires Node.js 22.14.0 or later\x1b[0m');
  console.error(`  Current version: ${process.versions.node}`);
  console.error('  Please upgrade Node.js: https://nodejs.org/');
  process.exit(1);
}

await import('../dist/index.js')
