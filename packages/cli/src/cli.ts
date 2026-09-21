#!/usr/bin/env node

import { config } from 'dotenv';
import { Command } from 'commander';
import chalk from './utils/colors.js';
import { readFileSync } from 'fs';
import { devCommand } from './commands/dev.js';
import { breaksALine, guardOutput, shownLine, shownPath } from './utils/shown-path.js';

// Guard CLI output before dotenv or a command can print anything
guardOutput();

// Load .env from project root
config();
import { buildCommand } from './commands/build.js';
import { generateCommand } from './commands/generate.js';
import { prepareCommand } from './commands/prepare.js';
import { registryBuildCommand, registryWatchCommand } from './commands/registry.js';
import { initCommand } from './commands/init.js';
import { addPluginCommand } from './commands/add-plugin.js';
import { addThemeCommand } from './commands/add-theme.js';
import { addMobileCommand } from './commands/add-mobile.js';
import { doctorCommand } from './commands/doctor.js';
import { dbMigrateCommand, dbSeedCommand } from './commands/db.js';
import { syncAppCommand } from './commands/sync-app.js';
import { setupAICommand } from './commands/setup-ai.js';
import { syncAICommand } from './commands/sync-ai.js';

// Read version from package.json dynamically
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const program = new Command();

program
  .name('nextspark')
  .description('NextSpark CLI - Professional SaaS Boilerplate')
  .version(pkg.version);

// Dev command (Turbopack, no registry watcher — fast daily development)
program
  .command('dev')
  .description('Start development server with Turbopack (fast)')
  .argument('[nextArgs...]', 'Extra arguments forwarded to `next dev`')
  .option('-p, --port <port>', 'Port to run the dev server on', process.env.PORT || '3000')
  .option('--no-turbopack', 'Disable Turbopack (use Webpack)')
  .option('--webpack', 'Use Webpack instead of Turbopack (same as --no-turbopack)')
  .option('--registry', 'Enable registry watcher')
  .allowUnknownOption()
  .action((nextArgs, opts) =>
    devCommand({ ...opts, turbopack: opts.webpack ? false : opts.turbopack, nextArgs })
  );

// Dev with registry watcher (Webpack, auto-detects new entities/templates/blocks)
program
  .command('dev:registry')
  .description('Start dev server with registry watcher (use when creating entities/templates/blocks)')
  .argument('[nextArgs...]', 'Extra arguments forwarded to `next dev`')
  .option('-p, --port <port>', 'Port to run the dev server on', process.env.PORT || '3000')
  .option('--turbopack', 'Enable Turbopack')
  .allowUnknownOption()
  .action((nextArgs, opts) =>
    devCommand({ ...opts, registry: true, turbopack: opts.turbopack ?? false, nextArgs })
  );

// Build command
program
  .command('build')
  .description('Build for production')
  .argument('[nextArgs...]', 'Extra arguments forwarded to `next build`')
  .option('--no-registry', 'Skip registry generation before build')
  .option('--webpack', 'Build with Webpack (Next 16 requires it when next.config defines webpack())')
  .option('--turbopack', 'Build with Turbopack')
  .allowUnknownOption()
  .action((nextArgs, opts) => buildCommand({ ...opts, nextArgs }));

// Prepare command
program
  .command('prepare')
  .description('Generate the current registry output before development or a build')
  .option('-w, --watch', 'Watch for changes and prepare again')
  .option('--production', 'Run the registry compiler with NODE_ENV=production')
  .action(prepareCommand);

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
  .description('Initialize NextSpark project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--wizard', 'Run full project wizard')
  .option('--quick', 'Quick wizard mode (essential steps only)')
  .option('--expert', 'Expert wizard mode (all options)')
  .option('--preset <name>', 'Use preset configuration (saas, blog, crm)')
  .option('--theme <name>', 'Pre-select theme (default, blog, crm, productivity, none)')
  .option('--plugins <list>', 'Pre-select plugins (comma-separated)')
  .option('-y, --yes', 'Skip confirmations')
  .option('--registries-only', 'Only create registries (no wizard)')
  .option('--name <name>', 'Project name (non-interactive mode)')
  .option('--slug <slug>', 'Project slug (non-interactive mode)')
  .option('--description <desc>', 'Project description (non-interactive mode)')
  .option('--type <type>', 'Project type: web or web-mobile (non-interactive mode)')
  .action(initCommand);

