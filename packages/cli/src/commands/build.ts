import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';

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
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const spinner = ora('Preparing production build...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();

    spinner.succeed('Core package found');

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

        let stderr = '';

        registryProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        registryProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Registry generation failed: ${stderr}`));
          }
        });

        registryProcess.on('error', reject);
      });

      spinner.succeed('Registries generated');
    }

    // Step 2: Run Next.js build
    spinner.start('Building for production...');

    const buildProcess = spawn('npx', ['next', 'build'], {
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
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
