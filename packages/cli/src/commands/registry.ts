import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { preparationWatchExitCode, preparationWatchWriteGuard, runPreparation, startPreparationWatch } from '../utils/preparation.js';
import { errorLines } from '../utils/shown-path.js';

/** Build all registries (one-time generation). */
export async function registryBuildCommand(): Promise<void> {
  const spinner = ora('Building registries...').start();
  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const result = await runPreparation(coreDir, projectRoot);
    if (result.code !== 0) {
      spinner.fail('Registry build failed');
      for (const line of result.failureLines) console.error(chalk.red(line));
      process.exit(result.code);
      return;
    }
    spinner.succeed(`Registries built successfully (${isMonorepoMode() ? 'monorepo' : 'npm'} mode)`);
    for (const line of result.successLines) console.log(chalk.gray(line));
    process.exit(0);
  } catch (error) {
    spinner.fail('Registry build failed');
    if (error instanceof Error) for (const line of errorLines(error)) console.error(chalk.red(line));
    process.exit(1);
  }
}

/** Watch registries for changes and rebuild automatically. */
export async function registryWatchCommand(): Promise<void> {
  const spinner = ora('Starting registry watcher...').start();
  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const unsafeLines = await preparationWatchWriteGuard(coreDir, projectRoot);
    if (unsafeLines.length > 0) {
      spinner.fail("Registry watcher not started: the registry build can't write safely under these paths");
      for (const line of unsafeLines) console.error(chalk.red(`  ${line}`));
      process.exit(1);
      return;
    }

    const watcher = startPreparationWatch(coreDir, projectRoot);
    let stopping = false;
    const cleanup = () => {
      if (stopping) return;
      stopping = true;
      console.log(chalk.yellow('\nStopping registry watcher...'));
      if (!watcher.killed) watcher.kill('SIGTERM');
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    watcher.on('spawn', () => spinner.info(`Registry watcher running (${isMonorepoMode() ? 'monorepo' : 'npm'} mode): core rebuilds registries on changes. Press Ctrl+C to stop.`));
    watcher.on('error', (error) => {
      spinner.fail('Registry watcher not started');
      console.error(chalk.red(`Watcher error: ${error.message}`));
      process.exit(1);
    });
    watcher.on('close', (code, signal) => process.exit(preparationWatchExitCode(stopping, code, signal)));
  } catch (error) {
    spinner.fail('Failed to start registry watcher');
    if (error instanceof Error) for (const line of errorLines(error)) console.error(chalk.red(line));
    process.exit(1);
  }
}
