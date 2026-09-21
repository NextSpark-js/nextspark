import { spawn } from 'node:child_process';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { errorLines } from '../utils/shown-path.js';
import { runPreparation } from '../utils/preparation.js';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';
import { loadCoreWritePlaces } from '../utils/core-write-places.js';
import { effectiveBundler, pickBundler, resolveBundlerArgs } from '../utils/next-bundler.js';

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

    // Step 1: Generate registries if enabled
    if (options.registry) {
      spinner.start('Generating registries...');

      const preparation = await runPreparation(coreDir, projectRoot, { production: true });
      if (preparation.code !== 0) {
        spinner.fail('Registry generation failed');
        for (const line of preparation.failureLines) console.error(chalk.red(line));
        process.exit(preparation.code);
        return;
      }

      spinner.succeed('Registries generated');
      for (const line of preparation.successLines) console.log(chalk.gray(line));

      // What the build rewrites that git tracks stays tracked, whatever its .gitignore says
      const core = await loadCoreWritePlaces(coreDir);
      const trackedRegistries = core.trackedFilesUnder(projectRoot, '.nextspark/registries');
      if (trackedRegistries.length > 0) {
        const [warning, untrack] = core.trackedRegistriesLines(trackedRegistries.length);
        console.log(chalk.yellow(`⚠ ${warning}`));
        console.log(chalk.gray(`  ${untrack}`));
      }
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
