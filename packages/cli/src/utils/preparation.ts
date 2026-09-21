import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { captureChildOutput } from './registry-build.js';
import { loadCoreWritePlaces } from './core-write-places.js';

export interface PreparationOptions {
  production?: boolean;
  watch?: boolean;
}

export interface PreparationResult {
  code: number;
  successLines: string[];
  failureLines: string[];
}

/**
 * Check the same destinations that core checks before its first write. Watch
 * commands need this before announcing a long-running child: unlike a one-shot
 * build, that child can otherwise make its first write after it was announced.
 */
export async function preparationWatchWriteGuard(coreDir: string, projectRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const core = await loadCoreWritePlaces(coreDir);
  const unsafe = core.unsafeWritePlaces(projectRoot, [], { activeTheme: env.NEXT_PUBLIC_ACTIVE_THEME });
  return core.unsafeWritePlacesLines(unsafe);
}

/**
 * Map a watch child's terminal state to the CLI status. A requested Ctrl-C or
 * termination is successful only when it resulted in the expected signal (or
 * a clean child exit); a late real crash must remain a failure.
 */
export function preparationWatchExitCode(stopping: boolean, code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  if (stopping && (signal === 'SIGINT' || signal === 'SIGTERM')) return 0;
  return signal ? 1 : 0;
}

/**
 * Resolve project settings exactly as the existing registry commands do: values
 * explicitly supplied to the CLI process override `.env`, while production
 * preparation always gives the child NODE_ENV=production.
 */
export function preparationEnvironment(projectRoot: string, options: PreparationOptions, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const envPath = join(projectRoot, '.env');
  const projectEnv = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  return {
    ...projectEnv,
    ...env,
    NEXTSPARK_PROJECT_ROOT: projectRoot,
    ...(options.production ? { NODE_ENV: 'production' } : {}),
  };
}

/** Run the one-shot core registry compiler without changing its inputs or output locations. */
export function runPreparation(
  coreDir: string,
  projectRoot: string,
  options: PreparationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<PreparationResult> {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/build/registry.mjs'], {
      cwd: coreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: preparationEnvironment(projectRoot, options, env),
    });
    const output = captureChildOutput(child);
    child.on('error', (error) => resolve({ code: 1, successLines: [], failureLines: [...output.failureLines, error.message] }));
    child.on('close', (code, signal) => resolve({
      code: code ?? (signal ? 1 : 0),
      successLines: output.successLines,
      failureLines: output.failureLines,
    }));
  });
}

/** Start the core's existing incremental registry watcher. The caller owns its terminal lifecycle. */
export function startPreparationWatch(
  coreDir: string,
  projectRoot: string,
  options: PreparationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ChildProcess {
  return spawn('node', ['scripts/build/registry.mjs', '--watch'], {
    cwd: coreDir,
    stdio: 'inherit',
    env: preparationEnvironment(projectRoot, { ...options, watch: true }, env),
  });
}
