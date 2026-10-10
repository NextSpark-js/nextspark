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
 *   - a method whose declaration in the route module calls `withRateLimitTier` or `withRateLimit`
 *     (`export const POST = withRateLimitTier(handler, 'strict')`): it chose its own limit;
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
/** What a route module calls to choose its own limit (core's `lib/api/rate-limit`). */
const SELF_LIMITERS = new Set(['withRateLimitTier', 'withRateLimit'])

/** The host config value (`rateLimit`) for a core: its wrapper module, resolved to a file. */
export function coreRouteRateLimit(resolveFile) {
  return { specifier: RATE_LIMIT_MODULE, file: resolveFile(RATE_LIMIT_MODULE) }
}

/** A planned route the default limit applies to. */
export function isRateLimitedRoute(route) {
  return route.kind === 'route' && route.origin !== 'core' && route.target.startsWith('api/')
}

/** True when `node` contains a call of a self-limiter (an imported binding or `x.withRateLimitTier(...)`). */
function callsLimiter(node, limiters, ts) {
  if (ts.isCallExpression(node)) {
    const callee = node.expression
    if ((ts.isIdentifier(callee) && limiters.has(callee.text)) || (ts.isPropertyAccessExpression(callee) && SELF_LIMITERS.has(callee.name.text))) return true
  }
  return Boolean(ts.forEachChild(node, child => callsLimiter(child, limiters, ts) || undefined))
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
 * @returns {{ methods: Record<string, { name: string, specifier: string }>, diagnostics: object[] }}
 */
export function planRouteRateLimit({ source, file, analysis, ts, config }) {
  const optOut = analysis.exports.find(entry => entry.name === RATE_LIMIT_EXPORT)
  if (optOut) {
    if (optOut.form === 'const-literal' && optOut.literal === false) return { methods: {}, diagnostics: [] }
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
  const declarations = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      for (const element of statement.importClause.namedBindings.elements) {
        if (SELF_LIMITERS.has((element.propertyName ?? element.name).text)) limiters.add(element.name.text)
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
    if (entry.form !== 'reexport' && initializer && callsLimiter(initializer, limiters, ts)) continue
    methods[entry.name] = { name: WRAPPER_OF[tier], specifier: config.specifier }
  }
  return { methods, diagnostics: [] }
}
