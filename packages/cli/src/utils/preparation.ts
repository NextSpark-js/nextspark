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

/** Core's production auth readiness check, relative to the core directory. */
export const AUTH_READINESS_SCRIPT = 'scripts/build/auth-readiness.mjs';

/**
 * Run the one-shot core registry compiler without changing its inputs or
 * output locations. Production preparation then runs the auth readiness check,
 * so a build whose environment proves no login method can work stops here.
 */
export async function runPreparation(
  coreDir: string,
  projectRoot: string,
  options: PreparationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<PreparationResult> {
  const registry = await runCoreScript(coreDir, ['scripts/build/registry.mjs'], preparationEnvironment(projectRoot, options, env));
  if (registry.code !== 0 || !options.production) return registry;
  const auth = await runAuthReadiness(coreDir, projectRoot, env);
  return { ...auth, successLines: [...registry.successLines, ...auth.successLines] };
}

/**
 * Check, with the production preparation environment, that at least one login
 * method of the active theme can authenticate. The theme's app.config.ts is
 * TypeScript, which core loads with Node's type stripping. A core that doesn't
 * ship the check fails closed: the only bypass is NEXTSPARK_AUTH_PREFLIGHT=off,
 * which core itself honors.
 */
export function runAuthReadiness(
  coreDir: string,
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PreparationResult> {
  if (!existsSync(join(coreDir, AUTH_READINESS_SCRIPT))) {
    return Promise.resolve({
      code: 1,
      successLines: [],
      failureLines: [
        `The installed @nextsparkjs/core does not provide the production auth readiness check (${AUTH_READINESS_SCRIPT}).`,
        'Install a @nextsparkjs/core version matching this CLI.',
      ],
    });
  }
  return runCoreScript(
    coreDir,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', AUTH_READINESS_SCRIPT],
    preparationEnvironment(projectRoot, { production: true }, env),
  );
}

function runCoreScript(coreDir: string, args: string[], env: NodeJS.ProcessEnv): Promise<PreparationResult> {
  return new Promise((resolve) => {
    const child = spawn('node', args, {
      cwd: coreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
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
