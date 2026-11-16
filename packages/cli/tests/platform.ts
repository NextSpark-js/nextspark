import { mkdirSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'

/**
 * `text` with the platform's path separator written as `/`, so an assertion about a path the product prints
 * natively (`components\Navbar.tsx` on Windows) reads the same on every platform. A no-op off Windows.
 */
export const slashes = (text: string): string => text.split(sep).join('/')

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
