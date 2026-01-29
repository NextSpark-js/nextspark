import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';

interface SetupAIOptions {
  editor?: string;
}

/**
 * Resolve the ai-workflow package path.
 * Checks node_modules first, then monorepo workspace.
 */
function resolveAIWorkflowPath(): string | null {
  const cwd = process.cwd();

  // Check node_modules (consumer project — flat or workspace root)
  const nmPath = join(cwd, 'node_modules', '@nextsparkjs', 'ai-workflow');
  if (existsSync(nmPath)) return nmPath;

  // Check web/node_modules (monorepo with hoisted deps in web/)
  const webNmPath = join(cwd, 'web', 'node_modules', '@nextsparkjs', 'ai-workflow');
  if (existsSync(webNmPath)) return webNmPath;

  // Check monorepo workspace (packages/ai-workflow relative to project root)
  const monoPath = join(cwd, 'packages', 'ai-workflow');
  if (existsSync(monoPath)) return monoPath;

  return null;
}

const VALID_EDITORS = ['claude', 'cursor', 'antigravity', 'all'];

export async function setupAICommand(options: SetupAIOptions): Promise<void> {
  const editor = options.editor || 'claude';

  if (!VALID_EDITORS.includes(editor)) {
    console.log(chalk.red(`  Unknown editor: ${editor}`));
    console.log(chalk.gray(`  Available: ${VALID_EDITORS.join(', ')}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.cyan('  AI Workflow Setup'));
  console.log(chalk.gray('  ' + '-'.repeat(40)));
  console.log('');

  // 1. Find ai-workflow package
  const pkgPath = resolveAIWorkflowPath();

  if (!pkgPath) {
    console.log(chalk.red('  @nextsparkjs/ai-workflow package not found.'));
    console.log('');
    console.log(chalk.gray('  Install it first:'));
    console.log(chalk.cyan('    pnpm add -D -w @nextsparkjs/ai-workflow'));
    console.log('');
    process.exit(1);
  }

  // 2. Verify setup script exists
  const setupScript = join(pkgPath, 'scripts', 'setup.mjs');
  if (!existsSync(setupScript)) {
    console.log(chalk.red('  Setup script not found in ai-workflow package.'));
    console.log(chalk.gray(`  Expected: ${setupScript}`));
    process.exit(1);
  }

  // 3. Run setup script
  const spinner = ora({
    text: `Setting up AI workflow for ${editor}...`,
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
    console.log(chalk.red('  AI workflow setup failed.'));
    if (error instanceof Error) {
      console.log(chalk.gray(`  ${error.message}`));
    }
    process.exit(1);
  }
}
