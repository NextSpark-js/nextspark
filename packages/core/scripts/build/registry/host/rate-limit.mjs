/**
 * The default rate limit of project and plugin API routes (#226).
 *
 * Up to 0.1.0-beta.191 a theme's and a plugin's API routes went through core's dispatchers, which wrapped every
 * method with `withRateLimitTier` (read for GET, write for POST, PUT, PATCH and DELETE). The generated host serves them
 * as their own facades, so the host composes the same limit into each one:
 *
 *   export const GET = withReadRateLimit(NextSparkGET)
 *   export const POST = withWriteRateLimit(NextSparkPOST)
 *
 * Which routes: every Route Handler under `src/app/api/` that a project (`api/**`, `templates/api/**`) or a plugin
 * provides. Core's own routes limit themselves. Per method: `GET`/`HEAD` read, `POST`/`PUT`/`PATCH`/`DELETE` write,
 * `OPTIONS` never (a CORS preflight). Left alone:
 *   - a method whose declaration in the route module is core's `withRateLimitTier(...)` (imported from
 *     `@nextsparkjs/core/lib/api/rate-limit` or `@nextsparkjs/core/lib/api`), directly or in the chain of wrappers
 *     around the handler (`withLogging(withRateLimitTier(h, 'strict'))`), or a local constant initialized that way
 *     (one step: `const h = withRateLimitTier(...); export const GET = h`): it chose its own limit. Anything else is
 *     wrapped: a wrong skip leaves a route unlimited, a wrong wrap only counts it twice. `withRateLimit` does not
 *     count: it only limits requests that present an API key;
 *   - every method of a module that exports `rateLimit = false` (a webhook with its own limits). Only the literal
 *     `false` is accepted; the export is read here and never forwarded to Next.js.
 *
 * @module core/scripts/build/registry/host/rate-limit
 */

import { CORE_ROUTES_SPECIFIER } from './core-routes.mjs'

/** The export a route module opts out with: `export const rateLimit = false`. */
export const RATE_LIMIT_EXPORT = 'rateLimit'
export const RATE_LIMIT_MODULE = `${CORE_ROUTES_SPECIFIER}_internal/route-rate-limit`
const TIER_OF = { GET: 'read', HEAD: 'read', POST: 'write', PUT: 'write', PATCH: 'write', DELETE: 'write' }
const WRAPPER_OF = { read: 'withReadRateLimit', write: 'withWriteRateLimit' }
/** What a route module calls to choose its own limit, and the core modules that export it. */
const SELF_LIMITERS = new Set(['withRateLimitTier'])
const LIMITER_MODULES = new Set(['@nextsparkjs/core/lib/api/rate-limit', '@nextsparkjs/core/lib/api'])

/** The host config value (`rateLimit`) for a core: its wrapper module, resolved to a file. */
export function coreRouteRateLimit(resolveFile) {
  return { specifier: RATE_LIMIT_MODULE, file: resolveFile(RATE_LIMIT_MODULE) }
}

/** The Info notice that lists the API routes opted out with `rateLimit = false` (null when there is none). */
export function rateLimitOptOutNotice(routes) {
  if (routes.length === 0) return null
  return {
    code: 'NS_HOST_RATE_LIMIT_OPT_OUT',
    by: routes.map(route => route.source),
    message: `${routes.length} API route${routes.length === 1 ? '' : 's'} export rateLimit = false and ${routes.length === 1 ? 'is' : 'are'} served without the default rate limit: ${routes.map(route => `src/app/${route.target} (${route.source})`).join(', ')}`,
  }
}

/** A planned route the default limit applies to. */
export function isRateLimitedRoute(route) {
  return route.kind === 'route' && route.origin !== 'core' && route.target.startsWith('api/')
}

/**
 * True when `expression` is a call of core's limiter (`limiters`: local names; `namespaces`: `ns.withRateLimitTier`), or a
 * call whose first argument (the handler position) carries one (a wrapper chain). Function bodies are not looked into.
 * `follow` resolves a local identifier to its initializer, one step.
 */
function isSelfLimited(expression, { limiters, namespaces, ts, follow }) {
  let node = expression
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isNonNullExpression(node)) node = node.expression
  if (ts.isIdentifier(node) && follow) {
    const initializer = follow(node.text)
    return Boolean(initializer) && isSelfLimited(initializer, { limiters, namespaces, ts, follow: null })
  }
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee) && limiters.has(callee.text)) return true
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && SELF_LIMITERS.has(callee.name.text)) return true
  // Only the handler position: a limiter passed as another argument does not limit the handler
  return node.arguments.length > 0 && isSelfLimited(node.arguments[0], { limiters, namespaces, ts, follow })
}

/**
 * The methods of one Route Handler module the host wraps, each with its core wrapper.
 *
 * @param {object} input
 * @param {string} input.source - the route module
 * @param {string} input.file - its path (for diagnostics and the script kind)
 * @param {object} input.analysis - `analyzeRouteSource()` of it
 * @param {object} input.ts - the TypeScript compiler
 * @param {{ specifier: string }} input.config - `coreRouteRateLimit()`
 * @returns {{ methods: Record<string, { name: string, specifier: string }>, optedOut?: boolean, diagnostics: object[] }}
 */
export function planRouteRateLimit({ source, file, analysis, ts, config }) {
  const optOut = analysis.exports.find(entry => entry.name === RATE_LIMIT_EXPORT)
  if (optOut) {
    if (optOut.form === 'const-literal' && optOut.literal === false) return { methods: {}, optedOut: true, diagnostics: [] }
    return {
      methods: {},
      diagnostics: [{
        code: 'NS_HOST_INVALID_RATE_LIMIT',
        file,
        line: optOut.line,
        exportName: RATE_LIMIT_EXPORT,
        message: `"${RATE_LIMIT_EXPORT}" opts a route out of the default rate limit and must be exactly \`export const ${RATE_LIMIT_EXPORT} = false\`; to choose a tier, wrap the method with withRateLimitTier(handler, '<tier>')`,
      }],
    }
  }

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  const limiters = new Set()
  const namespaces = new Set()
  const declarations = new Map()
  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly && LIMITER_MODULES.has(statement.moduleSpecifier.text) ? statement.importClause?.namedBindings : null
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly && SELF_LIMITERS.has((element.propertyName ?? element.name).text)) limiters.add(element.name.text)
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) declarations.set(declaration.name.text, declaration.initializer)
      }
    }
  }

  const methods = {}
  for (const entry of analysis.exports) {
    const tier = TIER_OF[entry.name]
    if (!tier) continue
    const initializer = declarations.get(entry.form === 'export-clause' ? entry.localName : entry.name)
    if (entry.form !== 'reexport' && initializer && isSelfLimited(initializer, { limiters, namespaces, ts, follow: name => declarations.get(name) })) continue
    methods[entry.name] = { name: WRAPPER_OF[tier], specifier: config.specifier }
  }
  return { methods, diagnostics: [] }
}
