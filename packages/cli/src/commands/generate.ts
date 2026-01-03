import { spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';

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

    const scriptName = options.watch ? 'registry-watch.js' : 'registry-build.js';
    const action = options.watch ? 'Watching' : 'Generating';

    console.log(chalk.blue(`\n${action} registries...`));

    const generateProcess = spawn('node', [`scripts/${scriptName}`], {
      cwd: coreDir,
      stdio: 'inherit',
      env: {
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
