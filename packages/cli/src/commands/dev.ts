import type { ChildProcess } from 'node:child_process';
import chalk from '../utils/colors.js';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { resolveBundlerArgs, type Bundler } from '../utils/next-bundler.js';
import { nextOutputBlocker, spawnNext } from '../utils/spawn-next.js';
import { loadCoreWritePlaces } from '../utils/core-write-places.js';
import { coreHostMode, hostBlockerLines, runHostPreparation, startHostWatch } from '../utils/preparation.js';

interface DevOptions {
  port: string;
  registry: boolean;
  turbopack: boolean;
  /** Extra flags forwarded verbatim to `next dev` */
  nextArgs?: string[];
}

/**
 * Generate the host (src/app and the registries) before Next starts, for a core that
 * generates it (#203). Fatal on failure. Returns whether Next may start.
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

    // A core with a route manifest generates the whole src/app (#203): the first generation
    // must succeed before Next starts, then a watcher regenerates it as sources change. When a
    // regeneration fails, the last valid src/app stays and the error shows in the terminal and,
    // through the dev-only status module, in the browser. A committed app tree is not started
    // (nextspark migrate converts it).
    const { mode: hostMode } = await coreHostMode(coreDir, projectRoot);
    const hostBlocker = hostBlockerLines(hostMode);
    if (hostBlocker) {
      console.error(chalk.red('[Dev] Not started: src/app is not a generated host.'));
      for (const line of hostBlocker) console.error(chalk.red(`[Dev] ${line}`));
      process.exit(1);
      return;
    }

    // The preparation checks where it writes before writing; the check runs here first too, from
    // the same core, since the watcher starts alongside Next, and a preparation that can't write
    // is no dev server to start
    const core = await loadCoreWritePlaces(coreDir);
    const unsafe = core.unsafeWritePlaces(projectRoot);
    if (unsafe.length > 0) {
      console.error(chalk.red("[Prepare] Not started: the preparation can't write safely under these paths"));
      for (const line of core.unsafeWritePlacesLines(unsafe)) console.error(chalk.red(`  ${line}`));
      process.exit(1);
    }

    const processes: ChildProcess[] = [];

    if (options.registry) {
      // dev:registry / --registry started the registry watcher; nextspark dev always watches and regenerates
      console.warn(chalk.yellow('[Prepare] --registry has no effect: nextspark dev always watches and regenerates src/app and the registries.'));
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
