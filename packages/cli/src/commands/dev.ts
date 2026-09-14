import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getCoreDir, getProjectRoot, isMonorepoMode } from '../utils/paths.js';
import { resolveBundlerArgs, type Bundler } from '../utils/next-bundler.js';
import { spawnNext } from '../utils/spawn-next.js';

interface DevOptions {
  port: string;
  registry: boolean;
  turbopack: boolean;
  /** Extra flags forwarded verbatim to `next dev` */
  nextArgs?: string[];
}

/**
 * Registries core declares a module for but the project does not have.
 *
 * Core's ambient declarations are the list of registries this version expects,
 * so a release that adds one is detectable without naming any of them here.
 * Reading it fails open: with no list, nothing looks missing.
 */
function missingRegistries(coreDir: string, projectRoot: string): string[] {
  const declarations = join(coreDir, 'dist', 'nextspark-registries.d.ts');
  if (!existsSync(declarations)) return [];

  const declared = readFileSync(declarations, 'utf-8')
    .matchAll(/declare module '@nextsparkjs\/registries\/([^']+)'/g);

  return [...declared]
    .map(match => match[1])
    .filter(name => !existsSync(join(projectRoot, '.nextspark', 'registries', `${name}.ts`)));
}

/**
 * Build the registries before Next starts, but only when one is missing.
 *
 * Core imports some of them unconditionally, so a missing one is not a degraded
 * feature — it is a module the app cannot resolve, which is what an upgrade
 * leaves behind when a release adds a registry.
 *
 * Only when one is missing: a registry build also prunes `app/(templates)/` of
 * files that no longer match a template, and a dev server starting is no reason
 * to delete anything. `--registry` and `nextspark build` still rebuild in full.
 *
 * Failure is reported and not fatal: what is already on disk may well be enough
 * to boot, and refusing to start the dev server helps nobody.
 */
async function ensureRegistries(coreDir: string, projectRoot: string): Promise<void> {
  const missing = missingRegistries(coreDir, projectRoot);
  if (missing.length === 0) return;

  console.log(chalk.blue(`[Registry] Generating ${missing.length} missing registr${missing.length === 1 ? 'y' : 'ies'} (${missing.join(', ')})...`));

  await new Promise<void>((resolve) => {
    const build = spawn('node', ['scripts/build/registry.mjs'], {
      cwd: coreDir,
      stdio: 'pipe',
      env: { ...process.env, NEXTSPARK_PROJECT_ROOT: projectRoot },
    });

    let stderr = '';
    build.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    build.on('error', (err) => {
      console.warn(chalk.yellow(`[Registry] Could not build registries: ${err.message}`));
      resolve();
    });

    build.on('close', (code) => {
      if (code !== 0) {
        console.warn(chalk.yellow('[Registry] Registry build failed; starting anyway.'));
        if (stderr.trim()) console.warn(chalk.gray(stderr.trim().split('\n').slice(-5).join('\n')));
      }
      resolve();
    });
  });
}

export async function devCommand(options: DevOptions): Promise<void> {
  const spinner = ora('Starting development environment...').start();

  try {
    const coreDir = getCoreDir();
    const projectRoot = getProjectRoot();
    const mode = isMonorepoMode() ? 'monorepo' : 'npm';

    spinner.succeed(`Core found at: ${coreDir} (${mode} mode)`);

    const processes: ChildProcess[] = [];

    await ensureRegistries(coreDir, projectRoot);

    // Start registry watcher if enabled
    if (options.registry) {
      console.log(chalk.blue('\n[Registry] Starting registry builder with watch mode...'));

      // Use the unified registry builder with watch mode
      // It loads .env internally via dotenv, so NEXT_PUBLIC_ACTIVE_THEME is available
      const registryProcess = spawn('node', ['scripts/build/registry.mjs', '--watch'], {
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
