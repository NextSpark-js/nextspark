import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * How to start `pnpm` or `npx` with child_process on every platform (#450).
 *
 * On Windows both are `.cmd` shims: Node will not spawn a `.cmd` without a shell
 * (EINVAL since the CVE-2024-27980 fix), and with a shell Node joins the arguments
 * with spaces and no quoting. So on win32 this builds the whole command line,
 * quoting every argument: inside double quotes cmd.exe treats & | < > ^ as text.
 * An argument with `"`, `%` or a line break cannot be quoted safely for cmd.exe
 * and is refused instead of being handed to the shell. Elsewhere nothing changes.
 * `windowsHide` keeps that shell from opening a console window of its own when
 * the caller has none, such as a test runner or an editor (it has no effect elsewhere).
 *
 * A copy of packages/core/scripts/utils/package-manager.mjs; create-nextspark-app's tests/package-manager.test.ts
 * checks they agree.
 */
export function packageManagerCommand(
  command: 'pnpm' | 'npx',
  args: string[],
  platform: string = process.platform,
): { command: string; args: string[]; shell: boolean; windowsHide: boolean } {
  if (platform !== 'win32') return { command, args, shell: false, windowsHide: true }
  const quoted = args.map(arg => {
    if (/["%\r\n]/.test(arg)) {
      throw new Error(`Cannot pass ${JSON.stringify(arg)} to ${command} on Windows: cmd.exe cannot quote " or % or a line break safely`)
    }
    // A backslash right before the closing quote would escape it for the program's own parser
    return `"${arg.replace(/(\\+)$/, '$1$1')}"`
  })
  return { command: [command, ...quoted].join(' '), args: [], shell: true, windowsHide: true }
}

/**
 * Whether `command` is on the PATH of `env`, as Node or cmd.exe would find it: on Windows only with
 * one of PATHEXT's extensions. Through cmd.exe a missing command exits 1 with a localized message,
 * so a failed run can't say by itself that pnpm never started (#450). A copy of the CLI's isOnPath.
 */
export function isOnPath(command: string, env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): boolean {
  // Windows spells it Path, and a copied environment keeps that spelling
  const value = (name: string) => Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1] ?? ''
  const windows = platform === 'win32'
  const extensions = windows ? (value('PATHEXT') || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  return value('PATH').split(windows ? ';' : ':').filter(Boolean)
    .some(directory => extensions.some(extension => existsSync(join(directory, `${command}${extension}`))))
}
