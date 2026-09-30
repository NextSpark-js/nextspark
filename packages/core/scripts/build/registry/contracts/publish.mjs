/**
 * Publishing and checking the contracts module (#203 stage 7b).
 *
 * The module lives in a directory of its own (`<root>`), recorded in `<root>/contracts.generation.json`
 * with the hash of every file `nextspark prepare` wrote. Ownership is proven against the disk, as for
 * `src/app` (host/generation.mjs):
 * - a file is replaced or deleted only when the record lists it and its bytes still have the recorded hash;
 * - a file at a target path that the record does not own and whose bytes differ (a hand-written
 *   `src/index.ts`, a generated file edited by hand) stops the run before anything is written;
 * - a changed file is written beside its place and renamed over it, an unchanged one is not touched;
 * - the record is written ahead of the files (previous plus new), so an interrupted run never leaves
 *   a file of ours that no record owns;
 * - nothing is written through a symlink (core's safe-fs).
 *
 * @module core/scripts/build/registry/contracts/publish
 */

import { lstatSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { projectFiles } from '../../safe-fs.mjs'
import { sha256 } from '../host/generation.mjs'

export const CONTRACTS_GENERATION_FILE = 'contracts.generation.json'
export const CONTRACTS_SCHEMA_VERSION = 1

export const CONTRACTS_DIAGNOSTICS = Object.freeze({
  FOREIGN: 'NS_CONTRACTS_FOREIGN_FILES',
  INVALID_RECORD: 'NS_CONTRACTS_INVALID_RECORD',
  NOT_A_FILE: 'NS_CONTRACTS_NOT_A_FILE',
})

export class ContractsPublishError extends Error {
  constructor(diagnostics) {
    super(`Cannot publish the contracts module:\n${diagnostics.map(d => `  - [${d.code}] ${d.message}`).join('\n')}`)
    this.name = 'ContractsPublishError'
    this.diagnostics = diagnostics
  }
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sorted = entries => Object.fromEntries([...entries].sort(([a], [b]) => compare(a, b)))

function statOrNull(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

const isOwnable = path => typeof path === 'string' && !path.includes('\\') && path.startsWith('src/') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')

/** The previous record of `root`, or null. Throws a ContractsPublishError on one it cannot trust. */
export function readContractsRecord(root) {
  const path = join(root, CONTRACTS_GENERATION_FILE)
  const stat = statOrNull(path)
  if (!stat) return null
  const invalid = message => new ContractsPublishError([{ code: CONTRACTS_DIAGNOSTICS.INVALID_RECORD, message: `${CONTRACTS_GENERATION_FILE} ${message}; delete it and the generated src/ files, then run nextspark prepare` }])
  if (!stat.isFile()) throw invalid('is not a regular file')
  let record
  try {
    record = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw invalid(`is not valid JSON (${error.message})`)
  }
  if (record?.schemaVersion !== CONTRACTS_SCHEMA_VERSION || typeof record.files !== 'object' || record.files === null) {
    throw invalid(`has schema version ${JSON.stringify(record?.schemaVersion)}, expected ${CONTRACTS_SCHEMA_VERSION}`)
  }
  for (const [file, hash] of Object.entries(record.files)) {
    if (!isOwnable(file)) throw invalid(`lists ${JSON.stringify(file)}, which is outside src/`)
    if (typeof hash !== 'string') throw invalid('has malformed file hashes')
  }
  return record
}

export const contractsRecord = files => ({
  schemaVersion: CONTRACTS_SCHEMA_VERSION,
  generator: 'nextspark prepare',
  files: sorted(files.map(file => [file.path, sha256(file.content)])),
})

const renderRecord = record => `${JSON.stringify(record, null, 2)}\n`

function diskState(root, path) {
  const stat = statOrNull(join(root, path))
  if (!stat) return { state: 'missing' }
  if (!stat.isFile()) return { state: 'not-a-file' }
  return { state: 'file', content: readFileSync(join(root, path), 'utf8') }
}

/**
 * Compare `files` with the disk: what a publication would write, keep or delete, and what stops it.
 * @returns {{ write: string[], unchanged: string[], remove: string[], kept: string[], foreign: object[] }}
 */
export function planPublication({ root, files, previous }) {
  const owned = previous?.files ?? {}
  const plan = { write: [], unchanged: [], remove: [], kept: [], foreign: [] }
  const targets = new Set(files.map(file => file.path))
  for (const file of files) {
    const disk = diskState(root, file.path)
    if (disk.state === 'missing') plan.write.push(file.path)
    else if (disk.state === 'not-a-file') plan.foreign.push({ path: file.path, reason: 'is not a regular file' })
    else if (disk.content === file.content) plan.unchanged.push(file.path)
    else if (owned[file.path] === sha256(disk.content)) plan.write.push(file.path)
    else plan.foreign.push({ path: file.path, reason: owned[file.path] ? 'was edited by hand since it was generated' : 'exists and nextspark prepare did not write it' })
  }
  for (const [path, hash] of Object.entries(owned)) {
    if (targets.has(path)) continue
    const disk = diskState(root, path)
    if (disk.state === 'missing') continue
    if (disk.state === 'file' && sha256(disk.content) === hash) plan.remove.push(path)
    else plan.kept.push(path)
  }
  return plan
}

export const foreignDiagnostic = foreign => ({
  code: CONTRACTS_DIAGNOSTICS.FOREIGN,
  message: `${foreign.map(item => `${item.path} ${item.reason}`).join('; ')}: move or delete ${foreign.length === 1 ? 'it' : 'them'} (or make ${foreign.length === 1 ? 'it' : 'them'} byte-identical to the generated file), then run nextspark prepare`,
})

/**
 * Write the module. `files` are `{ path, content }` under `src/`; `ensureRoot` creates the root directory when it is
 * missing (a directory under the project, made through the project's own safe-fs).
 *
 * @returns {{ written: string[], deleted: string[], unchanged: number, kept: string[] }}
 */
export function publishContracts({ root, files, ensureRoot }) {
  const previous = readContractsRecord(root)
  const plan = planPublication({ root, files, previous })
  if (plan.foreign.length > 0) throw new ContractsPublishError([foreignDiagnostic(plan.foreign)])

  const next = contractsRecord(files)
  const previousText = previous ? renderRecord(previous) : null
  const finalText = renderRecord(next)
  const result = { written: plan.write, deleted: plan.remove, unchanged: plan.unchanged.length, kept: plan.kept }
  if (plan.write.length === 0 && plan.remove.length === 0 && previousText === finalText) return result

  ensureRoot?.()
  const fs = projectFiles(root)
  const byPath = new Map(files.map(file => [file.path, file]))
  // Ahead of the files: previous plus new, so an interrupted run never leaves a file no record owns
  const aheadText = renderRecord({ ...next, files: sorted(Object.entries({ ...(previous?.files ?? {}), ...next.files })) })
  if (aheadText !== previousText) writeAtomic(fs, root, CONTRACTS_GENERATION_FILE, aheadText)
  for (const path of plan.write) {
    fs.mkdirSync(dirname(join(root, path)), { recursive: true })
    writeAtomic(fs, root, path, byPath.get(path).content)
  }
  for (const path of plan.remove) fs.rmSync(join(root, path), { force: true })
  if (finalText !== aheadText) writeAtomic(fs, root, CONTRACTS_GENERATION_FILE, finalText)
  return result
}

function writeAtomic(fs, root, path, content) {
  const temporary = `${path}.nextspark-tmp`
  fs.writeFileSync(join(root, temporary), content)
  fs.renameSync(join(root, temporary), join(root, path))
}

/**
 * `prepare --check`: does the module on disk match `files`, byte for byte, with a record that owns them?
 * Writes nothing. `problems` are `{ state, path, detail }` like the host's check.
 */
export function checkContracts({ root, files }) {
  const problems = []
  let previous
  try {
    previous = readContractsRecord(root)
  } catch (error) {
    if (!(error instanceof ContractsPublishError)) throw error
    return { ok: false, problems: error.diagnostics.map(d => ({ state: 'stale', path: CONTRACTS_GENERATION_FILE, detail: d.message })) }
  }
  if (!previous) {
    return { ok: false, problems: [{ state: 'missing', path: CONTRACTS_GENERATION_FILE, detail: 'the contracts module has not been generated' }] }
  }
  const owned = previous.files
  const targets = new Set(files.map(file => file.path))
  for (const file of files) {
    const disk = diskState(root, file.path)
    if (disk.state === 'missing') problems.push({ state: 'missing', path: file.path, detail: 'not generated' })
    else if (disk.state === 'not-a-file') problems.push({ state: 'foreign', path: file.path, detail: 'is not a regular file' })
    else if (disk.content !== file.content) problems.push({ state: owned[file.path] ? 'stale' : 'foreign', path: file.path, detail: owned[file.path] ? 'differs from what nextspark prepare generates' : 'exists and nextspark prepare did not write it' })
    else if (!owned[file.path]) problems.push({ state: 'stale', path: CONTRACTS_GENERATION_FILE, detail: `does not record ${file.path}` })
  }
  for (const path of Object.keys(owned)) {
    if (!targets.has(path) && diskState(root, path).state !== 'missing') problems.push({ state: 'stale', path, detail: 'is a generated file no entity produces any more' })
  }
  return { ok: problems.length === 0, problems }
}
