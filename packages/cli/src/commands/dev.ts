import { spawn, ChildProcess } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';

interface DevOptions {
  port: string;
  registry: boolean;
}

export async function devCommand(options: DevOptions): Promise<void> {
  const spinner = ora('Starting development environment...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.succeed(`Core found at: ${coreDir} (${mode} mode)`);

    const processes: ChildProcess[] = [];

    // Start registry watcher if enabled
    if (options.registry) {
      console.log(chalk.blue('\n[Registry] Starting registry watcher...'));

      const registryProcess = spawn('node', ['scripts/registry-watch.js'], {
        cwd: coreDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXTSPARK_PROJECT_ROOT: projectRoot,
        },
      });

      processes.push(registryProcess);

      registryProcess.on('error', (err) => {
        console.error(chalk.red(`[Registry] Error: ${err.message}`));
      });
    }

    // Start Next.js dev server
    console.log(chalk.green(`\n[Dev] Starting Next.js dev server on port ${options.port}...`));

    const devProcess = spawn('npx', ['next', 'dev', '-p', options.port], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXTSPARK_CORE_DIR: coreDir,
      },
    });

    processes.push(devProcess);

    devProcess.on('error', (err) => {
      console.error(chalk.red(`[Dev] Error: ${err.message}`));
      process.exit(1);
    });

    // Handle process termination
    const cleanup = () => {
      console.log(chalk.yellow('\nShutting down...'));
      processes.forEach((p) => {
        if (!p.killed) {
          p.kill('SIGTERM');
        }
      });
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Wait for dev process to exit
    devProcess.on('exit', (code) => {
      cleanup();
      process.exit(code ?? 0);
    });
  } catch (error) {
    spinner.fail('Failed to start development environment');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
