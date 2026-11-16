// tar through stdin/stdout instead of `-f <path>`: GNU tar (the one in the Windows Bash) reads `G:\x.tgz` as the file
// x.tgz on a host named G, and the other tars (bsdtar, Windows' own) do not accept --force-local, so no path reaches -f.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

/** `tar <flags>f - <rest>` reading the archive `file`. `flags` like 'xz', 'tz', 'xzO'. */
export function tarRead(file, flags, rest, options = {}) {
  return spawnSync('tar', [`${flags}f`, '-', ...rest], { ...options, input: readFileSync(file) })
}

/** `tar czf <file> <rest>`: the spawnSync result, with the archive written to `file` when tar succeeded. */
export function tarCreate(file, rest, options = {}) {
  const result = spawnSync('tar', ['czf', '-', ...rest], { ...options, maxBuffer: 256 * 1024 * 1024 })
  if (result.status === 0) writeFileSync(file, result.stdout)
  return result
}
