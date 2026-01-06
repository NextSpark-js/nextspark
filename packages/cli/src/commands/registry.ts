import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';

/**
 * Load environment variables from project root .env file
 */
function loadProjectEnv(projectRoot: string): Record<string, string> {
  const envPath = join(projectRoot, '.env');
  const envVars: Record<string, string> = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=');
          // Remove surrounding quotes
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          envVars[key] = value;
        }
      }
    }
  }

  return envVars;
}

/**
 * Build all registries (one-time generation)
 */
export async function registryBuildCommand(): Promise<void> {
  const spinner = ora('Building registries...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    spinner.text = `Building registries (${mode} mode)...`;

    const buildProcess = spawn('node', ['scripts/build/registry.mjs'], {
      cwd: coreDir,
      stdio: 'pipe',
      env: {
        ...projectEnv,
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

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    const watchProcess = spawn('node', ['scripts/build/registry.mjs', '--watch'], {
      cwd: coreDir,
      stdio: 'inherit',
      env: {
        ...projectEnv,
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
