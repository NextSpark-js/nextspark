import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

/**
 * Why core's registry build can't run in this project, or null when it can.
 *
 * The build exits with an error when NEXT_PUBLIC_ACTIVE_THEME is set neither in
 * the environment nor in the project's .env. Commands that run it as a side step
 * (`dev`, and `sync:app`, which core's postinstall runs before a project has a
 * .env) check first, so they can skip it with a reason instead of failing.
 */
export function registryBuildBlocker(projectRoot: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const envPath = join(projectRoot, '.env');
  const fileTheme = existsSync(envPath) ? parse(readFileSync(envPath)).NEXT_PUBLIC_ACTIVE_THEME : undefined;

  if (fileTheme || env.NEXT_PUBLIC_ACTIVE_THEME) return null;
  return existsSync(envPath)
    ? 'NEXT_PUBLIC_ACTIVE_THEME is not set in .env'
    : 'the project has no .env file with NEXT_PUBLIC_ACTIVE_THEME';
}

export interface RegistryBuildResult {
  status: 'built' | 'skipped' | 'failed';
  /** Why it was skipped. */
  reason?: string;
  /** Everything the build printed, stdout and stderr interleaved. */
  output: string;
}

/**
 * Run core's registry build for a project: it regenerates `.nextspark/registries`
 * and `app/(templates)`.
 */
export function runRegistryBuild(
  coreDir: string,
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<RegistryBuildResult> {
  const reason = registryBuildBlocker(projectRoot, env);
  if (reason) return Promise.resolve({ status: 'skipped', reason, output: '' });

  return new Promise((resolve) => {
    let output = '';
    const build = spawn('node', ['scripts/build/registry.mjs'], {
      cwd: coreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...env, NEXTSPARK_PROJECT_ROOT: projectRoot },
    });

    build.stdout?.on('data', (chunk) => { output += chunk.toString(); });
    build.stderr?.on('data', (chunk) => { output += chunk.toString(); });
    build.on('error', (error) => resolve({ status: 'failed', output: `${output}${error.message}\n` }));
    build.on('close', (code) => resolve({ status: code === 0 ? 'built' : 'failed', output }));
  });
}

/** What the registry build would change in `app/(templates)`, as paths from the project root. */
export interface TemplatesChanges {
  create: string[];
  /** Files it would give other content, backing up what they hold first. */
  replace: string[];
  /** Files it would remove, backing them up first. */
  remove: string[];
}

export interface TemplatesPlanResult {
  status: 'planned' | 'skipped' | 'failed';
  /** Why it was skipped, or why it couldn't be planned when that is known. */
  reason?: string;
  changes?: TemplatesChanges;
  /** Everything the plan printed, stdout and stderr interleaved. */
  output: string;
}

/** Marks the line core's templates-plan.mjs prints its result on. */
const TEMPLATES_PLAN_MARKER = 'nextspark-templates-plan:';

/**
 * Ask core what its registry build would change in `app/(templates)`, with
 * nothing written. The build copies app/ layouts into that tree, so the plan is
 * made against `appFiles` - the files under app/ that the sync about to run
 * writes (their content) or removes (null) - rather than app/ as it is now.
 */
export function planTemplatesChanges(
  coreDir: string,
  projectRoot: string,
  appFiles: Record<string, string | null>,
  env: NodeJS.ProcessEnv = process.env
): Promise<TemplatesPlanResult> {
  const reason = registryBuildBlocker(projectRoot, env);
  if (reason) return Promise.resolve({ status: 'skipped', reason, output: '' });
  if (!existsSync(join(coreDir, 'scripts', 'build', 'templates-plan.mjs'))) {
    return Promise.resolve({ status: 'failed', reason: 'this version of @nextsparkjs/core has no plan for it', output: '' });
  }

  return new Promise((resolve) => {
    let stdout = '';
    let output = '';
    const plan = spawn('node', ['scripts/build/templates-plan.mjs'], {
      cwd: coreDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...env, NEXTSPARK_PROJECT_ROOT: projectRoot },
    });

    plan.stdout?.on('data', (chunk) => { stdout += chunk.toString(); output += chunk.toString(); });
    plan.stderr?.on('data', (chunk) => { output += chunk.toString(); });
    // A plan that exits before reading its input is reported by its exit code, not by the broken pipe
    plan.stdin?.on('error', () => {});
    plan.stdin?.end(JSON.stringify(appFiles));

    plan.on('error', (error) => resolve({ status: 'failed', output: `${output}${error.message}\n` }));
    plan.on('close', (code) => {
      const line = stdout.split('\n').find((candidate) => candidate.startsWith(TEMPLATES_PLAN_MARKER));
      try {
        if (code === 0 && line) {
          resolve({ status: 'planned', changes: JSON.parse(line.slice(TEMPLATES_PLAN_MARKER.length)), output });
          return;
        }
      } catch {
        // An unreadable result is a failed plan
      }
      resolve({ status: 'failed', output });
    });
  });
}

/** One line per file in a plan of `app/(templates)`, marked the way sync:app's report marks its own. */
export function describeTemplatesChanges(changes: TemplatesChanges): string[] {
  return [
    ...changes.create.map((path) => `+ ${path}`),
    ...changes.replace.map((path) => `~ ${path} (replaced; what it holds is backed up first)`),
    ...changes.remove.map((path) => `- ${path} (removed; backed up first)`),
  ];
}

/** A line that says why the build stopped, rather than what the failure touched. */
const CAUSE_LINE = /\b(?:error|errors|failed|failing|failure|fatal)\b/i;

/**
 * What a failed registry build printed, as the lines worth repeating: the tail
 * of its output, where the error that stopped it lands. Without them the
 * failure is a sentence with no cause in it.
 *
 * The tail alone is not enough when what stopped the build names the files it
 * touched afterwards: enough of them push the cause out of the tail, leaving a
 * list of consequences and no reason. So the first line above the tail that
 * reads as a cause comes along, with a count of what sits between.
 */
export function buildFailureLines(output: string, limit = 12): string[] {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  const tail = lines.slice(-limit);
  if (tail.length === lines.length) return tail;

  const above = lines.slice(0, lines.length - tail.length);
  const cause = above.find((line) => CAUSE_LINE.test(line));
  const elided = above.length - (cause === undefined ? 0 : 1);
  const gap = `... ${elided} earlier line(s)`;
  return cause === undefined ? [gap, ...tail] : [cause, gap, ...tail];
}

/**
 * The lines of a registry build's output that report what it did to
 * `app/(templates)`: files written, replaced or removed, and where anything it
 * replaced or removed was backed up. The rest of the output is not worth
 * repeating when the build runs as a side step.
 */
export function templatesTreeLines(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('app/(templates)'));
}
