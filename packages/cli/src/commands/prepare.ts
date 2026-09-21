import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { preparationWatchExitCode, preparationWatchWriteGuard, runPreparation, startPreparationWatch } from '../utils/preparation.js';
import { errorLines } from '../utils/shown-path.js';

export interface PrepareOptions {
  production?: boolean;
  watch?: boolean;
}

export async function prepareCommand(options: PrepareOptions): Promise<void> {
  const spinner = ora(options.watch ? 'Starting preparation watcher...' : 'Preparing registries...').start();
  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    if (options.watch) {
      const unsafeLines = await preparationWatchWriteGuard(coreDir, projectRoot);
      if (unsafeLines.length > 0) {
        spinner.fail("Preparation watcher not started: the registry build can't write safely under these paths");
        for (const line of unsafeLines) console.error(chalk.red(`  ${line}`));
        process.exit(1);
        return;
      }
      const watcher = startPreparationWatch(coreDir, projectRoot, options);
      let stopping = false;
      const cleanup = () => {
        if (stopping) return;
        stopping = true;
        console.log(chalk.yellow('\nStopping preparation watcher...'));
        if (!watcher.killed) watcher.kill('SIGTERM');
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      watcher.on('spawn', () => spinner.info(`Preparation watcher running (${mode} mode). Press Ctrl+C to stop.`));
      watcher.on('error', (error) => {
        spinner.fail('Preparation watcher not started');
        console.error(chalk.red(error.message));
        process.exit(1);
      });
      watcher.on('close', (code, signal) => process.exit(preparationWatchExitCode(stopping, code, signal)));
      return;
    }

    const result = await runPreparation(coreDir, projectRoot, options);
    if (result.code !== 0) {
      spinner.fail('Preparation failed');
      for (const line of result.failureLines) console.error(chalk.red(line));
      process.exit(result.code);
      return;
    }
    spinner.succeed(`Registries prepared (${mode} mode)`);
    for (const line of result.successLines) console.log(chalk.gray(line));
  } catch (error) {
    spinner.fail('Preparation failed');
    if (error instanceof Error) for (const line of errorLines(error)) console.error(chalk.red(line));
    process.exit(1);
  }
}
