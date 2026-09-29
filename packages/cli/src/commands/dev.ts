import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { resolveBundlerArgs, type Bundler } from '../utils/next-bundler.js';
import { nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { registryBuildBlocker, runRegistryBuild } from '../utils/registry-build.js';
import { loadCoreWritePlaces } from '../utils/core-write-places.js';
import { coreHostMode, runHostPreparation, startHostWatch } from '../utils/preparation.js';

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
 * Failure is fatal: a dev server started on registries the build could not
 * write serves whatever an earlier build left, and hides the cause behind
 * whatever breaks first. Returns whether Next may start.
 *
 * Each line of the build's output repeated here is printed with a call of its
 * own, which shows it the way `shownLine` shows a line.
 */
export async function buildRegistries(coreDir: string, projectRoot: string): Promise<boolean> {
  console.log(chalk.blue('[Registry] Building registries...'));
  const result = await runRegistryBuild(coreDir, projectRoot);

  if (result.status === 'skipped') {
    console.warn(chalk.yellow(`[Registry] Skipped: ${result.reason}.`));
    return true;
  }

  for (const line of result.templatesLines) {
    console.log(chalk.gray(`[Registry] ${line}`));
  }

  if (result.status === 'failed') {
    console.error(chalk.red('[Registry] Registry build failed; the dev server was not started.'));
    for (const line of result.failureLines) {
      console.error(chalk.gray(line));
    }
    return false;
  }
  return true;
}

/**
 * Generate the host (src/app and the registries) before Next starts, for a core that
 * generates it (#203). Fatal on failure, like `buildRegistries`. Returns whether Next may start.
 */
export async function prepareHost(coreDir: string, projectRoot: string): Promise<boolean> {
  console.log(chalk.blue('[Prepare] Generating src/app and registries...'));
  const result = await runHostPreparation(coreDir, projectRoot, { dev: true });
  if (result.code !== 0) {
    console.error(chalk.red('[Prepare] nextspark prepare failed; the dev server was not started.'));
    for (const line of result.failureLines) console.error(chalk.gray(line));
    return false;
  }
  for (const line of result.successLines) console.log(chalk.gray(`[Prepare] ${line}`));
  return true;
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

    // A core with a route manifest generates the whole src/app (#203): the first generation
    // must succeed before Next starts, then a watcher regenerates it as sources change. When a
    // regeneration fails, the last valid src/app stays and the error shows in the terminal and,
    // through the dev-only status module, in the browser.
    const { mode: hostMode } = await coreHostMode(coreDir, projectRoot);
    const host = hostMode === 'host';
    if (host) {
      if (options.registry) {
        // dev:registry / --registry start the legacy registry watcher; a generated host always has its own
        console.warn(chalk.yellow('[Prepare] --registry has no effect with this core: nextspark dev always watches and regenerates src/app and the registries.'));
      }
      if (!(await prepareHost(coreDir, projectRoot))) {
        process.exit(1);
        return;
      }
      console.log(chalk.blue('[Prepare] Watching sources to regenerate src/app...'));
      // The first generation has just run: the watcher only regenerates on changes
      const watcher = startHostWatch(coreDir, projectRoot, { dev: true, skipInitial: true });
      processes.push(watcher);
      watcher.on('error', (err) => {
        console.error(chalk.red(`[Prepare] Error: ${err.message}`));
      });
    }

    // Every start builds the registries first, and a failed build stops here: with --registry
    // the watcher then builds again on start, before it starts watching
    if (!host) {
      if (!(await buildRegistries(coreDir, projectRoot))) {
        process.exit(1);
        return;
      }

      // What the build rewrites that git tracks stays tracked, whatever its .gitignore says; with
      // --registry, the build's own output says so
      const core = await loadCoreWritePlaces(coreDir);
      const trackedRegistries = core.trackedFilesUnder(projectRoot, '.nextspark/registries');
      if (!options.registry && trackedRegistries.length > 0) {
        const [warning, untrack] = core.trackedRegistriesLines(trackedRegistries.length);
        console.warn(chalk.yellow(`[Registry] ⚠ ${warning}`));
        console.warn(chalk.gray(`[Registry]   ${untrack}`));
      }
    }

    // Start registry watcher if enabled
    if (!host && options.registry) {
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
