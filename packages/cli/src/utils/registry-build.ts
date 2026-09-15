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
