import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { breaksALine } from './shown-path.js';

/**
 * Run the project's own `next` without a shell and without `npx`.
 *
 * The CLI forwards the user's own flags to Next verbatim, and a shell does not
 * pass them through: it splits on spaces, expands globs and `$`, and turns a
 * trailing `&` into a background job — so a value like
 * `--experimental-upload-trace 'https://host/x?run=1&team=alpha'` arrives
 * truncated at the ampersand. Spawning Next's own executable needs no shell,
 * so nothing has to be quoted.
 *
 * `npx` is out for another reason: npm reads the project's .npmrc, and
 * npm 11 warns `Unknown project config "shamefully-hoist"` on every run.
 */

/**
 * How to start the project's own Next, or an error that says next is not installed there.
 *
 * Off Windows the project's `node_modules/.bin/next` runs as it is: it is the executable pnpm links for the
 * installed version. Windows only has `.cmd` shims there, which need a shell, so it runs Next's JS entry with this
 * Node instead (the entry is also the fallback when the link is missing).
 */
export function nextCommand(projectRoot: string): { command: string; args: string[] } {
  const link = join(projectRoot, 'node_modules', '.bin', 'next');
  if (process.platform !== 'win32' && existsSync(link)) return { command: link, args: [] };

  try {
    const entry = createRequire(join(projectRoot, 'package.json')).resolve('next/dist/bin/next');
    return { command: process.execPath, args: [entry] };
  } catch {
    throw new Error(`Next.js is not installed in ${projectRoot}. Run \`pnpm install\` and try again.`);
  }
}

/**
 * Why Next can't run for this project without its output starting lines of its
 * own, or null when it can. Next prints the project's path as it is - in the
 * errors it reports, for one - straight to the terminal, so a path holding a
 * character that breaks or reorders a line makes lines no escape applied after
 * the fact can tell apart from Next's.
 */
export function nextOutputBlocker(projectRoot: string): string | null {
  return breaksALine(projectRoot)
    ? `the project's path, ${projectRoot}, holds a character that breaks or reorders a line, and Next prints that path as it is`
    : null;
}

/** Spawn `next <args>` for the project; `args` start at the Next command (`dev`, `build`). */
export function spawnNext(projectRoot: string, args: string[], options: Omit<SpawnOptions, 'shell' | 'cwd'>): ChildProcess {
  const next = nextCommand(projectRoot);

  return spawn(next.command, [...next.args, ...args], { ...options, cwd: projectRoot, shell: false });
}
