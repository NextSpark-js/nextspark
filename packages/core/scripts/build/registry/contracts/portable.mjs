/**
 * The portable schema sources of core, shared by the server and the contracts (#203 stage 7b).
 *
 * `lib/entities/portable/` in core holds the code that decides what an entity API accepts (the schema
 * generator) and returns (the response shape). The server imports it; the contracts emitter
 *   1. copies it verbatim into the contracts package (`src/schema/`), so a client validates with the very
 *      bytes the server enforces with, and
 *   2. evaluates the response-shape part while generating, so the DTOs list the columns the handlers select.
 *
 * @module core/scripts/build/registry/contracts/portable
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

/** The files of the portable directory, in the order the copy lists them. Each imports zod and its siblings only. */
export const PORTABLE_FILES = ['media-ref', 'response-shape', 'schema-generator', 'system-fields', 'types']

export const PORTABLE_DIR = 'src/lib/entities/portable'

export class PortableSourcesError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PortableSourcesError'
  }
}

/** The portable sources as `{ path, content }` for the contracts package, verbatim (`src/schema/<file>.ts`). */
export function readPortableSources(coreRoot) {
  return PORTABLE_FILES.map(name => {
    const file = join(coreRoot, PORTABLE_DIR, `${name}.ts`)
    try {
      return { path: `src/schema/${name}.ts`, content: readFileSync(file, 'utf8') }
    } catch {
      throw new PortableSourcesError(`the installed @nextsparkjs/core (${coreRoot}) does not ship ${PORTABLE_DIR}/${name}.ts, which the contracts are generated from`)
    }
  })
}

/**
 * Evaluate response-shape.ts (the functions the generic handlers also call) and return its exports.
 * The file is TypeScript that imports zod: it is transpiled and run with core's own zod.
 */
export async function loadResponseShape(coreRoot, projectRoot) {
  const ts = await loadTypeScriptFor(projectRoot)
  const source = readPortableSources(coreRoot).find(file => file.path === 'src/schema/response-shape.ts').content
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  const coreRequire = createRequire(join(coreRoot, 'package.json'))
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(id => {
    if (id === 'zod') return coreRequire('zod')
    throw new PortableSourcesError(`response-shape.ts imports ${id}: the portable sources may import zod only`)
  }, module, module.exports)
  return module.exports
}
