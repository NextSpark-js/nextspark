/**
 * Preloaded by `nextspark worker`, after tsx. Two imports of the project's server code have no meaning outside a Next
 * build, and the worker is a plain Node process:
 *
 * - `server-only` throws unless Next resolves it: it becomes an empty module. A pnpm project does not list the
 *   package, so it could not be found anyway.
 * - `@nextsparkjs/registries` and `@nextsparkjs/registries/<name>` are a Next/tsconfig alias for the generated
 *   `<project>/.nextspark/registries/<name>.ts`.
 *
 * It is done twice, because the project's `.ts` files load as ES modules or as CommonJS depending on its package.json
 * `type`: an ESM resolve hook (module.register, which exists in every supported Node; registerHooks does not) and a
 * patch of `Module._resolveFilename` for `require`. The registries live under the directory the worker starts in.
 */
import Module, { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRIES_DIR = path.join(process.cwd(), '.nextspark', 'registries')
const ALIAS = '@nextsparkjs/registries'
const EMPTY_FILE = fileURLToPath(new URL('./empty.cjs', import.meta.url))

/** The generated file an `@nextsparkjs/registries` specifier stands for, or null for any other specifier. */
function registryFile(specifier) {
  if (specifier === ALIAS) return path.join(REGISTRIES_DIR, 'index.ts')
  if (!specifier.startsWith(`${ALIAS}/`)) return null
  const name = specifier.slice(ALIAS.length + 1)
  return path.join(REGISTRIES_DIR, /\.[cm]?[jt]s$/.test(name) ? name : `${name}.ts`)
}

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(request, ...rest) {
  if (request === 'server-only') return EMPTY_FILE
  return registryFile(request) ?? resolveFilename.call(this, request, ...rest)
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
}`)
)
