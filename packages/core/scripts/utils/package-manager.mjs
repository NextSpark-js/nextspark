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
 * With DelayedExpansion enabled in the Windows registry, cmd.exe expands `!VAR!`
 * even inside double quotes. That does not break the command but can change the
 * value of an argument, so callers validate what comes from the user (update-core
 * validates the version).
 *
 * The CLI and create-nextspark-app keep TypeScript copies of this function;
 * their tests check they agree with this one.
 *
 * @param {string} command `pnpm`, `npm` or `npx`
 * @param {string[]} args
 * @param {string} [platform]
 * @returns {{ command: string, args: string[], shell: boolean, windowsHide: boolean }}
 */
export function packageManagerCommand(command, args, platform = process.platform) {
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
 * How update-core starts `command`: pnpm and npm through packageManagerCommand (a `.cmd`
 * shim on Windows, #450), anything else (git, node, tar) directly, with no shell to
 * read its arguments.
 */
export function stepCommand(command, args, platform = process.platform) {
  return command === 'pnpm' || command === 'npm' ? packageManagerCommand(command, args, platform) : { command, args, shell: false, windowsHide: true }
}
