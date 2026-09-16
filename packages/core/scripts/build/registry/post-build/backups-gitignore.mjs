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
 * The CLI keeps the same file, with the same content, from sync:app.
 *
 * @module core/scripts/build/registry/post-build/backups-gitignore
 */

import { lstat, mkdir, readFile, writeFile } from 'fs/promises'
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
 * read; or anything else - a file with other patterns, which can take a backup
 * back, or no file at all.
 *
 * @param {string} rootDir - The project root
 * @returns {Promise<'missing' | 'in place' | 'symlink' | 'other'>}
 */
export async function backupsGitignoreState(rootDir) {
  const path = join(rootDir, BACKUPS_GITIGNORE)
  let stat
  try {
    stat = await lstat(path)
  } catch {
    return 'missing'
  }
  if (stat.isSymbolicLink()) return 'symlink'
  if (!stat.isFile()) return 'other'

  const patterns = (await readFile(path, 'utf8'))
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map(patternAsGitReadsIt)
    .filter(line => line !== '' && !line.startsWith('#'))
  return patterns.length === 1 && patterns[0] === '*' ? 'in place' : 'other'
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

  const state = await backupsGitignoreState(rootDir)
  if (state === 'symlink') {
    return `${BACKUPS_GITIGNORE} is a symlink, which git does not read, so git would pick the backups up. Make it a file with * as its only pattern, or remove it for the build to write it.`
  }
  if (state === 'other') {
    return `${BACKUPS_GITIGNORE} has patterns other than *, which can take a backup back into git. Leave * as its only pattern, or remove it for the build to write it.`
  }
  return null
}

/**
 * Give .nextspark/backups the .gitignore that keeps every backup there out of
 * git, before the first backup is written. One already there is never written
 * over: what it holds is the project's. When it can't keep the backups out of
 * git - a symlink, other patterns - or .nextspark or its backups directory is a
 * symlink or not a directory, this throws, so nothing is backed up there.
 *
 * @param {string} rootDir - The project root
 * @returns {Promise<boolean>} Whether it was written
 */
export async function ensureBackupsGitignore(rootDir) {
  const blocker = await backupsBlocker(rootDir)
  if (blocker) throw new Error(`Nothing is backed up under .nextspark/backups: ${blocker}`)
  if ((await backupsGitignoreState(rootDir)) === 'in place') return false

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
