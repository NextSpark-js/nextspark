/**
 * API-key scopes the routes of a project declare (#426)
 *
 * A Route Handler that authenticates API keys with `authenticateRequest` or `validateAndAuthenticateRequest` and passes
 * neither `requiredScope` nor `allowAnyScope` refuses EVERY key at runtime (403 `SCOPE_NOT_DECLARED`), request by request.
 * A route that requires a scope neither core nor `api.scopes` of config/app.config.ts declares can never be satisfied
 * by the key that was meant for it: the scope cannot be minted (`INVALID_SCOPES`), so only a wildcard key passes.
 *
 * `findApiKeyScopeProblems` reads the route sources of the host plan (the project's, its templates' and its plugins')
 * with the registry build's TypeScript compiler and lists both, with `file:line` and the call. Read-only; nothing runs.
 * `nextspark prepare` (and `build`, `dev` and `prepare --check`) print the notices, and `nextspark doctor` lists them.
 *
 * What it reads: the calls written in the route module itself, to the two entry points imported from
 * `@nextsparkjs/core` (by name, renamed or through a namespace import). Their options are read when written as an object
 * literal, or as a name bound once to one in the same file. A call that declares nothing, whose result is guarded at once with
 * `if (auth.type !== 'session') return ...` and with no comparison with `'api-key'` in the function, answers only sessions on
 * purpose and is not listed. What it does not see
 * (no false alarm, a missed one): a call in a helper module the route imports, options built at runtime, a
 * `requiredScope` that is not a string literal (or a list of them), and the scopes of `api.scopes` when
 * config/app.config.ts does not write them as literals.
 *
 * @module core/scripts/maintenance/api-key-scopes
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { loadTypeScriptFor } from '../build/registry/shared/typescript-compiler.mjs'

export const API_KEY_NO_SCOPE_WARNING = 'NS_API_KEY_ROUTE_WITHOUT_SCOPE'
export const API_KEY_UNDECLARED_SCOPE_WARNING = 'NS_API_KEY_SCOPE_NOT_DECLARED'

/** The scopes core enforces (`API_SCOPES` of src/lib/api/keys.ts; scripts/build/registry/host/__tests__/host-api-key-scopes.test.mjs keeps the two equal). */
export const CORE_API_SCOPES = Object.freeze([
  'users:read', 'users:write', 'users:delete',
  'tasks:read', 'tasks:write', 'tasks:delete',
  'media:read', 'media:write', 'media:delete',
  'teams:read', 'teams:write', 'teams:delete',
  'billing:read', 'billing:write',
  'admin:api-keys', 'admin:users', 'admin:devtools',
  '*',
])

export const NO_SCOPE_FIX = "pass { requiredScope: '<scope>' } to the call, or { allowAnyScope: true } if any valid key is acceptable"
export const UNDECLARED_SCOPE_FIX = "declare each scope in api.scopes of APP_CONFIG_OVERRIDES in config/app.config.ts, for example api: { scopes: { 'reports:read': 'Read reports' } }"

/** The core entry points that enforce `requiredScope` / `allowAnyScope`, and where a project imports them from */
const ENTRY_POINTS = new Set(['authenticateRequest', 'validateAndAuthenticateRequest'])
const CORE_MODULE = /^@nextsparkjs\/core(?:\/|$)/
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

const unwrap = (node, ts) => {
  let current = node
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current) || ts.isNonNullExpression(current)) current = current.expression
  return current
}
const isText = (node, ts) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
const nameOf = (name, ts) => (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) || ts.isNumericLiteral(name) ? name.text : null)

/**
 * What one call declares through its second argument.
 * @returns {{ declared: 'none' } | { declared: 'any' } | { declared: 'unknown' } | { declared: 'scopes', scopes: string[], dynamic: boolean }}
 */
