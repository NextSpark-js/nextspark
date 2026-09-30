import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import {
  HOST_PREPARE_SCRIPT,
  coreHostMode,
  preparationWatchExitCode,
  preparationWatchWriteGuard,
  runHostPreparation,
  runPreparation,
  startHostWatch,
  startPreparationWatch,
} from '../utils/preparation.js';
import { errorLines } from '../utils/shown-path.js';

export interface PrepareOptions {
  production?: boolean;
  watch?: boolean;
  check?: boolean;
  /** With --check: compare with the development host `nextspark dev` writes, instead of the production one. */
  dev?: boolean;
  /** Generate (or with --check, compare) only the portable contracts module, in any mode. */
  contractsOnly?: boolean;
}

export async function prepareCommand(options: PrepareOptions): Promise<void> {
  const spinner = ora(options.check ? 'Checking the generated host...' : options.watch ? 'Starting preparation watcher...' : 'Preparing registries...').start();
  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';
    // A core with a route manifest generates the whole src/app (#203), unless src/app is still a
    // committed app tree no generation owns: that project keeps the legacy registry build
    const { mode: hostMode } = await coreHostMode(coreDir, projectRoot);
    const host = hostMode === 'host';

    if (options.contractsOnly) {
      if (options.watch || options.dev) {
        spinner.fail('--contracts-only generates or checks once: it cannot be combined with --watch or --dev');
        process.exit(1);
        return;
      }
      const contracts = await runHostPreparation(coreDir, projectRoot, { contractsOnly: true, check: options.check });
      if (contracts.code !== 0) {
        spinner.fail(options.check ? 'The portable contracts are not up to date' : 'Generating the portable contracts failed');
        for (const line of contracts.failureLines) console.error(chalk.red(line));
        process.exit(contracts.code);
        return;
      }
      spinner.succeed(options.check ? 'The portable contracts are up to date' : 'Portable contracts generated');
      for (const line of contracts.successLines) console.log(chalk.gray(line));
      return;
    }

    if (options.dev && !options.check) {
      spinner.fail('--dev only applies to --check (nextspark dev writes the development host itself)');
      process.exit(1);
      return;
    }

    if (options.check) {
      if (options.watch) {
        spinner.fail('--check and --watch cannot be combined');
        process.exit(1);
        return;
      }
      if (hostMode === 'legacy-app') {
        spinner.fail('Legacy mode: src/app is not a generated host, so it cannot be checked (not fresh)');
        process.exit(1);
        return;
      }
      if (!host) {
        spinner.fail('The installed @nextsparkjs/core does not generate src/app, so there is nothing to check');
        console.error(chalk.red('prepare --check needs a @nextsparkjs/core that ships a route manifest (@nextsparkjs/core/routes/manifest.json).'));
        process.exit(1);
        return;
      }
      const checked = await runHostPreparation(coreDir, projectRoot, { check: true, dev: options.dev });
      if (checked.code !== 0) {
        spinner.fail('The generated host is not up to date');
        for (const line of checked.failureLines) console.error(chalk.red(line));
        process.exit(checked.code);
        return;
      }
      spinner.succeed('src/app and the registries are up to date');
      return;
    }

    if (options.watch) {
      const unsafeLines = await preparationWatchWriteGuard(coreDir, projectRoot);
      if (unsafeLines.length > 0) {
        spinner.fail("Preparation watcher not started: the registry build can't write safely under these paths");
        for (const line of unsafeLines) console.error(chalk.red(`  ${line}`));
        process.exit(1);
        return;
      }
      const watcher = host ? startHostWatch(coreDir, projectRoot, options) : startPreparationWatch(coreDir, projectRoot, options);
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

    const result = host ? await runHostPreparation(coreDir, projectRoot, options) : await runPreparation(coreDir, projectRoot, options);
    if (result.code !== 0) {
      spinner.fail('Preparation failed');
      for (const line of result.failureLines) console.error(chalk.red(line));
      process.exit(result.code);
      return;
    }
    // The portable contracts do not depend on how src/app is produced: a legacy project (committed
    // src/app) gets them here; a generated host has them from the run above.
    let contractLines: string[] = [];
    if (!host && existsSync(join(coreDir, HOST_PREPARE_SCRIPT))) {
      const contracts = await runHostPreparation(coreDir, projectRoot, { contractsOnly: true });
      if (contracts.code !== 0) {
        spinner.fail('Generating the portable contracts failed');
        for (const line of [...result.successLines, ...contracts.failureLines]) console.error(chalk.red(line));
        process.exit(contracts.code);
        return;
      }
      contractLines = contracts.successLines;
    }
    spinner.succeed(host ? `src/app and registries prepared (${mode} mode)` : `Registries prepared (${mode} mode)`);
    for (const line of [...result.successLines, ...contractLines]) console.log(chalk.gray(line));
  } catch (error) {
    spinner.fail('Preparation failed');
    if (error instanceof Error) for (const line of errorLines(error)) console.error(chalk.red(line));
    process.exit(1);
  }
}
