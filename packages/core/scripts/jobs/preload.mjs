/**
 * Preloaded by `nextspark worker`, after tsx. Two imports of the project's server code have no meaning outside a Next
 * build, and the worker is a plain Node process:
 *
 * - `server-only` throws unless Next resolves it: it becomes an empty module. A pnpm project does not list the
 *   package, so it could not be found anyway.
 * - `@nextsparkjs/registries` and `@nextsparkjs/registries/<name>` are a Next/tsconfig alias for the generated
 *   `<project>/.nextspark/registries/<name>.ts`.
 *
 * The project's `.ts` files load as ES modules or as CommonJS depending on its package.json `type`, so `server-only` is
 * handled by an ESM resolve hook (module.register, which exists in every supported Node; registerHooks does not) and by
 * a patch of `Module._resolveFilename` for `require`. The registries alias is only imported by core's ES modules, so
 * only the ESM hook maps it. The registries live under the directory the worker starts in.
 *
 * The same hook loads the project's own `.ts` files as ES modules, whatever its package.json `type`. Core's ES modules
 * import names from the generated registries (`import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry'`),
 * and Node 22.14 finds the names of a CommonJS module by scanning the file on disk, which for TypeScript sees no
 * export: "does not provide an export named". As ES modules, their names are declared in the source. (Newer Node versions
 * read the source the loader returns, which is why Node 24 did not show it.)
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