// Add plugin command
program
  .command('add:plugin <package>')
  .description('Add a plugin to your project')
  .option('-v, --version <version>', 'Specific version to install')
  .option('-f, --force', 'Overwrite if already exists')
  .option('--skip-postinstall', 'Skip postinstall hooks')
  .option('--no-deps', 'Skip installing dependencies')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(addPluginCommand);

// Add theme command
program
  .command('add:theme <package>')
  .description('Add a theme to your project')
  .option('-v, --version <version>', 'Specific version to install')
  .option('-f, --force', 'Overwrite if already exists')
  .option('--skip-postinstall', 'Skip postinstall hooks')
  .option('--no-deps', 'Skip installing dependencies')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(addThemeCommand);

// Add mobile command
program
  .command('add:mobile')
  .description('Add mobile app to your project')
  .option('-f, --force', 'Overwrite if already exists')
  .option('--skip-install', 'Skip npm install')
  .action(addMobileCommand);

// Doctor command (health check)
program
  .command('doctor')
  .description('Run health check on NextSpark project')
  .action(doctorCommand);

// Database commands
const db = program
  .command('db')
  .description('Database management commands');

db
  .command('migrate')
  .description('Run database migrations')
  .action(dbMigrateCommand);

db
  .command('seed')
  .description('Seed database with sample data')
  .action(dbSeedCommand);

// Shorthand aliases for database commands
program
  .command('db:migrate')
  .description('Run database migrations (alias)')
  .action(dbMigrateCommand);

program
  .command('db:seed')
  .description('Seed database with sample data (alias)')
  .action(dbSeedCommand);

// Sync app command
program
  .command('sync:app')
  .description('Sync /app folder with @nextsparkjs/core templates')
  .option('--dry-run', 'Preview changes without applying')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--backup', 'Backup existing files before overwriting')
  .option('--overwrite <paths...>', "Replace these customized files with core's version, backing each one up first")
  .option('-v, --verbose', 'Show detailed file operations')
  .action(syncAppCommand);

// Setup AI workflow
program
  .command('setup:ai')
  .description('Setup AI workflow for your editor (Claude Code, Cursor, Antigravity)')
  .option('-e, --editor <editor>', 'Editor to setup (claude, cursor, antigravity, all)', 'claude')
  .action(setupAICommand);

// Sync AI workflow
program
  .command('sync:ai')
  .description('Sync AI workflow files from @nextsparkjs/ai-workflow')
  .option('-e, --editor <editor>', 'Editor to sync (claude, cursor, antigravity, all)', 'claude')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(syncAICommand);

// Error handling
program.showHelpAfterError();

function shownCommanderLines(text: string): string {
  return text.split(/(?<=\n)/).map((line) => shownLine(line)).join('');
}

function shownCommanderError(text: string): string {
  let shown = text;
  for (const token of process.argv.slice(2)) {
    if (!breaksALine(token)) continue;
    const equals = token.indexOf('=');
    const candidates = [token];
    if (equals !== -1) candidates.push(token.slice(0, equals), token.slice(equals + 1));
    for (const candidate of [...new Set(candidates)].sort((left, right) => right.length - left.length)) {
      if (candidate && breaksALine(candidate)) shown = shown.split(candidate).join(shownPath(candidate));
    }
  }
  return shown.split('\n').some((line) => breaksALine(line)) ? shownLine(shown) : shown;
}

program.configureOutput({
  writeOut: (str) => process.stdout.write(shownCommanderLines(str)),
  writeErr: (str) => process.stderr.write(shownCommanderLines(str)),
  outputError: (str, write) => write(chalk.red(shownCommanderError(str))),
});

// Parse arguments
program.parse();
