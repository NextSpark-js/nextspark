/**
 * Generation ownership, publication and checking for the generated host (#203).
 *
 * A generation is the complete set of files `nextspark prepare` owns in a project - every file
 * of `src/app` and the registries under `.nextspark/registries` - recorded in
 * `.nextspark/generation.json` with the hash of each file and of each input it was made from.
 *
 * Publication rules:
 * - everything is generated and validated before the first write; a failure before publication
 *   leaves the previous generation untouched;
 * - a changed file is written to a temporary file beside it and renamed over it; an unchanged
 *   file is not touched (its mtime stays, so Next does not recompile it);
 * - ownership is proven against the disk: a `src/app` file is NextSpark's only when the previous
 *   generation.json lists it and its bytes still have the recorded hash; only such files are
 *   ever replaced or deleted;
 * - nothing is written through a symlink: a symlink anywhere in `src/app` or the registries,
 *   or on the way to them, stops the generation before it writes (safe-fs refuses it too);
 * - `src/app` files that are not provably NextSpark's (a committed app tree, a leftover record
 *   next to a replaced tree, a generated file edited by hand) stop the generation before it
 *   writes, unless they are byte-identical to what is generated now; placeholders are ignored;
 * - the ownership record is written ahead of the files (previous plus new), so an interrupted
 *   publication never leaves a file NextSpark wrote that no record owns;
 * - one writer at a time: `.nextspark/generation.lock`, created exclusively, recovered when its
 *   process is gone or it is older than `staleAfterMs`.
 *
 * All writes go through core's safe-fs `projectFiles`.
 *
 * @module core/scripts/build/registry/host/generation
 */

import { createHash, randomBytes } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { hostname } from 'node:os'
import { basename, dirname, join, posix, sep } from 'node:path'

import { isUnsafeWrite, projectFiles } from '../../safe-fs.mjs'
import { validateGeneratedModule } from './static-imports.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { compareTargets } from './plan.mjs'
import { APP_DIR, DEV_RUNTIME_FILES } from './render.mjs'

export const GENERATION_FILE = '.nextspark/generation.json'
export const LOCK_FILE = '.nextspark/generation.lock'
export const REGISTRIES_DIR = '.nextspark/registries'
export const SCHEMA_VERSION = 1
export const DEFAULT_STALE_LOCK_MS = 10 * 60 * 1000

/**
 * Files that are neither owned nor foreign and are never deleted or refused: what an OS drops
 * into any directory, and the placeholders a repository keeps in an otherwise empty src/app
 * (`.gitkeep`, `README.md`). A src/app holding only these counts as empty.
 */
export const PLACEHOLDER_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep', 'README.md'])

export const GENERATION_DIAGNOSTICS = Object.freeze({
  FOREIGN: 'NS_HOST_FOREIGN_FILES',
  FOREIGN_REGISTRY: 'NS_HOST_FOREIGN_REGISTRY',
  SYMLINK: 'NS_HOST_SYMLINK',
  NOT_A_DIRECTORY: 'NS_HOST_NOT_A_DIRECTORY',
  LOCKED: 'NS_HOST_LOCKED',
  INVALID_RECORD: 'NS_HOST_INVALID_GENERATION_RECORD',
  GRAMMAR: 'NS_HOST_VARIABLE_LOOKUP',
  UNSAFE_PATH: 'NS_HOST_UNSAFE_PATH',
})

export class GenerationError extends Error {
  constructor(diagnostics, headline = 'Cannot publish the generated host') {
    super(`${headline}:\n${diagnostics.map(d => `  - [${d.code}] ${d.message}`).join('\n')}`)
    this.name = 'GenerationError'
    this.diagnostics = diagnostics
  }
}

export const sha256 = content => createHash('sha256').update(content).digest('hex')
const toPosix = path => path.split(sep).join('/')
const sortedObject = entries => Object.fromEntries([...entries].sort(([a], [b]) => compareTargets(a, b)))

