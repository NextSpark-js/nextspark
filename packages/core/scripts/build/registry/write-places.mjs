/**
 * Where the registry build writes in a project, and whether it can write there
 * safely: the check the build runs before it writes anything, so a run that
 * can't finish stops before its first write rather than halfway. The commands
 * of `nextspark` that write before the build runs, or start something alongside
 * it, run this same check from the core installed in the project before their
 * first step: sync:app writes app/, its state and the .gitignore first, and dev
 * and registry:watch start what runs the build.
 *
 * This check names what is in the way ahead of time; what keeps each write,
 * removal and rename inside the project, whether this check saw the place or
 * not, is safe-fs, which every one of them goes through.
 *
 * @module core/scripts/build/registry/write-places
 */

import { accessSync, constants, existsSync, lstatSync, readdirSync } from 'fs'
import { join } from 'path'
import { BACKUPS_GITIGNORE, OWN_GITIGNORE_PROBLEMS, REGISTRIES_GITIGNORE, ownGitignoreState } from './post-build/own-gitignores.mjs'

/**
 * What the registry build writes under or writes, from the project root: app/,
 * src/app/(templates), which it regenerates, app/globals.css, which it points at the
 * project's styles, .nextspark/registries, and .nextspark/backups, where it
 * backs up what it replaces or removes in src/app/(templates).
 */
const PLACES = [
  { path: 'src', kind: 'directory' },
  { path: 'src/app', kind: 'directory' },
  { path: 'src/app/(templates)', kind: 'directory' },
  { path: 'src/app/globals.css', kind: 'file' },
  { path: '.nextspark', kind: 'directory' },
  { path: '.nextspark/backups', kind: 'directory' },
  { path: '.nextspark/registries', kind: 'directory' },
]

// Registries are otherwise flat files. Route-scoped template registries are
// generated beneath this one owned subtree so their paths can mirror app/.
const TEMPLATE_SCOPES_DIRECTORY = '.nextspark/registries/template-scopes'

/**
 * The directories the registry build removes old plugin route directories
 * under, from the project root, when app/api/v1/plugin is there: a symlink
 * among them takes the removal wherever it points.
 */
const PLUGIN_ROUTES = ['src/app/api', 'src/app/api/v1', 'src/app/api/v1/plugin']

/** The Cypress fixtures the registry build writes from the project root. */
const TEST_FIXTURES = ['tests/cypress/fixtures/entities.json', 'tests/cypress/fixtures/blocks.json']

export function testFixturesWritten(projectRoot) {
  if (!existsSync(join(projectRoot, 'tests', 'cypress', 'fixtures'))) return []
  return TEST_FIXTURES
}

/** A path's lstat from the project root; null when nothing is there, 'unreadable' when it can't be told. */
function lstatIn(projectRoot, path) {
  try {
    return lstatSync(join(projectRoot, path))
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? null : 'unreadable'
  }
}

/** Whether a directory, from the project root, can be listed and looked into; one that doesn't exist can. */
function readable(projectRoot, dir) {
  try {
    accessSync(join(projectRoot, dir), constants.R_OK | constants.X_OK)
    return true
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR'
  }
}

/**
 * Report what is in the way under `dir`, from the project root, without going
 * through a symlink: each symlink, anything that is neither a file, a directory
 * nor a symlink, a directory that can't be read, and, with `filesOnly`, a
 * directory right under `dir` unless it is one of `directoryExceptions`.
 * An exception is still walked with the same symlink guard; it is not a
 * blanket exemption for arbitrary registry subtrees.
 */
