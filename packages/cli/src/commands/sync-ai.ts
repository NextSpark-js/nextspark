import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getAIWorkflowDir } from '../utils/paths.js';

interface SyncAIOptions {
  editor?: string;
  force?: boolean;
}

const VALID_EDITORS = ['claude', 'cursor', 'antigravity', 'all'];

export async function syncAICommand(options: SyncAIOptions): Promise<void> {
  const editor = options.editor || 'claude';

  if (!VALID_EDITORS.includes(editor)) {
    console.log(chalk.red(`  Unknown editor: ${editor}`));
    console.log(chalk.gray(`  Available: ${VALID_EDITORS.join(', ')}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.cyan('  AI Workflow Sync'));
  console.log(chalk.gray('  ' + '-'.repeat(40)));
  console.log('');

  // 1. Verify .claude/ exists (must have been set up already)
  const editorDir = editor === 'cursor' ? '.cursor' : '.claude';
  const editorDirPath = join(process.cwd(), editorDir);

  if (!existsSync(editorDirPath)) {
    console.log(chalk.red(`  No ${editorDir}/ directory found.`));
    console.log('');
    console.log(chalk.gray('  AI workflow must be set up first. Run:'));
    console.log(chalk.cyan('    nextspark setup:ai --editor ' + editor));
    console.log('');
    process.exit(1);
  }

  // 2. Find ai-workflow package
  const pkgPath = getAIWorkflowDir();

  if (!pkgPath) {
    console.log(chalk.red('  @nextsparkjs/ai-workflow package not found.'));
    console.log('');
    console.log(chalk.gray('  Install it first:'));
    console.log(chalk.cyan('    pnpm add -D -w @nextsparkjs/ai-workflow'));
    console.log('');
    process.exit(1);
  }

  // 3. Verify setup script exists
  const setupScript = join(pkgPath, 'scripts', 'setup.mjs');
  if (!existsSync(setupScript)) {
    console.log(chalk.red('  Setup script not found in ai-workflow package.'));
    console.log(chalk.gray(`  Expected: ${setupScript}`));
    process.exit(1);
  }

  // 4. Confirmation prompt (unless --force)
  if (!options.force) {
    console.log(chalk.yellow('  This will sync AI workflow files from @nextsparkjs/ai-workflow.'));
    console.log(chalk.gray('  Framework files will be overwritten. Custom files will be preserved.'));
    console.log(chalk.gray('  Config JSON files will never be overwritten.\n'));

    try {
      const { confirm } = await import('@inquirer/prompts');
      const confirmed = await confirm({
        message: 'Proceed with sync?',
        default: true,
      });

      if (!confirmed) {
        console.log(chalk.yellow('\n  Sync cancelled.\n'));
        process.exit(0);
      }
    } catch {
      console.error(chalk.red('\n  Failed to load confirmation prompt. Use --force to skip.\n'));
      process.exit(1);
    }
  }

  // 5. Run setup script
  const spinner = ora({
    text: `Syncing AI workflow for ${editor}...`,
    prefixText: '  ',
  }).start();

  try {
    spinner.stop();
    execSync(`node "${setupScript}" ${editor}`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  } catch (error) {
    console.log('');
    console.log(chalk.red('  AI workflow sync failed.'));
    if (error instanceof Error) {
      console.log(chalk.gray(`  ${error.message}`));
    }
    process.exit(1);
  }
}