function lstatOrNull(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

// ---------------------------------------------------------------------------
// The generation record
// ---------------------------------------------------------------------------

/** The previous generation record, or null when there is none. Throws on a record it cannot trust. */
export function readGeneration(hostRoot) {
  const path = join(hostRoot, GENERATION_FILE)
  const stat = lstatOrNull(path)
  if (!stat) return null
  const invalid = message => new GenerationError([{ code: GENERATION_DIAGNOSTICS.INVALID_RECORD, message: `${GENERATION_FILE} ${message}; delete it together with src/app and run nextspark prepare` }])
  if (!stat.isFile()) throw invalid('is not a regular file')
  let record
  try {
    record = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw invalid(`is not valid JSON (${error.message})`)
  }
  if (record?.schemaVersion !== SCHEMA_VERSION || typeof record.files !== 'object' || record.files === null) {
    throw invalid(`has schema version ${JSON.stringify(record?.schemaVersion)}, expected ${SCHEMA_VERSION}`)
  }
  for (const file of [...Object.keys(record.files), ...Object.keys(record.previousFiles ?? {})]) {
    if (!isOwnablePath(file)) throw invalid(`lists ${JSON.stringify(file)}, which is outside src/app and ${REGISTRIES_DIR}`)
  }
  if (Object.values(record.files).some(hash => typeof hash !== 'string') || Object.values(record.previousFiles ?? {}).some(hashes => !Array.isArray(hashes))) {
    throw invalid('has malformed file hashes')
  }
  return record
}

/** Only these two roots are ever NextSpark's to write or delete. */
export function isOwnablePath(path) {
  if (typeof path !== 'string' || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')) return false
  return path.startsWith(`${APP_DIR}/`) || path.startsWith(`${REGISTRIES_DIR}/`)
}

/** The record of a generation, deterministic (sorted keys, no timestamps). */
export function generationRecord({ mode, versions, inputs, files }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: 'nextspark prepare',
    mode,
    versions: sortedObject(Object.entries(versions ?? {})),
    inputs: { hash: inputs?.hash ?? null, files: sortedObject(Object.entries(inputs?.files ?? {})) },
    files: sortedObject(files.map(file => [file.path, sha256(file.content)])),
  }
}

export const renderRecord = record => `${JSON.stringify(record, null, 2)}\n`

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Hash every input of a generation: the files under `dirs` and the `files` given (relative to
 * `root`), plus named `extra` values (the core route manifest hash, ...). Symlinks are recorded
 * by their target, never followed; dot-entries, node_modules and missing inputs are skipped.
 */
export function hashInputs({ root, dirs = [], files = [], extra = {} }) {
  const hashes = new Map()
  const add = relativePath => {
    const absolute = join(root, relativePath)
    const stat = lstatOrNull(absolute)
    if (!stat) return
    if (stat.isSymbolicLink()) {
      hashes.set(toPosix(relativePath), sha256(`symlink:${readlinkSafe(absolute)}`))
    } else if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue
        add(join(relativePath, entry))
      }
    } else if (stat.isFile()) {
      hashes.set(toPosix(relativePath), sha256(readFileSync(absolute)))
    }
  }
  for (const dir of dirs) add(dir)
  for (const file of files) add(file)
  for (const [name, value] of Object.entries(extra)) hashes.set(`<${name}>`, sha256(String(value)))
  const sorted = sortedObject(hashes.entries())
  return { hash: sha256(JSON.stringify(sorted)), files: sorted }
}

function readlinkSafe(path) {
  try {
    return readlinkSync(path)
  } catch {
    return '?'
  }
}

// ---------------------------------------------------------------------------
// The tree on disk
// ---------------------------------------------------------------------------

/**
 * What is under `dir` (relative to `hostRoot`), without following anything: regular files,
 * symlinks, and entries that are neither.
 */
