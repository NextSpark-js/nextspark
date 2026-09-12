import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

/**
 * Run `npx next …` without letting a shell rewrite the arguments.
 *
 * The CLI forwards the user's own flags to Next verbatim, and a shell does not
 * pass them through: it splits on spaces, expands globs and `$`, and turns a
 * trailing `&` into a background job — so a value like
 * `--experimental-upload-trace 'https://host/x?run=1&team=alpha'` arrives
 * truncated at the ampersand.
 *
 * Windows is the exception that forces the shell: Node refuses to spawn a
 * `.cmd` without one (CVE-2024-27980), and `npx` is a `.cmd` there. Arguments
 * are quoted for that path instead.
 */
const IS_WINDOWS = process.platform === 'win32';

/** Quote an argument for cmd.exe, which only understands double quotes. */
export function quoteForWindowsShell(argument: string): string {
  if (argument === '') return '""';
  if (!/[\s"&|<>^()%!]/.test(argument)) return argument;

  return `"${argument.replace(/(["\\])/g, '\\$1')}"`;
}

/** The command and arguments to hand `spawn`, per platform. */
export function npxInvocation(args: string[]): { command: string; args: string[]; shell: boolean } {
  if (!IS_WINDOWS) return { command: 'npx', args, shell: false };

  return { command: 'npx.cmd', args: args.map(quoteForWindowsShell), shell: true };
}

export function spawnNext(args: string[], options: Omit<SpawnOptions, 'shell'>): ChildProcess {
  const invocation = npxInvocation(args);

  return spawn(invocation.command, invocation.args, { ...options, shell: invocation.shell });
}
