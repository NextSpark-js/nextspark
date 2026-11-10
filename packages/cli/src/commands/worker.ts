import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import chalk from '../utils/colors.js';
import { getCoreDir, getProjectRoot } from '../utils/paths.js';

/**
 * The command that runs the jobs worker (#275): the core entry under tsx, which loads the project's TypeScript
 * handlers and tsconfig paths, with `server-only` made an empty module.
 */
export function workerCommand(coreDir: string, projectRoot: string): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const tsx = createRequire(import.meta.url).resolve('tsx');
  return {
    command: process.execPath,
    args: [
      '--import', pathToFileURL(tsx).href,
      // after tsx, so it sees `server-only` first
      '--import', pathToFileURL(join(coreDir, 'scripts', 'jobs', 'preload.mjs')).href,
      join(coreDir, 'scripts', 'jobs', 'worker.mjs'),
    ],
    env: {
      ...process.env,
      NEXTSPARK_CORE_DIR: coreDir,
      TSX_TSCONFIG_PATH: join(projectRoot, 'tsconfig.json'),
    },
  };
}

/** Why the worker can't start in this project, or null. pg-boss is optional: only a project that runs the worker installs it. */
export function workerBlocker(projectRoot: string): string | null {
  try {
    createRequire(join(projectRoot, 'package.json')).resolve('pg-boss');
  } catch {
    return 'pg-boss is not installed in this project. The worker needs it: run `pnpm add pg-boss` (with `-w` at the root of a pnpm workspace, as a generated project is).';
  }
  if (!existsSync(join(projectRoot, '.nextspark', 'registries'))) {
    return 'The registries are not generated yet. Run `nextspark prepare` first.';
  }
  return null;
}

/** Run the optional pg-boss worker as its own process (a second process next to the app). */
export async function workerStartCommand(): Promise<void> {
  const coreDir = getCoreDir();
  const projectRoot = getProjectRoot();

  const blocker = workerBlocker(projectRoot);
  if (blocker) {
    console.error(chalk.red(`[Worker] Not started: ${blocker}`));
    process.exit(1);
  }

  const { command, args, env } = workerCommand(coreDir, projectRoot);
  const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', env });

  // The worker owns its shutdown: pass the signal on and wait for it to exit, never exit before it
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('error', (error) => {
    console.error(chalk.red(`[Worker] Could not start: ${error.message}`));
    process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
