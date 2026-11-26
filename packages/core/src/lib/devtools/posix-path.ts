import path from 'path'

/**
 * `full` relative to `base`, always with `/`. The tree `/api/devtools/tests` returns is matched against the test files of
 * the tags registry, which use `/`; on Windows `path` joins with `\`, so the separator is normalized here.
 * `lib` is the path module (`path.win32` in the tests).
 */
export function posixRelative(base: string, full: string, lib: Pick<typeof path, 'relative' | 'sep'> = path): string {
  return lib.relative(base, full).split(lib.sep).join('/')
}