export function scanTree(hostRoot, dir) {
  const result = { files: [], symlinks: [], others: [], root: 'missing' }
  const absolute = join(hostRoot, dir)
  const stat = lstatOrNull(absolute)
  if (!stat) return result
  if (stat.isSymbolicLink()) return { ...result, root: 'symlink' }
  if (!stat.isDirectory()) return { ...result, root: 'not-a-directory' }
  result.root = 'directory'
  const visit = current => {
    for (const entry of readdirSync(join(hostRoot, current), { withFileTypes: true })) {
      const path = `${current}/${entry.name}`
      if (entry.isSymbolicLink()) result.symlinks.push(path)
      else if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) {
        if (!PLACEHOLDER_FILES.has(entry.name)) result.files.push(path)
      } else result.others.push(path)
    }
  }
  visit(dir)
  result.files.sort(compareTargets)
  return result
}

/** Symlinks (or non-directories) where NextSpark would write: refused before any write. */
function unsafePlaces(hostRoot) {
  const problems = []
  for (const dir of ['.nextspark', 'src']) {
    const stat = lstatOrNull(join(hostRoot, dir))
    if (stat?.isSymbolicLink()) problems.push({ code: GENERATION_DIAGNOSTICS.SYMLINK, message: `${dir} is a symlink; NextSpark never writes through symlinks. Replace it with a directory.` })
    else if (stat && !stat.isDirectory()) problems.push({ code: GENERATION_DIAGNOSTICS.NOT_A_DIRECTORY, message: `${dir} is not a directory` })
  }
  for (const dir of [APP_DIR, REGISTRIES_DIR]) {
    const tree = scanTree(hostRoot, dir)
    if (tree.root === 'symlink') problems.push({ code: GENERATION_DIAGNOSTICS.SYMLINK, message: `${dir} is a symlink; NextSpark never writes through symlinks. Replace it with a directory.` })
    if (tree.root === 'not-a-directory') problems.push({ code: GENERATION_DIAGNOSTICS.NOT_A_DIRECTORY, message: `${dir} is not a directory` })
    for (const link of tree.symlinks) problems.push({ code: GENERATION_DIAGNOSTICS.SYMLINK, message: `${link} is a symlink; NextSpark never writes, replaces or deletes through symlinks. Remove it.` })
    for (const other of tree.others) problems.push({ code: GENERATION_DIAGNOSTICS.NOT_A_DIRECTORY, message: `${other} is not a regular file or directory. Remove it.` })
  }
  return problems
}

/**
 * The hashes a path of the previous record may have on disk to count as NextSpark's: the recorded
 * one, and - for a publication that did not finish (`pending`) - the hash it had before it (a file
 * the interrupted run had not rewritten yet).
 */
function recordedHashes(previous, path) {
  const hashes = new Set()
  if (previous?.files?.[path]) hashes.add(previous.files[path])
  if (previous?.pending) for (const hash of previous.previousFiles?.[path] ?? []) hashes.add(hash)
  return hashes
}

/**
 * Ownership is proven against the disk: a file is NextSpark's only when the previous record lists
 * it AND its current bytes still have the recorded hash. A listed file edited since (or a leftover
 * record next to a tree that replaced the generated one) is not.
 */
export function ownedOnDisk(hostRoot, previous, path) {
  const hashes = recordedHashes(previous, path)
  if (hashes.size === 0) return false
  const stat = lstatOrNull(join(hostRoot, path))
  return Boolean(stat?.isFile()) && hashes.has(sha256(readFileSync(join(hostRoot, path))))
}

/**
 * `src/app` files that are not provably NextSpark's (see `ownedOnDisk`) and differ from what is
 * generated now. The generated host cannot share src/app with them, and never overwrites or
 * deletes them.
 */
export function foreignFiles({ hostRoot, previous, files }) {
  const planned = new Map(files.map(file => [file.path, file.content]))
  const foreign = []
  for (const path of scanTree(hostRoot, APP_DIR).files) {
    if (ownedOnDisk(hostRoot, previous, path)) continue
    if (planned.has(path) && readFileSync(join(hostRoot, path), 'utf8') === planned.get(path)) continue
    foreign.push(path)
  }
  return foreign
}

