/**
 * The .gitignore files nextspark keeps in the two directories none of whose
 * content has a place in git: .nextspark/backups, where each backup of a file
 * the registry build or `nextspark sync:app` replaces or removes goes into a
 * directory named as it is created, and .nextspark/registries, which the
 * registry build writes again on every run. A .gitignore in a directory that
 * ignores everything in it covers all of it, named however and holding any
 * .gitignore of its own: git takes the patterns of the deepest .gitignore over
 * those of any other, the repository's exclude file and core.excludesFile, and
 * doesn't look into a directory it ignores. So what goes there stays out of
 * git whatever command writes it and whatever the project's rules say.
 *
 * `nextspark sync:app` reads them, and writes the one for backups, through this
 * module, loaded from the core installed in the project.
 *
 * @module core/scripts/build/registry/post-build/own-gitignores
 */

import { lstatSync, readFileSync } from 'fs'
import { lstat, mkdir, writeFile } from 'fs/promises'
import { join, posix } from 'path'

export const BACKUPS_GITIGNORE = '.nextspark/backups/.gitignore'

export const REGISTRIES_GITIGNORE = '.nextspark/registries/.gitignore'

export const BACKUPS_GITIGNORE_CONTENT = '# Backups nextspark keeps on this machine: none of them belongs in git\n*\n'

export const REGISTRIES_GITIGNORE_CONTENT = '# Registries the nextspark registry build writes again on every run: none of them belongs in git\n*\n'

const CONTENTS = {
  [BACKUPS_GITIGNORE]: BACKUPS_GITIGNORE_CONTENT,
  [REGISTRIES_GITIGNORE]: REGISTRIES_GITIGNORE_CONTENT,
}

/**
 * A .gitignore line's pattern as git takes it: without a closing carriage
 * return, or the spaces that end it unless a backslash escapes the last one.
 */
function patternAsGitReadsIt(line) {
  const withoutReturn = line.replace(/\r$/, '')
  let end = withoutReturn.length
  let lastSpace = -1
  for (let index = 0; index < withoutReturn.length; index++) {
    const character = withoutReturn[index]
    if (character === ' ') {
      if (lastSpace === -1) lastSpace = index
    } else {
      if (character === '\\') index++
      lastSpace = -1
    }
  }
  if (lastSpace !== -1) end = lastSpace
  return withoutReturn.slice(0, end)
}

/**
 * What one of those .gitignore files is: absent; in place, when `*` is the only
 * pattern git reads in it, whatever its comments; a symlink, which git does not
 * read; not a file; a file that can't be read, which may hold anything; or a
 * file with other patterns, which can take back what is beside it.
 *
 * @param {string} rootDir - The project root
 * @param {string} path - BACKUPS_GITIGNORE or REGISTRIES_GITIGNORE
 * @returns {'missing' | 'in place' | 'symlink' | 'not a file' | 'unreadable' | 'other'}
 */
export function ownGitignoreState(rootDir, path) {
  const absolute = join(rootDir, path)
  let stat
  try {
    stat = lstatSync(absolute)
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'missing' : 'unreadable'
  }
  if (stat.isSymbolicLink()) return 'symlink'
  if (!stat.isFile()) return 'not a file'

  let content
  try {
    content = readFileSync(absolute, 'utf8')
  } catch {
    return 'unreadable'
  }
  const patterns = content
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map(patternAsGitReadsIt)
    .filter(line => line !== '' && !line.startsWith('#'))
  return patterns.length === 1 && patterns[0] === '*' ? 'in place' : 'other'
}

/**
 * What .nextspark/backups/.gitignore is, as `ownGitignoreState` reads it.
 *
 * @param {string} rootDir - The project root
 */
export function backupsGitignoreState(rootDir) {
  return ownGitignoreState(rootDir, BACKUPS_GITIGNORE)
}

/**
 * What is wrong with one of those .gitignore files for keeping its directory
 * out of git, by its state, and what to do about it; a state missing here is none.
 */
export const OWN_GITIGNORE_PROBLEMS = {
  symlink: 'is a symlink, which git does not read, so git would pick up what is beside it: make it a file with * as its only pattern, or remove it for nextspark to write it',
  'not a file': 'is not a file: remove it for nextspark to write it',
  unreadable: "can't be read, so nothing says it keeps what is beside it out of git: make it readable, with * as its only pattern",
  other: 'has patterns other than *, which can take what is beside it back into git: leave * as its only pattern, or remove it for nextspark to write it',
}

/**
 * Why nothing can be written beside one of those .gitignore files with git kept
 * out of it, and what to do about it, or null when it can.
 */
async function ownGitignoreBlocker(rootDir, path) {
  for (const directory of ['.nextspark', posix.dirname(path)]) {
    let stat
    try {
      stat = await lstat(join(rootDir, directory))
    } catch {
      break
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return stat.isSymbolicLink()
        ? `${directory} is a symlink: what is written through it lands wherever it points, where no .gitignore of the project keeps it out of git. Make ${directory} a directory of its own.`
        : `${directory} is not a directory. Make it one.`
    }
  }

  const problem = OWN_GITIGNORE_PROBLEMS[ownGitignoreState(rootDir, path)]
  return problem ? `${path} ${problem}.` : null
}

/**
 * Give a directory the .gitignore of its own, before anything is written in it.
 * One already there is never written over: what it holds is the project's. When
 * it can't keep the directory out of git - a symlink, not a file, unreadable,
 * other patterns - or .nextspark or the directory is a symlink or not a
 * directory, this throws, starting with `refusal`, so nothing is written there.
 */
async function ensureOwnGitignore(rootDir, path, refusal) {
  const blocker = await ownGitignoreBlocker(rootDir, path)
  if (blocker) throw new Error(`${refusal}: ${blocker}`)
  if (ownGitignoreState(rootDir, path) === 'in place') return false

  await mkdir(join(rootDir, posix.dirname(path)), { recursive: true })
  try {
    await writeFile(join(rootDir, path), CONTENTS[path], { flag: 'wx' })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    // Another run wrote one in the meantime, which counts only if it is one that works
    const blockerNow = await ownGitignoreBlocker(rootDir, path)
    if (blockerNow) throw new Error(`${refusal}: ${blockerNow}`)
    return false
  }
  return true
}

/**
 * Give .nextspark/backups its .gitignore before the first backup is written.
 *
 * @param {string} rootDir - The project root
 * @returns {Promise<boolean>} Whether it was written
 */
export function ensureBackupsGitignore(rootDir) {
  return ensureOwnGitignore(rootDir, BACKUPS_GITIGNORE, 'Nothing is backed up under .nextspark/backups')
}

/**
 * Give .nextspark/registries its .gitignore before the first registry is written.
 *
 * @param {string} rootDir - The project root
 * @returns {Promise<boolean>} Whether it was written
 */
export function ensureRegistriesGitignore(rootDir) {
  return ensureOwnGitignore(rootDir, REGISTRIES_GITIGNORE, 'No registry is written under .nextspark/registries')
}
