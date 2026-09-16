import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { errorLines, errorWithLines } from '../utils/shown-path.js';
import { buildFailureLines } from '../utils/registry-build.js';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';
import { effectiveBundler, pickBundler, resolveBundlerArgs } from '../utils/next-bundler.js';

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

interface BuildOptions {
  registry: boolean;
  webpack?: boolean;
  turbopack?: boolean;
  /** Extra flags forwarded verbatim to `next build` */
  nextArgs?: string[];
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const spinner = ora('Preparing production build...').start();

  try {
    const bundler = pickBundler(options);
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();

    spinner.succeed('Core package found');

    // Checked before anything runs, so a build that can't be shown writes nothing either
    const blocker = nextOutputBlocker(projectRoot);
    if (blocker) {
      spinner.fail('Build not started');
      console.error(chalk.red(`Next.js can't build this project where it is: ${blocker}.`));
      console.error(chalk.yellow('Move the project to a directory whose path holds no such character.'));
      process.exit(1);
    }

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    // Step 1: Generate registries if enabled
    if (options.registry) {
      spinner.start('Generating registries...');

      await new Promise<void>((resolve, reject) => {
        const registryProcess = spawn('node', ['scripts/build/registry.mjs'], {
          cwd: coreDir,
          stdio: 'pipe',
          env: {
            ...projectEnv,
            ...process.env,
            NEXTSPARK_PROJECT_ROOT: projectRoot,
          },
        });

        // core reports a build's failure over stdout as often as over stderr
        // (only its opt-in verbose stack trace is stderr-only), so the cause is
        // only complete when both streams are read together, in the order they
        // arrived
        let output = '';

        registryProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        registryProcess.stderr?.on('data', (data) => {
          output += data.toString();
        });

        registryProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(errorWithLines(['Registry generation failed:', ...buildFailureLines(output)]));
          }
        });

        registryProcess.on('error', reject);
      });

      spinner.succeed('Registries generated');
    }

    // Step 2: Run Next.js build
    const bundlerArgs = resolveBundlerArgs(bundler, projectRoot);
    const nextArgs = ['next', 'build', ...bundlerArgs, ...(options.nextArgs ?? [])];

    spinner.start('Building for production...');
    const running = effectiveBundler(bundler, projectRoot);
    console.log(chalk.blue(`[Build] Bundler: ${running === 'webpack' ? 'Webpack' : 'Turbopack'}`));

    const buildProcess = spawnNext(nextArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...projectEnv,
        ...process.env,
        NEXTSPARK_CORE_DIR: coreDir,
        NODE_ENV: 'production',
      },
    });

    buildProcess.on('error', (err) => {
      spinner.fail('Build failed');
      console.error(chalk.red(err.message));
      process.exit(1);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\nBuild completed successfully!'));
        process.exit(0);
      } else {
        console.error(chalk.red(`\nBuild failed with exit code ${code}`));
        process.exit(code ?? 1);
      }
    });
  } catch (error) {
    spinner.fail('Build preparation failed');
    if (error instanceof Error) {
      for (const line of errorLines(error)) console.error(chalk.red(line));
    }
    process.exit(1);
  }
}
