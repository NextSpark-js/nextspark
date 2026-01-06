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

interface GenerateOptions {
  watch?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const spinner = ora('Preparing registry generation...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.succeed(`Core found at: ${coreDir} (${mode} mode)`);

    // Load project .env file
    const projectEnv = loadProjectEnv(projectRoot);

    const watchArg = options.watch ? ['--watch'] : [];
    const action = options.watch ? 'Watching' : 'Generating';

    console.log(chalk.blue(`\n${action} registries...`));

    const generateProcess = spawn('node', ['scripts/build/registry.mjs', ...watchArg], {
      cwd: coreDir,
      stdio: 'inherit',
      env: {
        ...projectEnv,
        ...process.env,
        NEXTSPARK_PROJECT_ROOT: projectRoot,
      },
    });

    generateProcess.on('error', (err) => {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    });

    generateProcess.on('close', (code) => {
      if (code === 0) {
        if (!options.watch) {
          console.log(chalk.green('\nRegistry generation completed!'));
        }
        process.exit(0);
      } else {
        console.error(chalk.red(`\nRegistry generation failed with exit code ${code}`));
        process.exit(code ?? 1);
      }
    });

    // Handle termination for watch mode
    if (options.watch) {
      const cleanup = () => {
        console.log(chalk.yellow('\nStopping watcher...'));
        if (!generateProcess.killed) {
          generateProcess.kill('SIGTERM');
        }
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }
  } catch (error) {
    spinner.fail('Registry generation failed');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