function declaredBy(argument, { ts, constants }) {
  if (!argument) return { declared: 'none' }
  let node = unwrap(argument, ts)
  if (ts.isIdentifier(node)) {
    if (node.text === 'undefined') return { declared: 'none' }
    const initializer = constants.get(node.text)
    if (!initializer) return { declared: 'unknown' }
    node = unwrap(initializer, ts)
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return { declared: 'none' }
  if (!ts.isObjectLiteralExpression(node)) return { declared: 'unknown' }

  let scopes = []
  let dynamic = false
  let any = false
  let spread = false
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      spread = true
      continue
    }
    const name = property.name ? nameOf(property.name, ts) : null
    if (name === 'requiredScope') {
      const value = ts.isShorthandPropertyAssignment(property) ? constants.get('requiredScope') : property.initializer
      const read = value ? unwrap(value, ts) : null
      if (read && isText(read, ts)) scopes = read.text ? [read.text] : []
      else if (read && ts.isArrayLiteralExpression(read)) {
        scopes = read.elements.filter(element => isText(unwrap(element, ts), ts)).map(element => unwrap(element, ts).text).filter(Boolean)
        dynamic = read.elements.some(element => !isText(unwrap(element, ts), ts))
      } else if (read && ts.isIdentifier(read) && read.text === 'undefined') scopes = []
      else dynamic = true
    } else if (name === 'allowAnyScope') {
      const value = property.initializer ? unwrap(property.initializer, ts) : null
      if (value?.kind === ts.SyntaxKind.TrueKeyword) any = true
      else if (value?.kind !== ts.SyntaxKind.FalseKeyword) dynamic = true
    }
  }
  if (scopes.length > 0) return { declared: 'scopes', scopes, dynamic }
  if (any || dynamic || spread) return { declared: any ? 'any' : 'unknown' }
  return { declared: 'none' }
}

