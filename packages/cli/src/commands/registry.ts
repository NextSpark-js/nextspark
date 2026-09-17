import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { captureChildOutput } from '../utils/registry-build.js';
import { loadCoreWritePlaces } from '../utils/core-write-places.js';

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

    // core reports a build's failure over stdout as often as over stderr (only
    // its opt-in verbose stack trace is stderr-only), so the cause is only
    // complete when both streams are read together, in the order they arrived
    const output = captureChildOutput(buildProcess);

    buildProcess.on('close', (code) => {
      if (code === 0) {
        spinner.succeed('Registries built successfully');
        for (const line of output.successLines) console.log(chalk.gray(line));
        process.exit(0);
      } else {
        spinner.fail('Registry build failed');
        for (const line of output.failureLines) console.error(chalk.red(line));
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

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    // Where the build writes is checked before the watcher starts, as core's
    // build checks it before writing; the watcher is announced once it runs,
    // and whether a build works is what core's own output says
    const core = await loadCoreWritePlaces(coreDir);
    const unsafe = core.unsafeWritePlaces(projectRoot, [], { activeTheme: process.env.NEXT_PUBLIC_ACTIVE_THEME ?? projectEnv.NEXT_PUBLIC_ACTIVE_THEME });
    if (unsafe.length > 0) {
      spinner.fail("Registry watcher not started: the registry build can't write safely under these paths");
      for (const line of core.unsafeWritePlacesLines(unsafe)) console.error(chalk.red(`  ${line}`));
      process.exit(1);
    }

    const watchProcess = spawn('node', ['scripts/build/registry.mjs', '--watch'], {
      cwd: coreDir,
      stdio: 'inherit',
      env: {
        ...projectEnv,
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: projectRoot,
      },
    });

    watchProcess.on('spawn', () => {
      spinner.info(`Registry watcher running (${mode} mode): core builds the registries, then rebuilds them on changes. Press Ctrl+C to stop.`);
    });

    watchProcess.on('error', (err) => {
      spinner.fail('Registry watcher not started');
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
