import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'

/**
 * `text` with the platform's path separator written as `/`, so an assertion about a path the product prints
 * natively (`components\Navbar.tsx` on Windows) reads the same on every platform. A no-op off Windows.
 */
export const slashes = (text: string): string => text.split(sep).join('/')

/**
 * The options of a test that only runs off Windows, with the reason it can't run there: `test(name, posixOnly('…'), fn)`.
 * Every such test says why here, in one place, instead of an `if` of its own.
 */
export const posixOnly = (reason: string): { skip: string | false } => ({
  skip: process.platform === 'win32' ? `POSIX only: ${reason}` : false,
})

/**
 * The Windows twin of a test's `node_modules/.bin/next` stand-in. Windows has only .cmd shims in .bin, so the CLI runs
 * Next's JS entry with Node there (src/utils/spawn-next.ts): this writes `script`, JavaScript doing what the sh stand-in
 * does, as that entry. Off Windows the .bin link runs and nothing is written, so those runs stay exactly as they were.
 */
export function windowsNextEntry(projectRoot: string, script: string): void {
  if (process.platform !== 'win32') return
  const next = join(projectRoot, 'node_modules', 'next')
  mkdirSync(join(next, 'dist', 'bin'), { recursive: true })
  writeFileSync(join(next, 'package.json'), JSON.stringify({ name: 'next', version: '16.4.2' }))
  writeFileSync(join(next, 'dist', 'bin', 'next'), script)
}

/**
 * How to start Corepack with child_process and no shell. On Windows `corepack` is a .cmd, which Node starts only through
 * a shell, so there it is Corepack's JS entry, which ships next to node, run with this node. Elsewhere `corepack` itself.
 */
export function corepackCommand(): { command: string; args: string[] } {
  if (process.platform !== 'win32') return { command: 'corepack', args: [] }
  return { command: process.execPath, args: [join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js')] }
}

/** The reasons the suite skips tests on Windows, shared so each one reads the same wherever it applies. */
export const POSIX_REASONS = {
  shFake: 'the test puts an sh script on a colon-separated PATH in place of pnpm, git or next',
  signals: 'the test sends SIGTERM or SIGINT and checks how the process handles it; Windows ends a process without delivering a signal',
  globName: 'the test creates a file named *, which Windows does not allow',
  tty: 'the test drives a prompt through a pseudo-terminal (script), which Windows does not have',
  committedSymlinks: 'the fixture commits symlinks, which git on Windows checks out as text files unless core.symlinks is on',
} as const
