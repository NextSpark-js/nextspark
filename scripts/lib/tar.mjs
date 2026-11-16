// tar through stdin/stdout and `cwd` instead of path arguments: GNU tar (the one in the Windows Bash) reads `G:\x.tgz`
// as the file x.tgz on a host named G and rejects `-C G:\x`, and the other tars (bsdtar, Windows' own) do not accept
// --force-local. So no absolute path ever reaches tar's argv.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/

function checkArgs(args) {
  const bad = args.find((arg) => ABSOLUTE.test(arg))
  if (bad) throw new Error(`tar gets no absolute path in its arguments (${bad}); pass the directory as options.cwd`)
  return args
}

/** `tar <flags>f - <rest>` reading the archive `file`, extracting into `options.cwd`. `flags` like 'xz', 'tz', 'xzO'. */
export function tarRead(file, flags, rest, options = {}) {
  return spawnSync('tar', [`${flags}f`, '-', ...checkArgs(rest)], { ...options, input: readFileSync(file) })
}

/** `tar czf <file> <rest>`, archiving relative to `options.cwd`: the spawnSync result, with the archive written to `file` when tar succeeded. */
export function tarCreate(file, rest, options = {}) {
  const result = spawnSync('tar', ['czf', '-', ...checkArgs(rest)], { ...options, maxBuffer: 256 * 1024 * 1024 })
  if (result.status === 0) writeFileSync(file, result.stdout)
  return result
}