/** The calls to the entry points in one route module, each with what it declares. */
export function scanApiKeyCalls({ source, file, ts }) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  // A module TypeScript can't parse is not read in part: prepare reports it
  if ((sourceFile.parseDiagnostics ?? []).length > 0) return []

  const direct = new Map() // local name -> entry point
  const namespaces = new Set()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly || !ts.isStringLiteral(statement.moduleSpecifier) || !CORE_MODULE.test(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings) continue
    if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
    else for (const element of bindings.elements) if (!element.isTypeOnly && ENTRY_POINTS.has((element.propertyName ?? element.name).text)) direct.set(element.name.text, (element.propertyName ?? element.name).text)
  }
  if (direct.size === 0 && namespaces.size === 0) return []

  // A name declared once with an initializer, to follow `authenticateRequest(request, OPTIONS)` one step
  const constants = new Map()
  const seen = new Set()
  const collect = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (seen.has(node.name.text)) constants.delete(node.name.text)
      else if (node.initializer) constants.set(node.name.text, node.initializer)
      seen.add(node.name.text)
    }
    ts.forEachChild(node, collect)
  }
  collect(sourceFile)

  const methodOf = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionDeclaration(parent) && parent.name && METHODS.has(parent.name.text)) return parent.name.text
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && METHODS.has(parent.name.text)) return parent.name.text
    }
    return null
  }
  // A route that answers only sessions says so with a guard on the result of this very call:
  // `const auth = await authenticateRequest(r); if (auth.type !== 'session') return ...`. Anything looser (a ternary, a
  // comparison with 'api-key' in the function, a `.type` of something else) means keys are handled, so it is not excluded.
  const isFunction = node => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
  const COMPARES = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]
  const NOT_EQUAL = [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]
  const disjuncts = expression => {
    const node = unwrap(expression, ts)
    return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken ? [...disjuncts(node.left), ...disjuncts(node.right)] : [node]
  }
  const leaves = guard => ts.isReturnStatement(guard) || ts.isThrowStatement(guard) || (ts.isBlock(guard) && guard.statements.length > 0 && (ts.isReturnStatement(guard.statements[0]) || ts.isThrowStatement(guard.statements[0])))
  const sessionOnly = node => {
    let holder = node.parent
    while (holder && (ts.isAwaitExpression(holder) || ts.isParenthesizedExpression(holder) || ts.isAsExpression(holder) || ts.isNonNullExpression(holder))) holder = holder.parent
    if (!holder || !ts.isVariableDeclaration(holder) || !ts.isIdentifier(holder.name)) return false
    const variable = holder.name.text
    let scope = node.parent
    while (scope && !isFunction(scope)) scope = scope.parent
    let guarded = false
    let apiKey = false
    const search = child => {
      if (ts.isBinaryExpression(child) && COMPARES.includes(child.operatorToken.kind) && [child.left, child.right].some(side => { const text = unwrap(side, ts); return isText(text, ts) && text.text === 'api-key' })) apiKey = true
      if (ts.isIfStatement(child) && leaves(child.thenStatement) && disjuncts(child.expression).some(part => {
        if (!ts.isBinaryExpression(part) || !NOT_EQUAL.includes(part.operatorToken.kind)) return false
        const sides = [part.left, part.right].map(side => unwrap(side, ts))
        return sides.some(side => isText(side, ts) && side.text === 'session') && sides.some(side => ts.isPropertyAccessExpression(side) && side.name.text === 'type' && ts.isIdentifier(side.expression) && side.expression.text === variable)
      })) guarded = true
      ts.forEachChild(child, search)
    }
    search(scope ?? sourceFile)
    return guarded && !apiKey
  }
  const found = []
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression, ts)
      const entry = ts.isIdentifier(callee) ? direct.get(callee.text) : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && ENTRY_POINTS.has(callee.name.text) ? callee.name.text : null
      if (entry) {
        const text = node.getText(sourceFile).replace(/\s+/g, ' ')
        const options = declaredBy(node.arguments[1], { ts, constants })
        found.push({
          entry,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          method: methodOf(node),
          call: text.length > 90 ? `${text.slice(0, 87)}...` : text,
          ...(options.declared === 'none' && sessionOnly(node) ? { declared: 'session' } : options),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

/**
 * The scopes a project declares in `api.scopes` of config/app.config.ts, and whether the list is complete: only keys
 * written as literals are read, and a spread, a computed key or a value that is not an object literal makes it incomplete
 * (a scope can't then be called undeclared).
 */
export function readDeclaredApiScopes({ projectRoot, ts }) {
  const file = path.join(projectRoot, 'config', 'app.config.ts')
  const scopes = new Set()
  if (!existsSync(file)) return { scopes, complete: true } // core's defaults declare none
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    return { scopes, complete: false }
  }
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if ((sourceFile.parseDiagnostics ?? []).length > 0) return { scopes, complete: false }

  let complete = true
  let found = false
  let spreads = false
  const visit = node => {
    if (ts.isSpreadAssignment(node)) spreads = true
    if (ts.isPropertyAssignment(node) && nameOf(node.name, ts) === 'api') {
      const api = unwrap(node.initializer, ts)
      if (!ts.isObjectLiteralExpression(api)) complete = false
      else {
        for (const property of api.properties) {
          if (ts.isSpreadAssignment(property)) complete = false
          else if (property.name && nameOf(property.name, ts) === 'scopes') {
            found = true
            const declared = ts.isPropertyAssignment(property) ? unwrap(property.initializer, ts) : null
            if (!declared || !ts.isObjectLiteralExpression(declared)) {
              complete = false
              continue
            }
            for (const entry of declared.properties) {
              const key = ts.isSpreadAssignment(entry) ? null : ts.isComputedPropertyName(entry.name) ? (isText(unwrap(entry.name.expression, ts), ts) ? unwrap(entry.name.expression, ts).text : null) : nameOf(entry.name, ts)
              if (key === null) complete = false
              else scopes.add(key)
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  // No api.scopes written: the project may still spread them in from elsewhere
  if (!found && spreads) complete = false
  return { scopes, complete }
}

/** The route sources the project or its plugins wrote, from the host plan: `{ file, source, url }`. */
function routeSources(routes) {
  const sources = []
  for (const route of routes) {
    if (route.kind !== 'route') continue
    // A project file that replaces a core route, or is an entity route's template; a webhook's module is not a route file
    const file = route.template?.file ?? (!route.entityRoute && !route.webhook && route.origin && route.origin !== 'core' ? route.file : null)
    if (!file) continue
    sources.push({ file, source: route.template?.source ?? route.source ?? file, url: `/${String(route.target).replace(/\/?route\.[^/]+$/, '')}` })
  }
  return sources
}

/**
 * The API-key scope problems of the route sources of a host plan.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {object[]} input.routes - the host plan's routes
 * @param {object} [input.ts] - the TypeScript compiler (the project's, by default)
 * @returns {Promise<{ withoutScope: object[], undeclared: object[] }>} each finding `{ url, source, line, method, call, scope? }`
 */
export async function findApiKeyScopeProblems({ projectRoot, routes, ts }) {
  const sources = routeSources(routes)
  const empty = { withoutScope: [], undeclared: [] }
  if (sources.length === 0) return empty
  const compiler = ts ?? (await loadTypeScriptFor(projectRoot))
  const declared = readDeclaredApiScopes({ projectRoot, ts: compiler })
  const known = new Set([...CORE_API_SCOPES, ...declared.scopes])

  const withoutScope = []
  const undeclared = []
  for (const { file, source, url } of sources) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue // prepare reports an unreadable source
    }
    for (const call of scanApiKeyCalls({ source: text, file, ts: compiler })) {
      const where = { url, source, line: call.line, method: call.method, call: call.call }
      if (call.declared === 'none') withoutScope.push(where)
      else if (call.declared === 'scopes' && declared.complete) for (const scope of call.scopes) if (!known.has(scope)) undeclared.push({ ...where, scope })
    }
  }
  const order = (a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.line - b.line)
  return { withoutScope: withoutScope.sort(order), undeclared: undeclared.sort(order) }
}

/** `source:line METHOD call`, for a notice and the doctor message */
export const describeApiKeyFinding = finding => `${finding.source}:${finding.line} ${finding.method ? `${finding.method} ` : ''}${finding.scope ? `requires '${finding.scope}': ` : ''}${finding.call}`

const listOf = findings => {
  const shown = findings.slice(0, 10).map(describeApiKeyFinding)
  return `${shown.join('; ')}${findings.length > 10 ? `; +${findings.length - 10} more` : ''}`
}
const files = findings => new Set(findings.map(finding => finding.source)).size

/** The plan notices: one per kind of problem that has findings (none when there is nothing to say). */
export function apiKeyScopeNotices({ withoutScope, undeclared }) {
  const notices = []
  if (withoutScope.length > 0) {
    notices.push({
      code: API_KEY_NO_SCOPE_WARNING,
      target: withoutScope[0].source,
      findings: withoutScope,
      message:
        `${withoutScope.length} call${withoutScope.length === 1 ? '' : 's'} to authenticateRequest or validateAndAuthenticateRequest in ${files(withoutScope)} route file${files(withoutScope) === 1 ? '' : 's'} declare${withoutScope.length === 1 ? 's' : ''} neither requiredScope nor allowAnyScope, ` +
        `so every API key is refused on ${withoutScope.length === 1 ? 'that route' : 'those routes'} at runtime (403 SCOPE_NOT_DECLARED; sessions are not affected): ${listOf(withoutScope)}. Fix: ${NO_SCOPE_FIX}.`,
    })
  }
  if (undeclared.length > 0) {
    const scopes = [...new Set(undeclared.map(finding => finding.scope))]
    notices.push({
      code: API_KEY_UNDECLARED_SCOPE_WARNING,
      target: undeclared[0].source,
      findings: undeclared,
      message:
        `${undeclared.length} route call${undeclared.length === 1 ? '' : 's'} require${undeclared.length === 1 ? 's' : ''} ${scopes.length === 1 ? 'a scope' : 'scopes'} (${scopes.map(scope => `'${scope}'`).join(', ')}) that neither core nor api.scopes declares, ` +
        `so no key can be created with ${scopes.length === 1 ? 'it' : 'them'} (INVALID_SCOPES) and only a wildcard key passes: ${listOf(undeclared)}. Fix: ${UNDECLARED_SCOPE_FIX}.`,
    })
  }
  return notices
}

/**
 * The findings for the project at `projectRoot` as `nextspark doctor` asks: the host plan as `prepare` would make it
 * (nothing is written), its API-key notices. `checked` is false, with the reason, when the project has no plan to read
 * (a committed src/app that `nextspark migrate` converts, a core without the route manifest, a plan with errors).
 */
export async function findApiKeyScopeProblemsInProject(projectRoot) {
  const { predictHost, projectHostConfig } = await import('../build/registry/host/prepare.mjs')
  const { resolveHostMode } = await import('../build/registry/host/mode.mjs')
  const config = projectHostConfig({ projectRoot })
  const { mode, reason } = resolveHostMode({ coreRoot: config.coreRoot, projectRoot })
  if (mode !== 'host') return { checked: false, reason: `${reason}; run nextspark migrate or upgrade @nextsparkjs/core first`, withoutScope: [], undeclared: [] }
  const predicted = await predictHost(config)
  const notices = predicted.notices.filter(notice => notice.code === API_KEY_NO_SCOPE_WARNING || notice.code === API_KEY_UNDECLARED_SCOPE_WARNING)
  const withoutScope = notices.find(notice => notice.code === API_KEY_NO_SCOPE_WARNING)?.findings ?? []
  const undeclared = notices.find(notice => notice.code === API_KEY_UNDECLARED_SCOPE_WARNING)?.findings ?? []
  if (notices.length === 0 && predicted.checks.plan !== 'passed') {
    return { checked: false, reason: `the host plan has errors (${predicted.diagnostics[0]?.code ?? 'see nextspark prepare'}); fix them first`, withoutScope, undeclared }
  }
  return { checked: true, withoutScope, undeclared }
}
