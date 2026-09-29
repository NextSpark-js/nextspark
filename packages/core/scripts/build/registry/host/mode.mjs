/**
 * Which preparation a project gets (#203): the generated host or the legacy registry build.
 *
 * - `host`: the installed core ships the route manifest, and the project has no `src/app`, an
 *   empty one (empty directories and placeholders such as `.gitkeep` or `README.md` only, which
 *   stay untouched), or one described by a valid generation record (`.nextspark/generation.json`
 *   that parses, has this schema version and lists only NextSpark's paths). The record only selects
 *   the mode: publication still proves every file against the disk (a listed file whose bytes no
 *   longer match its recorded hash is foreign) and refuses before writing.
 * - `legacy-app`: the core ships the manifest, but `src/app` holds files and no valid record: a
 *   committed app tree (a project made before the generated host, or by a wizard that still
 *   copies `src/app`). It keeps the legacy registry build exactly as before, silently: no
 *   command can convert a committed src/app yet (stage 5 adds that), and advice that fails is
 *   worse than none. `prepare --check` still says the project is in legacy mode.
 * - `no-manifest`: the core cannot generate the host at all; the legacy registry build.
 *
 * Read-only: deciding never writes.
 *
 * @module core/scripts/build/registry/host/mode
 */

import { hasCoreRouteManifest } from './core-routes.mjs'
import { GenerationError, readGeneration, scanTree } from './generation.mjs'
import { APP_DIR } from './render.mjs'

export const HOST_MODES = Object.freeze(['host', 'legacy-app', 'no-manifest'])

/** A generation record that parses and validates (readGeneration); an invalid one is no ownership. */
function hasValidGenerationRecord(projectRoot) {
  try {
    return readGeneration(projectRoot) !== null
  } catch (error) {
    if (error instanceof GenerationError) return false
    throw error
  }
}

/**
 * @param {{ coreRoot: string, projectRoot: string }} input
 * @returns {{ mode: 'host' | 'legacy-app' | 'no-manifest', reason: string }}
 */
export function resolveHostMode({ coreRoot, projectRoot }) {
  if (!hasCoreRouteManifest(coreRoot)) {
    return { mode: 'no-manifest', reason: 'the installed @nextsparkjs/core ships no route manifest' }
  }
  // scanTree leaves placeholders out (.gitkeep, README.md, OS files): a src/app of those only is empty
  const tree = scanTree(projectRoot, APP_DIR)
  const empty = tree.root === 'directory' && tree.files.length === 0 && tree.symlinks.length === 0 && tree.others.length === 0
  if (tree.root === 'missing' || empty) return { mode: 'host', reason: 'src/app is absent: it is generated' }
  if (hasValidGenerationRecord(projectRoot)) return { mode: 'host', reason: 'src/app is described by a generation record' }
  return { mode: 'legacy-app', reason: 'src/app is a committed app tree no generation owns' }
}
