/**
 * The .gitignore kept in .nextspark/backups, the directory every backup of a
 * file the registry build replaces or removes in app/(templates) goes under,
 * as do the backups `nextspark sync:app` takes. Each backup goes into a
 * directory named as it is created, and can hold anything, a .gitignore
 * included, so no line of the project's .gitignore can be asked about for one
 * before it exists. A .gitignore in the directory that ignores everything in
 * it covers every one of them: git takes the patterns of the deepest
 * .gitignore over those of any other, the repository's exclude file and
 * core.excludesFile, and doesn't look into a directory it ignores.
 *
 * `nextspark sync:app` writes and reads it through this module, loaded from the
 * core installed in the project.
 *
 * @module core/scripts/build/registry/post-build/backups-gitignore
 */

import { lstatSync, readFileSync } from 'fs'
import { lstat, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export const BACKUPS_GITIGNORE = '.nextspark/backups/.gitignore'

export const BACKUPS_GITIGNORE_CONTENT = '# Backups nextspark keeps on this machine: none of them belongs in git\n*\n'

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
 * What .nextspark/backups/.gitignore is: absent; in place, when `*` is the only
 * pattern git reads in it, whatever its comments; a symlink, which git does not
 * read; not a file; a file that can't be read, which may hold anything; or a
 * file with other patterns, which can take a backup back.
 *
 * @param {string} rootDir - The project root
 * @returns {'missing' | 'in place' | 'symlink' | 'not a file' | 'unreadable' | 'other'}
 */
export function backupsGitignoreState(rootDir) {
  const path = join(rootDir, BACKUPS_GITIGNORE)
  let stat
  try {
    stat = lstatSync(path)
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'missing' : 'unreadable'
  }
  if (stat.isSymbolicLink()) return 'symlink'
  if (!stat.isFile()) return 'not a file'

  let content
  try {
    content = readFileSync(path, 'utf8')
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
 * What is wrong with .nextspark/backups/.gitignore for keeping the backups out
 * of git, by its state, and what to do about it; a state missing here is none.
 */
export const BACKUPS_GITIGNORE_PROBLEMS = {
  symlink: 'is a symlink, which git does not read, so git would pick up the backups: make it a file with * as its only pattern, or remove it for nextspark to write it',
  'not a file': 'is not a file: remove it for nextspark to write it',
  unreadable: "can't be read, so nothing says it keeps the backups out of git: make it readable, with * as its only pattern",
  other: 'has patterns other than *, which can take a backup back into git: leave * as its only pattern, or remove it for nextspark to write it',
}

/**
 * Why a backup can't be taken under .nextspark/backups with git kept out of it,
 * and what to do about it, or null when it can.
 */
async function backupsBlocker(rootDir) {
  for (const directory of ['.nextspark', '.nextspark/backups']) {
    let stat
    try {
      stat = await lstat(join(rootDir, directory))
    } catch {
      break
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return stat.isSymbolicLink()
        ? `${directory} is a symlink: a backup written through it lands wherever it points, where no .gitignore of the project keeps it out of git. Make ${directory} a directory of its own.`
        : `${directory} is not a directory. Make it one.`
    }
  }

  const problem = BACKUPS_GITIGNORE_PROBLEMS[backupsGitignoreState(rootDir)]
  return problem ? `${BACKUPS_GITIGNORE} ${problem}.` : null
}

/**
 * Give .nextspark/backups the .gitignore that keeps every backup there out of
 * git, before the first backup is written. One already there is never written
 * over: what it holds is the project's. When it can't keep the backups out of
 * git - a symlink, not a file, unreadable, other patterns - or .nextspark or its
 * backups directory is a symlink or not a directory, this throws, so nothing is
 * backed up there.
 *
 * @param {string} rootDir - The project root
 * @returns {Promise<boolean>} Whether it was written
 */
export async function ensureBackupsGitignore(rootDir) {
  const blocker = await backupsBlocker(rootDir)
  if (blocker) throw new Error(`Nothing is backed up under .nextspark/backups: ${blocker}`)
  if (backupsGitignoreState(rootDir) === 'in place') return false

  await mkdir(join(rootDir, '.nextspark', 'backups'), { recursive: true })
  try {
    await writeFile(join(rootDir, BACKUPS_GITIGNORE), BACKUPS_GITIGNORE_CONTENT, { flag: 'wx' })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    // Another run wrote one in the meantime, which counts only if it is one that works
    const blockerNow = await backupsBlocker(rootDir)
    if (blockerNow) throw new Error(`Nothing is backed up under .nextspark/backups: ${blockerNow}`)
    return false
  }
  return true
}
