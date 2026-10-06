import { spawn } from 'node:child_process';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { nextCommand, nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { errorLines } from '../utils/shown-path.js';
import { coreHostMode, hostBlockerLines, runAuthReadiness, runHostPreparation } from '../utils/preparation.js';
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

    // Also before anything runs: a missing Next throws here, before `prepare --production` has done any work
    nextCommand(projectRoot);

    // A core with a route manifest generates the whole src/app (#203): `prepare --production`
    // must succeed before Next builds, and --no-registry only skips regenerating a host that
    // `prepare --check` finds up to date; a committed app tree is not built (nextspark migrate)
    const { mode: hostMode } = await coreHostMode(coreDir, projectRoot);
    const hostBlocker = hostBlockerLines(hostMode);
    if (hostBlocker) {
      spinner.fail('Build not started: src/app is not a generated host');
      for (const line of hostBlocker) console.error(chalk.red(line));
      process.exit(1);
      return;
    }

    // Step 1: Generate registries if enabled
    if (!options.registry) {
      spinner.start('Checking the generated host is up to date...');
      const checked = await runHostPreparation(coreDir, projectRoot, { check: true });
      if (checked.code !== 0) {
        spinner.fail('The generated host is not up to date; build without --no-registry, or run nextspark prepare first');
        for (const line of checked.failureLines) console.error(chalk.red(line));
        process.exit(checked.code);
        return;
      }
      spinner.succeed('Generated host up to date');
    }
    if (options.registry) {
      spinner.start('Generating src/app and registries, checking auth readiness...');

      const preparation = await runHostPreparation(coreDir, projectRoot, { production: true });
      if (preparation.code !== 0) {
        spinner.fail('Production preparation failed');
        for (const line of preparation.failureLines) console.error(chalk.red(line));
        process.exit(preparation.code);
        return;
      }

      spinner.succeed('src/app and registries generated, auth readiness checked');
      for (const line of preparation.successLines) console.log(chalk.gray(line));

      // What the build rewrites that git tracks stays tracked, whatever its .gitignore says
      const core = await loadCoreWritePlaces(coreDir);
      const trackedRegistries = core.trackedFilesUnder(projectRoot, '.nextspark/registries');
      if (trackedRegistries.length > 0) {
        const [warning, untrack] = core.trackedRegistriesLines(trackedRegistries.length);
        console.log(chalk.yellow(`⚠ ${warning}`));
        console.log(chalk.gray(`  ${untrack}`));
      }
    } else {
      // Skipping the registry doesn't skip the auth readiness check that production preparation runs
      spinner.start('Checking production auth readiness...');
      const readiness = await runAuthReadiness(coreDir, projectRoot);
      if (readiness.code !== 0) {
        spinner.fail('Production auth readiness failed');
        for (const line of readiness.failureLines) console.error(chalk.red(line));
        process.exit(readiness.code);
        return;
      }
      spinner.succeed('Production auth readiness checked');
      for (const line of readiness.successLines) console.log(chalk.gray(line));
    }

    // Step 2: Run Next.js build
    const bundlerArgs = resolveBundlerArgs(bundler, projectRoot);
    const nextArgs = ['build', ...bundlerArgs, ...(options.nextArgs ?? [])];

    spinner.start('Building for production...');
    const running = effectiveBundler(bundler, projectRoot);
    console.log(chalk.blue(`[Build] Bundler: ${running === 'webpack' ? 'Webpack' : 'Turbopack'}`));

    const buildProcess = spawnNext(projectRoot, nextArgs, {
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
