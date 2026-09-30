import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
import { captureChildOutput } from './registry-build.js';
import { loadCoreWritePlaces } from './core-write-places.js';

export interface PreparationOptions {
  production?: boolean;
  watch?: boolean;
  /** `prepare --check`: write nothing, compare src/app and the registries with what would be generated. */
  check?: boolean;
  /** Generate for `nextspark dev` (the development status files); with `check`, compare with that host. */
  dev?: boolean;
  /**
   * With `watch`: skip the watcher's initial generation. Only for `nextspark dev`, which has just
   * run it; `prepare --watch` generates first.
   */
  skipInitial?: boolean;
  /**
   * Generate (or with `check`, compare) only the portable contracts module (DTO types and zod schemas the
   * mobile app imports), in any mode: a project whose src/app is not generated still has contracts.
   */
  contractsOnly?: boolean;
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
  const unsafe = core.unsafeWritePlaces(projectRoot);
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
    ...(options.production ? { NODE_ENV: 'production' } : {}),
  };
}

/** Core's production auth readiness check, relative to the core directory. */
export const AUTH_READINESS_SCRIPT = 'scripts/build/auth-readiness.mjs';

/**
 * Check, with the production preparation environment, that at least one login
 * method of the project can authenticate. The project's app.config.ts is
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
    projectRoot,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', AUTH_READINESS_SCRIPT],
    preparationEnvironment(projectRoot, { production: true }, env),
  );
}

function runCoreScript(coreDir: string, projectRoot: string, args: string[], env: NodeJS.ProcessEnv): Promise<PreparationResult> {
  return new Promise((resolve) => {
    const scriptArgs = args.map((arg) => arg.startsWith('scripts/') ? join(coreDir, arg) : arg);
    const child = spawn('node', scriptArgs, {
      cwd: projectRoot,
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

/** The generated-host preparation script, relative to the core directory (#203). */
export const HOST_PREPARE_SCRIPT = 'scripts/build/registry/host/prepare-cli.mjs';
const HOST_MODE_MODULE = 'scripts/build/registry/host/mode.mjs';

export type HostMode = 'host' | 'legacy-app' | 'no-manifest';

export interface HostModeResult {
  mode: HostMode;
}

/**
 * What state this project's src/app is in, decided by the installed core (`resolveHostMode`, loaded
 * from `coreDir`, so the CLI never guesses): `host` when the core ships its route manifest and
 * src/app is absent or owned by a previous generation; `legacy-app` when src/app is a committed
 * app tree no generation owns (`nextspark migrate` converts it); `no-manifest` for a core that
 * cannot generate the host. A core without the module is `no-manifest`. Only `host` is prepared.
 */
export async function coreHostMode(coreDir: string, projectRoot: string): Promise<HostModeResult> {
  const module = join(coreDir, HOST_MODE_MODULE);
  if (!existsSync(module) || !existsSync(join(coreDir, HOST_PREPARE_SCRIPT))) return { mode: 'no-manifest' };
  const { resolveHostMode } = await import(pathToFileURL(module).href);
  const { mode } = resolveHostMode({ coreRoot: coreDir, projectRoot });
  return { mode };
}

/**
 * What `prepare`, `build` and `dev` print, one line each, when the project is not a generated host;
 * null for a host. Nothing else prepares a project: a committed app tree is converted by `nextspark migrate`.
 */
export function hostBlockerLines(mode: HostMode): string[] | null {
  if (mode === 'host') return null;
  if (mode === 'legacy-app') return [
    'src/app holds a committed app tree that nextspark did not generate, so it cannot be prepared: nextspark now generates src/app.',
    'Run `nextspark migrate` to convert the project (`nextspark migrate --dry-run` shows what it would change first).',
  ];
  return [
    'The installed @nextsparkjs/core does not generate src/app (it ships no route manifest, @nextsparkjs/core/routes/manifest.json).',
    'Install a @nextsparkjs/core version matching this CLI.',
  ];
}

/** The arguments of the host preparation script for these options. */
export function hostPreparationArgs(options: PreparationOptions): string[] {
  return [
    ...(options.contractsOnly ? ['--contracts-only'] : []),
    ...(options.check ? ['--check'] : []),
    ...(options.production ? ['--production'] : []),
    ...(options.dev && !options.production ? ['--dev'] : []),
    ...(options.watch ? ['--watch', ...(options.skipInitial ? ['--no-initial'] : [])] : []),
  ];
}

/** How many lines of the host script's output are kept for the command to print. */
const HOST_OUTPUT_LINES = 400;

/**
 * Run the generated-host preparation (generate and publish src/app and the registries, or with
 * `check` compare them) and return every line it printed: the summary on success, the
 * diagnostics on failure. Production preparation then runs the auth readiness check.
 */
export async function runHostPreparation(
  coreDir: string,
  projectRoot: string,
  options: PreparationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<PreparationResult> {
  const result = await new Promise<PreparationResult>((resolve) => {
    const child = spawn('node', [join(coreDir, HOST_PREPARE_SCRIPT), ...hostPreparationArgs({ ...options, watch: false })], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: preparationEnvironment(projectRoot, options, env),
    });
    const lines: string[] = [];
    let dropped = 0;
    const pending = { stdout: '', stderr: '' };
    // A character of several bytes can arrive split across two chunks: decode it whole
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const take = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = pending[stream] + decoders[stream].write(chunk);
      const parts = text.split('\n');
      pending[stream] = parts.pop() ?? '';
      for (const line of parts) {
        if (lines.length < HOST_OUTPUT_LINES) lines.push(line);
        else dropped += 1;
      }
    };
    child.stdout?.on('data', take('stdout'));
    child.stderr?.on('data', take('stderr'));
    const all = () => {
      for (const stream of ['stdout', 'stderr'] as const) pending[stream] += decoders[stream].end();
      for (const rest of [pending.stdout, pending.stderr]) if (rest) lines.push(rest);
      return dropped > 0 ? [...lines, `... and ${dropped} more line(s)`] : lines;
    };
    child.on('error', (error) => resolve({ code: 1, successLines: [], failureLines: [...all(), error.message] }));
    child.on('close', (code, signal) => {
      const status = code ?? (signal ? 1 : 0);
      resolve(status === 0 ? { code: 0, successLines: all(), failureLines: [] } : { code: status, successLines: [], failureLines: all() });
    });
  });
  if (result.code !== 0 || !options.production || options.check || options.contractsOnly) return result;
  const auth = await runAuthReadiness(coreDir, projectRoot, env);
  return { ...auth, successLines: [...result.successLines, ...auth.successLines] };
}

/** Start the generated-host watcher (`nextspark dev`): it regenerates on source changes. The caller owns its lifecycle. */
export function startHostWatch(
  coreDir: string,
  projectRoot: string,
  options: PreparationOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ChildProcess {
  return spawn('node', [join(coreDir, HOST_PREPARE_SCRIPT), ...hostPreparationArgs({ ...options, watch: true })], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: preparationEnvironment(projectRoot, { ...options, watch: true }, env),
  });
}
