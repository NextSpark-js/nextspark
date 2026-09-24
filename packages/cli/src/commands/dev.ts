import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { resolveBundlerArgs, type Bundler } from '../utils/next-bundler.js';
import { nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { registryBuildBlocker, runRegistryBuild } from '../utils/registry-build.js';
import { loadCoreWritePlaces } from '../utils/core-write-places.js';

interface DevOptions {
  port: string;
  registry: boolean;
  turbopack: boolean;
  /** Extra flags forwarded verbatim to `next dev` */
  nextArgs?: string[];
}

/**
 * Build the registries before Next starts.
 *
 * On every start, not only when a registry is missing: the build also
 * regenerates `src/app/(templates)/`, which has to follow the app layouts and theme
 * templates the project has now. Whatever it replaces or removes there is backed
 * up, and the lines saying so are printed.
 *
 * Failure is reported and not fatal: what is already on disk may well be enough
 * to boot, and refusing to start the dev server helps nobody.
 *
 * Each line of the build's output repeated here is printed with a call of its
 * own, which shows it the way `shownLine` shows a line.
 */
export async function buildRegistries(coreDir: string, projectRoot: string): Promise<void> {
  console.log(chalk.blue('[Registry] Building registries...'));
  const result = await runRegistryBuild(coreDir, projectRoot);

  if (result.status === 'skipped') {
    console.warn(chalk.yellow(`[Registry] Skipped: ${result.reason}.`));
    return;
  }

  for (const line of result.templatesLines) {
    console.log(chalk.gray(`[Registry] ${line}`));
  }

  if (result.status === 'failed') {
    console.warn(chalk.yellow('[Registry] Registry build failed; starting anyway.'));
    for (const line of result.failureLines) {
      console.warn(chalk.gray(line));
    }
  }
}

export async function devCommand(options: DevOptions): Promise<void> {
  const spinner = ora('Starting development environment...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.succeed(`Core found at: ${coreDir} (${mode} mode)`);

    // Checked before anything runs, so a dev server that can't be shown writes nothing either
    const blocker = nextOutputBlocker(projectRoot);
    if (blocker) {
      console.error(chalk.red(`[Dev] Not started: ${blocker}.`));
      console.error(chalk.yellow('[Dev] Move the project to a directory whose path holds no such character.'));
      process.exit(1);
    }

    // The registry build checks where it writes before writing; the check runs
    // here first too, from the same core, since with --registry Next starts
    // alongside the build, and a build that can't write is no dev server to start
    if (registryBuildBlocker(projectRoot) === null) {
      const core = await loadCoreWritePlaces(coreDir);
      const unsafe = core.unsafeWritePlaces(projectRoot);
      if (unsafe.length > 0) {
        console.error(chalk.red("[Registry] Not started: the registry build can't write safely under these paths"));
        for (const line of core.unsafeWritePlacesLines(unsafe)) console.error(chalk.red(`  ${line}`));
        process.exit(1);
      }
    }

    const processes: ChildProcess[] = [];

    // With --registry the watcher builds on start, before it starts watching
    if (!options.registry) {
      await buildRegistries(coreDir, projectRoot);

      // What the build rewrites that git tracks stays tracked, whatever its .gitignore says; with
      // --registry, the build's own output says so
      const core = await loadCoreWritePlaces(coreDir);
      const trackedRegistries = core.trackedFilesUnder(projectRoot, '.nextspark/registries');
      if (trackedRegistries.length > 0) {
        const [warning, untrack] = core.trackedRegistriesLines(trackedRegistries.length);
        console.warn(chalk.yellow(`[Registry] ⚠ ${warning}`));
        console.warn(chalk.gray(`[Registry]   ${untrack}`));
      }
    }

    // Start registry watcher if enabled
    if (options.registry) {
      console.log(chalk.blue('\n[Registry] Starting registry builder with watch mode...'));

      // Use the unified root-first registry builder with watch mode.
      const registryProcess = spawn('node', [join(coreDir, 'scripts/build/registry.mjs'), '--watch'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
      });

      processes.push(registryProcess);

      registryProcess.on('error', (err) => {
        console.error(chalk.red(`[Registry] Error: ${err.message}`));
      });
    }

    // Start Next.js dev server
    const bundler: Bundler = options.turbopack ? 'turbopack' : 'webpack';
    const nextArgs = [
      'next',
      'dev',
      ...resolveBundlerArgs(bundler, projectRoot),
      '-p',
      options.port,
      ...(options.nextArgs ?? []),
    ];

    const bundlerLabel = options.turbopack ? 'Turbopack' : 'Webpack';
    console.log(chalk.green(`\n[Dev] Starting Next.js dev server on port ${options.port} (${bundlerLabel})...`));

    const devProcess = spawnNext(nextArgs, {
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
