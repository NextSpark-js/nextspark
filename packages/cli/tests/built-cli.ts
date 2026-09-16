import { execFileSync } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Build the CLI into a directory of this test process's own and return its
 * entry, removed when the process exits. Test files run at the same time, and
 * a shared dist/ is cleaned and rewritten by each build. The directory sits
 * under node_modules/.cache, where the CLI's dependencies resolve as they do
 * from dist/, with a copy of package.json beside it, where the CLI reads its
 * version.
 */
export function buildCli(): string {
  const root = join(PKG_ROOT, 'node_modules', '.cache', `nextspark-cli-test-${process.pid}`)
  execFileSync('pnpm', ['exec', 'tsup', 'src/cli.ts', '--format', 'esm', '--outDir', join(root, 'dist')], { cwd: PKG_ROOT, stdio: 'ignore' })
  copyFileSync(join(PKG_ROOT, 'package.json'), join(root, 'package.json'))
  process.once('exit', () => rmSync(root, { recursive: true, force: true }))
  return join(root, 'dist', 'cli.js')
}