function reportEntriesUnder(projectRoot, dir, filesOnly, report, directoryExceptions = new Set()) {
  let entries
  try {
    entries = readdirSync(join(projectRoot, dir), { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') report(dir, "can't be read")
    return
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.isSymbolicLink()) {
      report(path, 'is a symlink')
    } else if (entry.isDirectory()) {
      if (filesOnly && !directoryExceptions.has(path)) report(path, 'is not a file')
      else reportEntriesUnder(projectRoot, path, false, report, directoryExceptions)
    } else if (entry.isFile() && directoryExceptions.has(path)) {
      report(path, 'is not a directory')
    } else if (!entry.isFile()) {
      report(path, 'is neither a file nor a directory')
    }
  }
}

/**
 * The places the registry build, and a caller about to write `written` - paths
 * from the project root - can't write under safely, each with what is wrong
 * with it, from the project root. None means nothing stands in the way.
 *
 * A symlink: app, src/app/(templates) or anything in it, app/globals.css,
 * .nextspark, its backups, its registries or anything right in them; app/api,
 * app/api/v1 or app/api/v1/plugin when the build looks for old plugin routes to
 * remove there; each of the project's Cypress fixtures the build writes or
 * a directory above one; and each of `written` or a directory above one. What goes through one lands wherever
 * it points, outside the project maybe, and blind: the build's listing of
 * src/app/(templates) skips a symlink, so what is behind one is written over. Nor
 * can git vouch for it: a symlink is no directory for a line like
 * `src/app/(templates)/`, and git won't say whether a path beyond one is ignored.
 *
 * Something other than what goes there, which stops a run halfway, once it has
 * written part of what it writes: a file where one of those directories goes,
 * or a directory above a path of `written`; a directory where app/globals.css,
 * a registry - the build writes only files right in .nextspark/registries - or
 * a path of `written` goes; and, in src/app/(templates), anything that is neither a
 * file, a directory nor a symlink. A file in src/app/(templates) where the build
 * needs a directory, or a directory where it needs a file, is not in the way:
 * the build backs up what is there and removes it before it writes.
 *
 * What can't be read where the build needs to look: one of those places, a
 * directory in src/app/(templates), or the backups or registries directory. And a .gitignore of
 * .nextspark/backups or .nextspark/registries that would not keep what is
 * beside it out of git: a symlink, not a file, unreadable, or with patterns
 * other than `*`.
 *
 * @param {string} projectRoot - The project root
 * @param {readonly string[]} [written] - Paths the caller writes or removes, from the project root
 * @returns {{ path: string, problem: string }[]}
 */
export function unsafeWritePlaces(projectRoot, written = []) {
  const unsafe = []
  const report = (path, problem) => {
    if (!unsafe.some(place => place.path === path)) unsafe.push({ path, problem })
  }
  const reported = path => unsafe.some(place => place.path === path)

  for (const { path, kind } of PLACES) {
    const stat = lstatIn(projectRoot, path)
    if (stat === null) continue
    if (stat === 'unreadable') report(path, "can't be read")
    else if (stat.isSymbolicLink()) report(path, 'is a symlink')
    else if (kind === 'directory' ? !stat.isDirectory() : !stat.isFile()) report(path, `is not a ${kind}`)
  }

  for (const [directory, gitignore] of [['.nextspark/backups', BACKUPS_GITIGNORE], ['.nextspark/registries', REGISTRIES_GITIGNORE]]) {
    if (reported('.nextspark') || reported(directory)) continue
    if (!readable(projectRoot, directory)) {
      report(directory, "can't be read")
      continue
    }
    const problem = OWN_GITIGNORE_PROBLEMS[ownGitignoreState(projectRoot, gitignore)]
    if (problem) report(gitignore, problem)
  }

  if (existsSync(join(projectRoot, 'src', 'app', 'api', 'v1', 'plugin'))) {
    for (const path of PLUGIN_ROUTES) {
      const stat = lstatIn(projectRoot, path)
      if (stat === 'unreadable') report(path, "can't be read")
      else if (stat?.isSymbolicLink()) {
        report(path, 'is a symlink')
        break
      }
    }
  }

  // The first thing in the way of each path written, from the project root
  for (const path of [...testFixturesWritten(projectRoot), ...written]) {
    const parts = path.split('/')
    for (let depth = 1; depth <= parts.length; depth++) {
      const along = parts.slice(0, depth).join('/')
      const stat = lstatIn(projectRoot, along)
      if (stat === null) break
      const problem = stat === 'unreadable'
        ? "can't be read"
        : stat.isSymbolicLink()
          ? 'is a symlink'
          : depth < parts.length
            ? (stat.isDirectory() ? null : 'is not a directory')
            : (stat.isFile() ? null : 'is not a file')
      if (!problem) continue
      report(along, problem)
      break
    }
  }

  // A tree that is somewhere else already, past a symlink, or that is no directory, is not walked
  if (!reported('src') && !reported('src/app') && !reported('src/app/(templates)')) {
    reportEntriesUnder(projectRoot, 'src/app/(templates)', false, report)
  }
  if (!reported('.nextspark') && !reported('.nextspark/registries')) {
    reportEntriesUnder(
      projectRoot,
      '.nextspark/registries',
      true,
      report,
      new Set([TEMPLATE_SCOPES_DIRECTORY])
    )
  }
  return unsafe
}

/**
 * The lines that say what `unsafeWritePlaces` found and what to do about it,
 * one place per line and the advice after them, for a command to print under a
 * line of its own saying it stopped before writing.
 *
 * @param {{ path: string, problem: string }[]} unsafe - What `unsafeWritePlaces` found
 * @returns {string[]}
 */
export function unsafeWritePlacesLines(unsafe) {
  return [
    ...unsafe.map(({ path, problem }) => `${path} ${problem}`),
    'Through a symlink, what is written, replaced or removed lands wherever it points, and git can\'t tell whether it is ignored; something of another kind, or that can\'t be read, stops a run halfway.',
    'Make each one a directory or file of its own, of the kind that goes there, and run the command again.',
  ]
}
