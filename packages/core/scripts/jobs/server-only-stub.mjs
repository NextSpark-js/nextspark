/**
 * Preloaded by `nextspark worker`: the `server-only` guard (imported by the registries and by core modules) throws
 * outside a Next server build, and the worker is a server. This makes it an empty module, and does not depend on
 * `server-only` being resolvable from the project (a pnpm project does not list it).
 */
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
  return next(specifier, context)
}`)
)
