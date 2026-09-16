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

/** Bytes of a build's output worth keeping for diagnosis; core's own failure line sits well under this. */
const OUTPUT_TAIL_LIMIT = 256 * 1024;

/**
 * Accumulates a child process's output, keeping only the last `limit` bytes.
 * A build's own failure line sits at the end of what it prints, so the tail
 * is what's worth keeping; kept in full, a build's memory would grow with
 * the size of its output instead of with the size of its cause.
 */
export function tailBuffer(limit = OUTPUT_TAIL_LIMIT): { append(chunk: string): void; readonly value: string } {
  let text = '';
  let droppedBytes = 0;

  return {
    append(chunk: string): void {
      text += chunk;
      if (text.length > limit * 2) {
        const cut = text.indexOf('\n', text.length - limit);
        const kept = cut === -1 ? text.slice(-limit) : text.slice(cut + 1);
        droppedBytes += text.length - kept.length;
        text = kept;
      }
    },
    get value(): string {
      return droppedBytes > 0 ? `... ${droppedBytes} earlier byte(s)\n${text}` : text;
    },
  };
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
 * What a failed registry build printed, as the lines worth repeating: all of it
 * when it fits under `limit`. Without them the failure is a sentence with no
 * cause in it.
 *
 * Longer output is repeated from where the failure starts, the last unindented
 * line that reads as a cause, to the end. The last, because an error printed
 * and recovered from earlier is not what stopped the build. Unindented, because
 * what sits under a cause - the specifics under a header such as "validation
 * errors:", the files it names, a stack trace - is indented and can use the
 * same words. The block comes along whole when it fits; when it doesn't, its
 * start, which carries the specifics, and its end, with a count of what sits
 * between.
 */
export function buildFailureLines(output: string, limit = 24): string[] {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
  if (lines.length <= limit) return lines;

  let start = lines.length - 1;
  while (start >= 0 && !(/^\S/.test(lines[start]) && CAUSE_LINE.test(lines[start]))) start--;
  if (start === -1) return [`... ${lines.length - limit} earlier line(s)`, ...lines.slice(-limit)];

  const failure = lines.slice(start);
  const earlier = start === 0 ? [] : [`... ${start} earlier line(s)`];
  if (failure.length <= limit) return [...earlier, ...failure];

  const head = failure.slice(0, Math.ceil(limit / 2));
  const end = failure.slice(failure.length - (limit - head.length));
  return [...earlier, ...head, `... ${failure.length - limit} line(s) in between`, ...end];
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
