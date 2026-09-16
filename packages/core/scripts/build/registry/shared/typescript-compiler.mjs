/**
 * TypeScript Compiler Loader
 *
 * Resolves the TypeScript 5/6 compiler API a registry build step needs to
 * read a source file's real syntax tree, shared by every discovery or
 * generation step that parses TypeScript instead of scanning raw text.
 *
 * @module core/scripts/build/registry/shared/typescript-compiler
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'
import { errorWithLines } from '../../../utils/logging.mjs'

/** TypeScript 7's native port doesn't ship the compiler API - its package
 * exports are `./lib/version.cjs` plus `./unstable/*` - so a candidate module
 * is checked for the API surface this build needs, not just for existing. */
function hasCompilerApi(ts) {
  return Boolean(ts && typeof ts.createSourceFile === 'function' && typeof ts.getScriptKindFromFileName === 'function' && ts.ScriptKind)
}

/**
 * Try each TypeScript candidate in order and return the first module whose API this
 * build needs. A candidate that loads but lacks the API is recorded and the next
 * one is tried, rather than failing on the first hit - the point of trying more than
 * one candidate at all.
 */
export async function selectTypeScriptModule(candidates) {
  const rejected = []

  for (const candidate of candidates) {
    let loaded
    try {
      loaded = await candidate.load()
    } catch (error) {
      rejected.push(`${candidate.label}: could not be loaded (${error.message})`)
      continue
    }

    const ts = loaded?.default ?? loaded
    if (hasCompilerApi(ts)) {
      return ts
    }
    rejected.push(
      `${candidate.label}: found TypeScript ${ts?.version ?? 'of an unknown version'}, which does not export the TypeScript 5/6 ` +
        'compiler API (createSourceFile, getScriptKindFromFileName, ScriptKind) the registry build needs'
    )
  }

  throw errorWithLines([
    'Parsing a source file for the registry build requires the TypeScript 5 or 6 compiler API, but no candidate provided it:',
    ...rejected.map(reason => `  - ${reason}`),
  ])
}

const modulePromises = new Map()

/**
 * The TypeScript compiler, resolved from core first and then from `projectRoot`:
 * it is a dependency of core (#195), so it is always found there regardless of
 * the TypeScript version the project itself has installed; the project is a
 * fallback for setups where core's own copy is not reachable from the caller's
 * location on disk. Cached per project root so repeated calls in the same
 * build don't re-resolve the module.
 */
export function loadTypeScriptFor(projectRoot) {
  if (!modulePromises.has(projectRoot)) {
    modulePromises.set(
      projectRoot,
      selectTypeScriptModule([
        { label: '@nextsparkjs/core', load: () => import('typescript') },
        { label: `the project at ${projectRoot}`, load: async () => createRequire(join(projectRoot, 'package.json'))('typescript') },
      ])
    )
  }
  return modulePromises.get(projectRoot)
}
