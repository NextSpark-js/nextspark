/**
 * Preloaded by `nextspark worker`, after tsx. Two imports of the project's server code have no meaning outside a Next
 * build, and the worker is a plain Node process:
 *
 * - `server-only` throws unless Next resolves it: it becomes an empty module. A pnpm project does not list the
 *   package, so it could not be found anyway.
 * - `@nextsparkjs/registries` and `@nextsparkjs/registries/<name>` are a Next/tsconfig alias for the generated
 *   `<project>/.nextspark/registries/<name>.ts`.
 *
 * Both are done twice, because a `.ts` file reaches Node as an ES module or as CommonJS: an ESM resolve hook
 * (module.register, which exists in every supported Node; registerHooks does not) and a patch of
 * `Module._resolveFilename` for `require`. On Node 22.14 a file whose URL carries a query (tsx's
 * `?tsx-commonjs-export-preparse=1`) stays CommonJS and imports core with `require`, so the CommonJS side needs the
 * registries alias too. The registries live under the directory the worker starts in.
 *
 * The ESM hook also loads the project's own `.ts` files as ES modules. Core's ES modules import names from the
 * generated registries (`import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry'`), and Node 22.14
 * finds the names of a CommonJS module by scanning the file on disk, which for TypeScript sees no export: "does not
 * provide an export named". As ES modules, their names are declared in the source. Newer Node versions read the source
 * the loader returns, which is why Node 24 did not show it.
 *
 * ponytail: on Node 22.14 a project module that reaches Node through the query URL above is evaluated twice (once to
 * preparse its exports, once as the module), so a handler file must not do work at import time besides registering.
 * No small fix: the loader offers no way to say a URL is the same module.
 */
import Module, { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRIES_DIR = path.join(process.cwd(), '.nextspark', 'registries')
const ALIAS = '@nextsparkjs/registries'
const EMPTY_FILE = fileURLToPath(new URL('./empty.cjs', import.meta.url))

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(request, ...rest) {
  if (request === 'server-only') return EMPTY_FILE
  if (request === ALIAS || request.startsWith(`${ALIAS}/`)) {
    const name = request === ALIAS ? 'index' : request.slice(ALIAS.length + 1)
    return path.join(REGISTRIES_DIR, /\.[cm]?[jt]s$/.test(name) ? name : `${name}.ts`)
  }
  return resolveFilename.call(this, request, ...rest)
}

register(
  'data:text/javascript,' +
    encodeURIComponent(`
const ALIAS = ${JSON.stringify(ALIAS)}
const DIR = ${JSON.stringify(REGISTRIES_DIR)}
import { pathToFileURL } from 'node:url'
import path from 'node:path'
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
  if (specifier === ALIAS || specifier.startsWith(ALIAS + '/')) {
    const name = specifier === ALIAS ? 'index' : specifier.slice(ALIAS.length + 1)
    const file = path.join(DIR, /\\.[cm]?[jt]s$/.test(name) ? name : name + '.ts')
    return next(pathToFileURL(file).href, context)
  }
  return next(specifier, context)
}
export async function load(url, context, next) {
  if (/\\.tsx?$/.test(url) && url.startsWith('file:') && !url.includes('/node_modules/')) return next(url, { ...context, format: 'module' })
  return next(url, context)
}`)
)
