import { spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';

/**
 * Build all registries (one-time generation)
 */
export async function registryBuildCommand(): Promise<void> {
  const spinner = ora('Building registries...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.text = `Building registries (${mode} mode)...`;

    const buildProcess = spawn('node', ['scripts/registry-build.js'], {
      cwd: coreDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: projectRoot,
      },
    });

    let stdout = '';
    let stderr = '';

    buildProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    buildProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        spinner.succeed('Registries built successfully');
        if (stdout.trim()) {
          console.log(chalk.gray(stdout.trim()));
        }
        process.exit(0);
      } else {
        spinner.fail('Registry build failed');
        if (stderr.trim()) {
          console.error(chalk.red(stderr.trim()));
        }
        process.exit(code ?? 1);
      }
    });

    buildProcess.on('error', (err) => {
      spinner.fail('Registry build failed');
      console.error(chalk.red(err.message));
      process.exit(1);
    });
  } catch (error) {
    spinner.fail('Registry build failed');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}

/**
 * Watch registries for changes and rebuild automatically
 */
export async function registryWatchCommand(): Promise<void> {
  const spinner = ora('Starting registry watcher...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.succeed(`Registry watcher started (${mode} mode)`);
    console.log(chalk.blue('\nWatching for changes... Press Ctrl+C to stop.\n'));

    const watchProcess = spawn('node', ['scripts/registry-watch.js'], {
      cwd: coreDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: projectRoot,
      },
    });

    watchProcess.on('error', (err) => {
      console.error(chalk.red(`Watcher error: ${err.message}`));
      process.exit(1);
    });

    // Handle termination
    const cleanup = () => {
      console.log(chalk.yellow('\nStopping registry watcher...'));
      if (!watchProcess.killed) {
        watchProcess.kill('SIGTERM');
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    watchProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`\nWatcher exited with code ${code}`));
      }
      process.exit(code ?? 0);
    });
  } catch (error) {
    spinner.fail('Failed to start registry watcher');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
