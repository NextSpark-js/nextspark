#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { generateCommand } from './commands/generate.js';
import { registryBuildCommand, registryWatchCommand } from './commands/registry.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('nextspark')
  .description('NextSpark CLI - Professional SaaS Boilerplate')
  .version('0.3.0');

// Dev command
program
  .command('dev')
  .description('Start development server with registry watcher')
  .option('-p, --port <port>', 'Port to run the dev server on', '3000')
  .option('--no-registry', 'Disable registry watcher')
  .action(devCommand);

// Build command
program
  .command('build')
  .description('Build for production')
  .option('--no-registry', 'Skip registry generation before build')
  .action(buildCommand);

// Generate command
program
  .command('generate')
  .description('Generate all registries')
  .option('-w, --watch', 'Watch for changes')
  .action(generateCommand);

// Registry commands
const registry = program
  .command('registry')
  .description('Registry management commands');

registry
  .command('build')
  .description('Build all registries')
  .action(registryBuildCommand);

registry
  .command('watch')
  .description('Watch and rebuild registries on changes')
  .action(registryWatchCommand);

// Shorthand aliases for registry commands
program
  .command('registry:build')
  .description('Build all registries (alias)')
  .action(registryBuildCommand);

program
  .command('registry:watch')
  .description('Watch and rebuild registries (alias)')
  .action(registryWatchCommand);

// Init command
program
  .command('init')
  .description('Initialize NextSpark in current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(initCommand);

// Error handling
program.showHelpAfterError();

program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
});

// Parse arguments
program.parse();
