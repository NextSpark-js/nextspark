/**
 * The one way the generator writes, creates directories, renames and removes:
 * the registry build and the rest of scripts/build, and `nextspark sync:app`,
 * which loads this module from the core installed in the project. No other file
 * of the generator calls fs to change anything; a test fails when one does.
 *
 * Each call is bound to a root, the directory it may change things under: the
 * project, or, for the themes of the monorepo, the monorepo. Before it touches
 * anything the call looks at the path it was given, from the root down, and
 * refuses - throwing an error with the code UNSAFE_WRITE and writing nothing -
 * when the path is outside the root, when something along it inside the root is
 * a symlink, the path itself included, when a part of it can't be looked at,
 * when what exists of it resolves outside the root, or when the file it would
 * write into has other hard links, which writing it would change too. What goes
 * through a symlink lands wherever the symlink points; what a hard link shares
 * is written wherever the other names are.
 *
 * What the check looks at is what is on disk when the call runs. A file is
 * opened without following a symlink put in its place after the check; a
 * directory along the path replaced by one in between is not caught.
 *
 * @module core/scripts/build/safe-fs
 */

import {
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'

/** The code of the error a refused call throws. */
export const UNSAFE_WRITE = 'UNSAFE_WRITE'

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

/** The open flags of the writeFile flags the generator uses, none of them following a symlink. */
const WRITE_FLAGS = {
  w: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NO_FOLLOW,
  wx: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW,
}

/**
 * Whether `error` is a refusal of this module: nothing was written, and the
 * caller must not carry on as if it had been, or read it as a missing file.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isUnsafeWrite(error) {
  return error instanceof Error && error.code === UNSAFE_WRITE
}

/** A path from `base` with forward slashes, as a refusal names it. */
function fromBase(base, absolute) {
  return relative(base, absolute).split(sep).join('/') || '.'
}

/** `path` with a separator at its end, for telling whether another path is under it. */
function withSeparator(path) {
  return path.endsWith(sep) ? path : `${path}${sep}`
}

function realpathOrNull(path) {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

/**
 * Where `absolute` is looked at from: the root as given when it is under it, or
 * else the shortest of its own leading directories that is the root under
 * another spelling - through a symlink above the root, like /tmp on macOS -
 * whatever comes after that one being looked at part by part; null when none is.
 */
function spelledRoot(absolute, rootPath, rootReal) {
  if (absolute.startsWith(withSeparator(rootPath))) return rootPath
  const leading = []
  for (let path = dirname(absolute); ; path = dirname(path)) {
    leading.unshift(path)
    if (dirname(path) === path) break
  }
  for (const path of leading) {
    try {
      if (realpathSync(path) === rootReal) return path
    } catch {
      return null
    }
  }
  return null
}

/**
 * What is wrong with changing `target` under `root`, or null when nothing is.
 * A target spelled with another path to the root - through a symlink above it,
 * like /tmp on macOS - is looked at from where that path reaches the root.
 *
 * @param {string} root - The directory the change may be made under
 * @param {string} target - An absolute path, or one from the root
 * @param {{ writesInto?: boolean, root?: boolean }} [options] - `writesInto` when an existing file at `target` is written
 *   into; `root` when the root itself may be the target, as for creating a directory that is there already
 * @returns {{ target: string, path: string, problem: string } | null} The target and the path the problem is at, both
 *   from the root, and the problem
 */
export function unsafeWriteProblem(root, target, { writesInto = false, root: rootAllowed = false } = {}) {
  const rootPath = resolve(root)
  const absolute = resolve(rootPath, target)
  let rootReal
  try {
    rootReal = realpathSync(rootPath)
  } catch {
    return { target: absolute, path: rootPath, problem: "can't be resolved" }
  }
  if (absolute === rootPath) {
    return rootAllowed ? null : { target: '.', path: '.', problem: 'is the root itself, which is not changed' }
  }
  const base = spelledRoot(absolute, rootPath, rootReal)
  if (base === null && rootAllowed && realpathOrNull(absolute) === rootReal) return null
  const along = base === null ? null : relative(base, absolute)
  if (along === null || along === '' || isAbsolute(along) || along === '..' || along.startsWith(`..${sep}`)) {
    return { target: absolute, path: absolute, problem: `is outside ${rootPath}` }
  }
  const shownTarget = fromBase(base, absolute)

  let deepest = base
  let current = base
  const parts = along.split(sep)
  for (let depth = 0; depth < parts.length; depth++) {
    current = join(current, parts[depth])
    let stat
    try {
      stat = lstatSync(current)
    } catch (error) {
      // Nothing is there yet, or a file stands where a directory goes and the call itself fails
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') break
      return { target: shownTarget, path: fromBase(base, current), problem: "can't be looked at" }
    }
    if (stat.isSymbolicLink()) {
      return { target: shownTarget, path: fromBase(base, current), problem: 'is a symlink' }
    }
    deepest = current
    if (depth === parts.length - 1) {
      if (writesInto && stat.isFile() && stat.nlink > 1) {
        return { target: shownTarget, path: shownTarget, problem: 'has other hard links' }
      }
    } else if (!stat.isDirectory()) {
      break
    }
  }

  let deepestReal
  try {
    deepestReal = realpathSync(deepest)
  } catch {
    return { target: shownTarget, path: fromBase(base, deepest), problem: "can't be resolved" }
  }
  if (deepestReal !== rootReal && !deepestReal.startsWith(withSeparator(rootReal))) {
    return { target: shownTarget, path: fromBase(base, deepest), problem: `resolves outside ${rootReal}` }
  }
  return null
}

/** The error a refused call throws. */
function refusal(operation, root, { target, path, problem }) {
  const error = new Error(
    `Refused to ${operation} ${target}: ${path} ${problem}, and nothing was written. ` +
    'What is written or removed through a symlink, a hard link or a path out of the project lands outside it: ' +
    'make each part of the path a file or directory of its own inside the project, and run the command again.'
  )
  return Object.assign(error, { code: UNSAFE_WRITE, root: resolve(root), target, path, problem })
}

/** `target` as an absolute path under `root`, once changing it is safe; throws the refusal otherwise. */
function checked(operation, root, target, options) {
  const problem = unsafeWriteProblem(root, target, options)
  if (problem) throw refusal(operation, root, problem)
  return resolve(resolve(root), target)
}

/** The flags a writeFile call opens with: the ones the generator uses, never following a symlink. */
function writeOptions(options) {
  const normalized = typeof options === 'string' ? { encoding: options } : { ...options }
  const flag = normalized.flag ?? 'w'
  if (!(flag in WRITE_FLAGS)) {
    throw new Error(`safe-fs writes with the flags ${Object.keys(WRITE_FLAGS).join(' and ')}, not ${flag}`)
  }
  return { ...normalized, flag: WRITE_FLAGS[flag] }
}

/**
 * The calls that change things under `root`, each refusing - with an error whose
 * code is UNSAFE_WRITE, before touching anything - what `unsafeWriteProblem`
 * finds wrong with its path. Paths are absolute, or from the root.
 *
 * @param {string} root - The directory these calls may change things under
 */
export function projectFiles(root) {
  const writeFile = (path, data, options) => {
    writeFileSync(checked('write', root, path, { writesInto: true }), data, writeOptions(options))
  }
  const mkdir = (path, options) => mkdirSync(checked('create', root, path, { root: true }), options)
  const mkdtemp = prefix => {
    checked('create a directory beside', root, prefix)
    return mkdtempSync(resolve(resolve(root), prefix))
  }
  const copyFile = (source, destination, mode) => {
    copyFileSync(source, checked('copy to', root, destination, { writesInto: true }), mode)
  }
  const rm = (path, options) => rmSync(checked('remove', root, path), options)
  const rmdir = path => rmdirSync(checked('remove', root, path))
  const unlink = path => unlinkSync(checked('remove', root, path))
  const rename = (from, to) => {
    const source = checked('move', root, from)
    renameSync(source, checked('move to', root, to))
  }

  return {
    root: resolve(root),
    writeFileSync: writeFile,
    mkdirSync: mkdir,
    mkdtempSync: mkdtemp,
    copyFileSync: copyFile,
    rmSync: rm,
    rmdirSync: rmdir,
    unlinkSync: unlink,
    renameSync: rename,
    writeFile: async (...args) => writeFile(...args),
    mkdir: async (...args) => mkdir(...args),
    mkdtemp: async (...args) => mkdtemp(...args),
    copyFile: async (...args) => copyFile(...args),
    rm: async (...args) => rm(...args),
    rmdir: async (...args) => rmdir(...args),
    unlink: async (...args) => unlink(...args),
    rename: async (...args) => rename(...args),
  }
}
