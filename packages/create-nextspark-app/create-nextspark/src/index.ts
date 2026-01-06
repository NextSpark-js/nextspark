#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

program
  .name('create-nextspark-app')
  .description('Create a new NextSpark project')
  .version('0.1.0-beta.4')
  .argument('[project-name]', 'Name of the project')
  .option('--quick', 'Quick mode (essential steps only)')
  .option('--expert', 'Expert mode (all options)')
  .option('--preset <name>', 'Use preset (saas, blog, crm)')
  .option('--theme <name>', 'Pre-select theme (default, blog, crm, productivity, none)')
  .option('--plugins <list>', 'Pre-select plugins (comma-separated)')
  .option('-y, --yes', 'Skip confirmations')
  .option('--use-npm', 'Use npm instead of pnpm')
  .option('--use-yarn', 'Use yarn instead of pnpm')
  .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
    await createProject(projectName, options);
  });

function detectPackageManager(options: Record<string, unknown>): 'pnpm' | 'npm' | 'yarn' {
  if (options.useNpm) return 'npm';
  if (options.useYarn) return 'yarn';
  return 'pnpm';
}

async function createProject(
  projectName: string | undefined,
  options: Record<string, unknown>
): Promise<void> {
  console.log('');
  console.log(chalk.cyan('⚡ Creating NextSpark project...'));
  console.log('');

  const pm = detectPackageManager(options);

  // 1. Determine project directory
  const targetDir = projectName
    ? resolve(process.cwd(), projectName)
    : process.cwd();

  // 2. Create directory if needed
  if (projectName) {
    if (existsSync(targetDir)) {
      console.log(chalk.yellow(`  Directory ${projectName}/ already exists`));
    } else {
      mkdirSync(targetDir, { recursive: true });
      console.log(chalk.gray(`  Created directory: ${projectName}/`));
    }
  }

  // 3. Change to target directory
  process.chdir(targetDir);

  // 4. Create Next.js project first (if not exists)
  if (!existsSync(join(targetDir, 'package.json'))) {
    console.log(chalk.blue('  Creating Next.js project...'));
    const createNextCmd = pm === 'pnpm'
      ? 'pnpm create next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm'
      : pm === 'yarn'
      ? 'yarn create next-app . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-yarn'
      : 'npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm';

    try {
      execSync(createNextCmd, { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('  Failed to create Next.js project'));
      process.exit(1);
    }
  }

  // 5. Install @nextsparkjs/cli
  console.log(chalk.blue('  Installing NextSpark CLI...'));
  const installCmd = pm === 'pnpm' ? 'pnpm add' : pm === 'yarn' ? 'yarn add' : 'npm install';
  try {
    execSync(`${installCmd} @nextsparkjs/cli`, { stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red('  Failed to install @nextsparkjs/cli'));
    process.exit(1);
  }

  // 6. Run nextspark init with wizard
  console.log(chalk.blue('  Running NextSpark wizard...'));

  const args = ['nextspark', 'init'];
  if (options.quick) args.push('--quick');
  if (options.expert) args.push('--expert');
  if (options.preset) args.push(`--preset=${options.preset}`);
  if (options.theme) args.push(`--theme=${options.theme}`);
  if (options.plugins) args.push(`--plugins=${options.plugins}`);
  if (options.yes) args.push('--yes');

  const child = spawn('npx', args, {
    stdio: 'inherit',
    cwd: targetDir,
  });

  child.on('error', (err) => {
    console.error(chalk.red(`  Error: ${err.message}`));
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('');
      console.log(chalk.green('✨ NextSpark project created successfully!'));
      console.log('');
      console.log(chalk.white('  Next steps:'));
      if (projectName) {
        console.log(chalk.cyan(`    cd ${projectName}`));
      }
      console.log(chalk.cyan(`    ${pm} dev`));
      console.log('');
    } else {
      process.exit(code ?? 1);
    }
  });
}

program.parse();
