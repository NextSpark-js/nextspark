/**
 * Next's development cache follows the routes `prepare` generates (#445, #453)
 *
 * Next keeps the type declarations of every route `next dev` served under `.next/dev`. When a route leaves
 * `src/app` (a `features` flag turned off, a plugin or an entity removed), the declarations stay and the type check
 * of `next build` fails on them. `prepare` remembers the route files it last generated
 * (`.nextspark/routes-state.json`, inside the directory the template already ignores) and, when one of them is gone,
 * deletes `.next/dev` and says so. Only leaving a route breaks the check: routes that are added are recorded and
 * delete nothing, so adding a plugin does not cost a cold dev cache.
 *
 * - No record (a first prepare, `.nextspark` deleted, or a project that only has the `features-state.json` of
 *   #445, which is ignored): nothing is deleted, the routes are recorded.
 * - Only `.next/dev` is deleted, and never through a symlink (of `.next` or `.next/dev`).
 * - Not while a dev server holds `.next/dev/lock` (a live pid, or a lock that names none): its cache is in use.
 *   `nextspark dev` prepares before it starts Next, so that is where the clearing happens; a route removed while it
 *   runs is reported and cleared by the next prepare after the server stops. The watcher records the routes it sees
 *   added (the union with the record, so a route that left stays recorded as missing): a route tried during a
 *   session and removed afterwards is then found missing by the prepare of `build`.
 *
 * @module core/scripts/build/registry/host/next-dev-cache
 */

import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { projectFiles } from '../../safe-fs.mjs'

export const ROUTES_STATE_FILE = '.nextspark/routes-state.json'
/** The generated files Next's route types refer to. */
const ROUTE_FILE = /^src\/app\/(?:.*\/)?(?:page|route|layout|default)\.[cm]?[jt]sx?$/

/** The sorted paths of the route files among the generated `files` (`[{ path }]`). */
export const routePaths = (files = []) => [...new Set(files.map(file => file.path).filter(path => ROUTE_FILE.test(path)))].sort()

function readState(projectRoot) {
  try {
    const state = JSON.parse(readFileSync(join(projectRoot, ROUTES_STATE_FILE), 'utf8'))
    return Array.isArray(state?.routes) && state.routes.every(path => typeof path === 'string') ? state.routes : null
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
 * Compare the route files with the ones recorded, clear `.next/dev` when one is gone and record them.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {object[]} [input.files] - the generated files (`[{ path }]`) of the preparation
 * @param {boolean} [input.watching] - a long-lived `nextspark dev` watcher: never clears, and records only the union of the record and the routes
 * @param {object} [input.fs] - test seam: `projectFiles(projectRoot)`
 * @returns {{ action: 'unchanged'|'recorded'|'cleared'|'kept', line?: string }}
 */
export function syncDevCache({ projectRoot, files, watching = false, running = devServerRunning, fs = projectFiles(projectRoot) }) {
  const routes = routePaths(files)
  const previous = readState(projectRoot)
  const record = (list = routes) => {
    fs.mkdirSync(join(projectRoot, '.nextspark'), { recursive: true })
    fs.writeFileSync(join(projectRoot, ROUTES_STATE_FILE), `${JSON.stringify({ routes: list })}\n`)
  }
  // The watcher adds what is new and never drops what left, so the prepare after the server stops still sees it missing
  const recordForWatcher = () => record([...new Set([...(previous ?? []), ...routes])].sort())
  if (previous && previous.length === routes.length && previous.every((path, index) => path === routes[index])) return { action: 'unchanged' }
  const now = new Set(routes)
  const gone = previous?.filter(path => !now.has(path)) ?? []
  const dev = join(projectRoot, '.next', 'dev')
  const next = lstatOrNull(join(projectRoot, '.next'))
  const stat = gone.length > 0 ? lstatOrNull(dev) : null
  if (!stat) {
    // A first record, only routes added, or nothing of Next's to clear
    if (watching) recordForWatcher()
    else record()
    return { action: 'recorded' }
  }
  const changed = `${gone.length} generated route file${gone.length === 1 ? '' : 's'} left src/app (${gone.slice(0, 3).join(', ')}${gone.length > 3 ? ', ...' : ''})`
  const kept = (reason, advice) => ({ action: 'kept', line: `${changed}, and .next/dev ${reason}: ${advice}, or Next's type check fails on the routes that are now left out.` })
  const byHand = 'delete .next/dev by hand before next build'
  if (next?.isSymbolicLink() || stat.isSymbolicLink()) return kept('is (or sits in) a symlink, which prepare does not follow', byHand)
  if (!stat.isDirectory()) return kept('is not a directory', byHand)
  if (watching) recordForWatcher()
  if (watching || running(projectRoot)) return kept('is in use by a running dev server', 'stop it; the next prepare clears .next/dev before next build')
  fs.rmSync(dev, { recursive: true, force: true })
  record()
  return { action: 'cleared', line: `${changed}: deleted .next/dev, where Next keeps the types of the routes it served.` }
}
