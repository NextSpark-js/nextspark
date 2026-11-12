/**
 * Next's development cache follows the `features` flags (#445)
 *
 * Next keeps the type declarations of every route `next dev` served under `.next/dev`. When
 * `features.billing` or `features.superadmin` is turned off, `nextspark prepare` leaves those routes out of
 * `src/app`, but the declarations stay and the type check of `next build` fails on them. `prepare` remembers the
 * flags it last ran with (`.nextspark/features-state.json`, inside the directory the template already ignores) and,
 * when they change, deletes `.next/dev` and says so.
 *
 * - No record (a first prepare, or `.nextspark` deleted): nothing is deleted, the flags are recorded.
 * - Only `.next/dev` is deleted, and never through a symlink (of `.next` or `.next/dev`).
 * - Not while a dev server holds `.next/dev/lock` (a live pid, or a lock that names none): its cache is in use.
 *   `nextspark dev` prepares before it starts Next, so that is where the clearing happens; a flag edited while it
 *   runs is reported, left unrecorded, and cleared by the next prepare after the server stops.
 *
 * @module core/scripts/build/registry/host/next-dev-cache
 */

import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { projectFiles } from '../../safe-fs.mjs'

export const FEATURES_STATE_FILE = '.nextspark/features-state.json'
/** The flags that decide which core routes `src/app` has (features.mjs). */
const TRACKED = ['billing', 'superadmin']

/** `{ billing: boolean, superadmin: boolean }`: a flag counts as on unless it is `false`. */
export const trackedFlags = (features = {}) => Object.fromEntries(TRACKED.map(flag => [flag, features?.[flag] !== false]))

function readState(projectRoot) {
  try {
    const state = JSON.parse(readFileSync(join(projectRoot, FEATURES_STATE_FILE), 'utf8'))
    return state && typeof state === 'object' && TRACKED.every(flag => typeof state[flag] === 'boolean') ? state : null
  } catch {
    return null
  }
}

const lstatOrNull = path => {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

/** Whether a dev server is using `.next/dev`: its lock names a live process, or names none. */
export function devServerRunning(projectRoot, { alive = pid => { try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' } } } = {}) {
  let raw
  try {
    raw = readFileSync(join(projectRoot, '.next', 'dev', 'lock'), 'utf8')
  } catch {
    return false
  }
  try {
    const pid = JSON.parse(raw)?.pid
    return Number.isInteger(pid) ? alive(pid) : true
  } catch {
    return false // an empty or unreadable lock: a leftover of a server that exited
  }
}

/**
 * Compare the flags with the ones recorded, clear `.next/dev` when they changed and record them.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {object} [input.features] - `nextspark.config.ts` `features`
 * @param {boolean} [input.watching] - a long-lived `nextspark dev` watcher: never clear, never record
 * @param {object} [input.fs] - test seam: `projectFiles(projectRoot)`
 * @returns {{ action: 'unchanged'|'recorded'|'cleared'|'kept', line?: string }}
 */
export function syncDevCache({ projectRoot, features, watching = false, running = devServerRunning, fs = projectFiles(projectRoot) }) {
  const flags = trackedFlags(features)
  const previous = readState(projectRoot)
  const record = () => {
    fs.mkdirSync(join(projectRoot, '.nextspark'), { recursive: true })
    fs.writeFileSync(join(projectRoot, FEATURES_STATE_FILE), `${JSON.stringify(flags)}\n`)
  }
  if (previous && TRACKED.every(flag => previous[flag] === flags[flag])) return { action: 'unchanged' }
  if (!previous) {
    if (!watching) record()
    return { action: 'recorded' }
  }
  const changed = TRACKED.filter(flag => previous[flag] !== flags[flag]).map(flag => `features.${flag}`).join(' and ')
  const dev = join(projectRoot, '.next', 'dev')
  const next = lstatOrNull(join(projectRoot, '.next'))
  const stat = lstatOrNull(dev)
  if (!stat) {
    if (!watching) record()
    return { action: 'recorded' }
  }
  const kept = (reason, advice) => ({ action: 'kept', line: `${changed} changed, and .next/dev ${reason}: ${advice}, or Next's type check fails on the routes that are now left out.` })
  const byHand = 'delete .next/dev by hand before next build'
  if (next?.isSymbolicLink() || stat.isSymbolicLink()) return kept('is (or sits in) a symlink, which prepare does not follow', byHand)
  if (!stat.isDirectory()) return kept('is not a directory', byHand)
  if (watching || running(projectRoot)) return kept('is in use by a running dev server', 'stop it; the next prepare clears .next/dev before next build')
  fs.rmSync(dev, { recursive: true, force: true })
  record()
  return { action: 'cleared', line: `${changed} changed: deleted .next/dev, where Next keeps the types of the routes it served.` }
}