export function foreignFilesDiagnostic(foreign) {
  const shown = foreign.slice(0, 20)
  return {
    code: GENERATION_DIAGNOSTICS.FOREIGN,
    files: foreign,
    message:
      `src/app holds ${foreign.length} file${foreign.length === 1 ? '' : 's'} NextSpark did not generate, or edited since it generated ${foreign.length === 1 ? 'it' : 'them'}:\n` +
      shown.map(path => `      ${path}`).join('\n') +
      (foreign.length > shown.length ? `\n      ... and ${foreign.length - shown.length} more` : '') +
      '\n    src/app is generated by nextspark prepare and git-ignored; nothing was written or deleted. Move what you want to keep ' +
      'to templates/ or api/ (route sources) and remove these files from src/app, then run the command again.',
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Every file with a grammar must parse and stay inside it. */
export async function validateFiles(files, { projectRoot, wrappers }) {
  const diagnostics = []
  const ts = await loadTypeScriptFor(projectRoot)
  for (const file of files) {
    if (!isOwnablePath(file.path)) {
      diagnostics.push({ code: GENERATION_DIAGNOSTICS.UNSAFE_PATH, message: `${JSON.stringify(file.path)} is outside src/app and ${REGISTRIES_DIR}` })
      continue
    }
    if (!file.grammar) continue
    if (file.grammar === 'dev-runtime') {
      // Fixed development files: exactly the text render.mjs defines, nothing else.
      if (DEV_RUNTIME_FILES[file.path] !== file.content) diagnostics.push({ code: GENERATION_DIAGNOSTICS.GRAMMAR, file: file.path, message: `${file.path} is not the fixed development file NextSpark generates` })
      continue
    }
    for (const violation of validateGeneratedModule({ ts, source: file.content, file: file.path, grammar: file.grammar, wrappers })) {
      diagnostics.push({ code: GENERATION_DIAGNOSTICS.GRAMMAR, file: file.path, line: violation.line, message: `${file.path}:${violation.line} leaves the allowed ${file.grammar} grammar (${violation.kind}): ${violation.text}` })
    }
  }
  const seen = new Set()
  for (const file of files) {
    if (seen.has(file.path)) diagnostics.push({ code: GENERATION_DIAGNOSTICS.UNSAFE_PATH, message: `${file.path} is generated twice` })
    seen.add(file.path)
  }
  return diagnostics
}

// ---------------------------------------------------------------------------
// Lock
// ---------------------------------------------------------------------------

function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * Why the lock at `path` is stale, or null when it is held.
 *
 * - a holder on this machine is stale exactly when its process is gone, however old the lock is
 *   (a live writer is never taken over; a hung one is the user's to stop);
 * - a holder on another machine (a shared file system) cannot be probed: stale after `staleAfterMs`;
 * - an unreadable lock (a writer between creating and filling it, or one that died there): stale
 *   after 30 seconds.
 */
export function staleLockReason(path, { staleAfterMs = DEFAULT_STALE_LOCK_MS, now = Date.now() } = {}) {
  const stat = lstatOrNull(path)
  if (!stat) return 'gone'
  let holder = null
  try {
    holder = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return now - stat.mtimeMs > 30_000 ? 'unreadable and older than 30s' : null
  }
  if (holder?.host === hostname() && Number.isInteger(holder?.pid)) {
    return processAlive(holder.pid) ? null : `process ${holder.pid} is gone`
  }
  const age = now - (Date.parse(holder?.startedAt) || stat.mtimeMs)
  return age > staleAfterMs ? `held from another machine and older than ${Math.round(staleAfterMs / 1000)}s` : null
}

/** The identity of one lock file instance: a replaced lock is another inode (or mtime). */
function lockInstance(path) {
  const stat = lstatOrNull(path)
  return stat?.isFile() ? `${stat.ino}-${Math.round(stat.mtimeMs * 1000)}` : null
}

function readHolder(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

// Node allows Atomics.wait on the main thread (browsers do not): a real synchronous sleep, no busy loop.
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function lockedError(path) {
  const holder = readHolder(path)
  return new GenerationError([
    {
      code: GENERATION_DIAGNOSTICS.LOCKED,
      message: `another nextspark prepare is writing this project (${LOCK_FILE}: pid ${holder.pid ?? '?'} on ${holder.host ?? '?'}, since ${holder.startedAt ?? '?'}). Wait for it; if no such process exists, delete ${LOCK_FILE}.`,
    },
  ], 'Cannot start the generation')
}

/**
 * Take the generation lock; returns `release()`. Throws `GenerationError` (NS_HOST_LOCKED) when
 * another live writer holds it.
 *
 * Exclusive under contention, stale takeover included. The lock is only ever created with
 * O_EXCL, or replaced - never deleted and re-created - by the one process that wins the takeover
 * of that lock instance: a takeover first creates `generation.lock.takeover-<instance>` with
 * O_EXCL (one winner per stale instance), checks the lock is still that instance, and renames its
 * own filled-in claim over it in one atomic step. There is no moment without a lock file for a
 * second process to create one in, and a loser that looks again sees the new holder.
 */
export function acquireLock(hostRoot, { staleAfterMs = DEFAULT_STALE_LOCK_MS, attempts = 200 } = {}) {
  const files = projectFiles(hostRoot)
  files.mkdirSync(join(hostRoot, '.nextspark'), { recursive: true })
  const path = join(hostRoot, LOCK_FILE)
  const token = randomBytes(8).toString('hex')
  const body = JSON.stringify({ pid: process.pid, host: hostname(), startedAt: new Date().toISOString(), token })
  const release = () => {
    try {
      if (readHolder(path).token === token) files.rmSync(path, { force: true })
    } catch {
      // Already gone or taken over: not ours to remove.
    }
  }
  // EEXIST, or safe-fs refusing a path that another racer created or removed while it was being
  // checked: contention, look again. A path that really is a symlink is still refused.
  const contended = (error, file) => error.code === 'EEXIST' || (isUnsafeWrite(error) && !lstatOrNull(file)?.isSymbolicLink())

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      files.writeFileSync(path, body, { flag: 'wx' })
      return release
    } catch (error) {
      if (!contended(error, path)) throw error
    }
    const instance = lockInstance(path)
    if (!instance) continue // released in between: try to create it again
    if (!staleLockReason(path, { staleAfterMs })) throw lockedError(path)

    const guard = join(hostRoot, `${LOCK_FILE}.takeover-${instance}`)
    try {
      files.writeFileSync(guard, body, { flag: 'wx' })
    } catch (error) {
      if (!contended(error, guard)) throw error
      sleepSync(5) // another process is taking this instance over; look again
      continue
    }
    try {
      if (lockInstance(path) !== instance) continue
      const claim = join(hostRoot, `${LOCK_FILE}.claim-${token}`)
      files.writeFileSync(claim, body, { flag: 'wx' })
      try {
        files.renameSync(claim, path)
      } catch (error) {
        files.rmSync(claim, { force: true })
        throw error
      }
      return release
    } finally {
      files.rmSync(guard, { force: true })
    }
  }
  throw lockedError(path)
}

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

function writeAtomically(files, hostRoot, path, content) {
  const absolute = join(hostRoot, path)
  files.mkdirSync(dirname(absolute), { recursive: true })
  const temporary = join(dirname(absolute), `.${basename(absolute)}.${process.pid}.${randomBytes(4).toString('hex')}.nextspark-tmp`)
  files.writeFileSync(temporary, content, { flag: 'wx' })
  try {
    files.renameSync(temporary, absolute)
  } catch (error) {
    files.rmSync(temporary, { force: true })
    throw error
  }
}

function removeEmptyParents(files, hostRoot, path, stopAt) {
  let dir = posix.dirname(path)
  while (dir.startsWith(`${stopAt}/`)) {
    const absolute = join(hostRoot, dir)
    const stat = lstatOrNull(absolute)
    if (!stat?.isDirectory() || readdirSync(absolute).length > 0) return
    files.rmdirSync(absolute)
    dir = posix.dirname(dir)
  }
}

/**
 * Whether a registry file NextSpark finds in place (not in the previous record) was written by a
 * NextSpark registry build, so a generation may take it over: the legacy registry build stamps
 * every file it writes with `Generated at: <ISO time>` in its header, the conformance fixture's
 * generator with `// Generated by NextSpark`. Anything else is the user's.
 */
export function isLegacyGeneratedRegistry(content) {
  const header = content.split('\n', 30).join('\n')
  return /Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/.test(header) || /^\/\/ Generated by NextSpark\b/m.test(header)
}

/**
 * Registry files about to be written over that the previous record does not own, differ from the
 * new content and carry no registry-build stamp: never overwritten silently.
 */
export function foreignRegistries({ hostRoot, previous, files }) {
  const owned = new Set(Object.keys(previous?.files ?? {}))
  const foreign = []
  for (const file of files) {
    if (!file.path.startsWith(`${REGISTRIES_DIR}/`) || owned.has(file.path)) continue
    const absolute = join(hostRoot, file.path)
    if (!lstatOrNull(absolute)?.isFile()) continue
    const current = readFileSync(absolute, 'utf8')
    if (current !== file.content && !isLegacyGeneratedRegistry(current)) foreign.push(file.path)
  }
  return foreign
}

/**
 * Checks that must pass before anything is written: safe places, no foreign src/app files, no
 * foreign file where a registry goes. Returns diagnostics.
 */
export function preflight({ hostRoot, previous, files }) {
  const problems = unsafePlaces(hostRoot)
  for (const file of files) {
    const stat = lstatOrNull(join(hostRoot, file.path))
    if (stat && !stat.isFile() && !stat.isSymbolicLink()) problems.push({ code: GENERATION_DIAGNOSTICS.NOT_A_DIRECTORY, message: `${file.path} is in the way: a directory or special file where a generated file goes. Remove it.` })
  }
  if (problems.length > 0) return problems
  const foreign = foreignFiles({ hostRoot, previous, files })
  if (foreign.length > 0) problems.push(foreignFilesDiagnostic(foreign))
  const registries = foreignRegistries({ hostRoot, previous, files })
  if (registries.length > 0) {
    problems.push({
      code: GENERATION_DIAGNOSTICS.FOREIGN_REGISTRY,
      files: registries,
      message:
        `${REGISTRIES_DIR} holds ${registries.length} file${registries.length === 1 ? '' : 's'} where NextSpark writes a registry, not written by a NextSpark registry build:\n` +
        registries.map(path => `      ${path}`).join('\n') +
        `\n    Nothing was written. Move ${registries.length === 1 ? 'it' : 'them'} out of ${REGISTRIES_DIR} (NextSpark owns that directory) and run the command again.`,
    })
  }
  return problems
}

/**
 * Publish a validated generation. `record` is `generationRecord(...)` of `files`.
 * @returns {{ written: string[], deleted: string[], unchanged: number }}
 */
export function publishGeneration({ hostRoot, previous, files, record }) {
  const problems = preflight({ hostRoot, previous, files })
  if (problems.length > 0) throw new GenerationError(problems)

  const fs = projectFiles(hostRoot)
  const planned = new Map(files.map(file => [file.path, file.content]))
  const stale = Object.keys(previous?.files ?? {}).filter(path => !planned.has(path))

  // Ownership first: previous and new files, so an interruption leaves nothing unowned. A path
  // whose content changes keeps its previous hash too (`previousFiles`): a file the interrupted
  // run had not rewritten yet is still provably NextSpark's.
  // (Every hash still acceptable is carried, so a second interruption during the repair of a
  // first one loses none.)
  const previousFiles = Object.keys(previous?.files ?? {})
    .map(path => [path, [...recordedHashes(previous, path)].filter(hash => hash !== record.files[path]).sort()])
    .filter(([, hashes]) => hashes.length > 0)
  const ahead = {
    ...record,
    pending: true,
    files: sortedObject([...Object.entries(previous?.files ?? {}), ...Object.entries(record.files)]),
    previousFiles: sortedObject(previousFiles),
  }
  writeAtomically(fs, hostRoot, GENERATION_FILE, renderRecord(ahead))

  const written = []
  let unchanged = 0
  for (const [path, content] of [...planned.entries()].sort(([a], [b]) => compareTargets(a, b))) {
    const absolute = join(hostRoot, path)
    const stat = lstatOrNull(absolute)
    if (stat?.isFile() && readFileSync(absolute, 'utf8') === content) {
      unchanged += 1
      continue
    }
    if (stat && !stat.isFile()) throw new GenerationError([{ code: GENERATION_DIAGNOSTICS.NOT_A_DIRECTORY, message: `${path} is in the way: a directory or special file where a generated file goes. Remove it.` }])
    writeAtomically(fs, hostRoot, path, content)
    written.push(path)
  }

  const deleted = []
  for (const path of stale.sort(compareTargets)) {
    const absolute = join(hostRoot, path)
    const stat = lstatOrNull(absolute)
    if (!stat) continue
    if (!stat.isFile() || !ownedOnDisk(hostRoot, previous, path)) continue
    fs.unlinkSync(absolute)
    deleted.push(path)
    removeEmptyParents(fs, hostRoot, path, path.startsWith(`${APP_DIR}/`) ? APP_DIR : REGISTRIES_DIR)
  }

  writeAtomically(fs, hostRoot, GENERATION_FILE, renderRecord(record))
  return { written, deleted, unchanged }
}

/**
 * Write one owned file outside a full publication (the dev diagnostic module). Refuses paths the
 * current generation does not own on disk.
 *
 * Same record-ahead protocol as `publishGeneration`, so a crash at any point leaves the file
 * provably NextSpark's:
 *   1. the record is rewritten pending, accepting both the file's current hash(es) and the new one
 *      (an already pending record keeps its own pending state and `previousFiles`);
 *   2. the file is replaced;
 *   3. the record is finalized with the new hash - still pending, with its previous
 *      `previousFiles`, when it was pending before (that publication is not finished).
 * A SIGKILL between 2 and 3 leaves a pending record that owns either version; `--check` reports
 * it as not fresh, and the next prepare completes it.
 */
export function writeOwnedFile(hostRoot, path, content) {
  const previous = readGeneration(hostRoot)
  if (!previous?.files?.[path] || !ownedOnDisk(hostRoot, previous, path)) {
    throw new GenerationError([{ code: GENERATION_DIAGNOSTICS.UNSAFE_PATH, message: `${path} is not owned by the current generation` }])
  }
  const absolute = join(hostRoot, path)
  if (readFileSync(absolute, 'utf8') === content) return false
  const fs = projectFiles(hostRoot)
  const newHash = sha256(content)
  const files = sortedObject([...Object.entries(previous.files), [path, newHash]])
  const acceptedBefore = [...recordedHashes(previous, path)].filter(hash => hash !== newHash).sort()
  const ahead = {
    ...previous,
    pending: true,
    files,
    previousFiles: sortedObject([...Object.entries(previous.pending ? previous.previousFiles ?? {} : {}), [path, acceptedBefore]]),
  }
  writeAtomically(fs, hostRoot, GENERATION_FILE, renderRecord(ahead))
  writeAtomically(fs, hostRoot, path, content)
  const { pending, previousFiles, ...settled } = previous
  const final = previous.pending ? { ...previous, files } : { ...settled, files }
  writeAtomically(fs, hostRoot, GENERATION_FILE, renderRecord(final))
  return true
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

/**
 * Compare what is on disk with what would be generated, writing nothing.
 *
 * @param {object} input
 * @param {string} input.hostRoot
 * @param {object|null} input.previous - `readGeneration(hostRoot)`
 * @param {{ path: string, content: string }[]} input.appFiles - the src/app files that would be generated
 * @param {object} input.inputs - `hashInputs(...)` now
 * @param {object} input.versions - versions now
 * @returns {{ ok: boolean, problems: { state: string, path?: string, detail: string }[] }}
 */
export function checkGeneration({ hostRoot, previous, appFiles, inputs, versions }) {
  const problems = []
  const tree = scanTree(hostRoot, APP_DIR)
  if (!previous && tree.root === 'missing') {
    return { ok: false, problems: [{ state: 'not-prepared', detail: 'src/app has not been generated: run nextspark prepare' }] }
  }
  if (tree.root === 'symlink' || tree.root === 'not-a-directory') problems.push({ state: 'foreign', path: APP_DIR, detail: `${APP_DIR} is a ${tree.root === 'symlink' ? 'symlink' : 'file'}` })
  for (const link of tree.symlinks) problems.push({ state: 'foreign', path: link, detail: 'symlink' })
  for (const other of tree.others) problems.push({ state: 'foreign', path: other, detail: 'not a regular file' })
  if (!previous) problems.push({ state: 'missing', path: GENERATION_FILE, detail: 'no generation record: run nextspark prepare' })
  else if (previous.pending) problems.push({ state: 'stale', path: GENERATION_FILE, detail: 'the last publication did not finish: run nextspark prepare' })

  const expected = new Map(appFiles.map(file => [file.path, file.content]))
  const onDisk = new Set(tree.files)
  const edited = path => Boolean(previous?.files?.[path]) && !ownedOnDisk(hostRoot, previous, path)
  for (const [path, content] of expected) {
    if (!onDisk.has(path)) problems.push({ state: 'missing', path, detail: 'not generated yet' })
    else if (readFileSync(join(hostRoot, path), 'utf8') !== content) {
      problems.push(
        ownedOnDisk(hostRoot, previous, path)
          ? { state: 'stale', path, detail: 'differs from what prepare generates now' }
          : { state: 'foreign', path, detail: edited(path) ? 'edited since NextSpark generated it; prepare will not overwrite it' : 'not generated by NextSpark' }
      )
    }
  }
  for (const path of tree.files) {
    if (expected.has(path)) continue
    problems.push(
      ownedOnDisk(hostRoot, previous, path)
        ? { state: 'stale', path, detail: 'generated earlier, no longer part of the host' }
        : { state: 'foreign', path, detail: edited(path) ? 'edited since NextSpark generated it; prepare will not delete it' : 'not generated by NextSpark' }
    )
  }

  if (previous) {
    for (const [path, hash] of Object.entries(previous.files)) {
      if (!path.startsWith(`${REGISTRIES_DIR}/`)) continue
      const absolute = join(hostRoot, path)
      const stat = lstatOrNull(absolute)
      if (!stat) problems.push({ state: 'missing', path, detail: 'registry missing' })
      else if (!stat.isFile()) problems.push({ state: 'foreign', path, detail: 'not a regular file' })
      else if (sha256(readFileSync(absolute)) !== hash) problems.push({ state: 'stale', path, detail: 'registry changed since it was generated' })
    }
    const before = previous.inputs?.files ?? {}
    const now = inputs?.files ?? {}
    const changed = [...new Set([...Object.keys(before), ...Object.keys(now)])]
      .filter(path => before[path] !== now[path])
      .sort(compareTargets)
    for (const path of changed) {
      problems.push({ state: 'stale', path, detail: !(path in before) ? 'new input since the last prepare' : !(path in now) ? 'input removed since the last prepare' : 'input changed since the last prepare' })
    }
    for (const [name, version] of Object.entries(versions ?? {})) {
      if ((previous.versions ?? {})[name] !== version) problems.push({ state: 'stale', path: `<${name}>`, detail: `generated with ${name} ${previous.versions?.[name] ?? 'unknown'}, now ${version}` })
    }
  }
  return { ok: problems.length === 0, problems }
}
