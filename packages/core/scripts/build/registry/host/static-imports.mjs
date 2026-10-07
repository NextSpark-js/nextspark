/**
 * Generated-module gate for the generated host (#203)
 *
 * NextSpark writes every file under `src/app` and `.nextspark/registries` itself, so instead of
 * guessing how a runtime lookup might be spelled, each generated file is validated against a
 * small allowed grammar. Anything outside it - any expression, call, member access, function,
 * class, `export *`, computed key or spread - is a violation, which rules out selecting a module
 * by a runtime value however it is written.
 *
 * Grammar `facade` (route files), top-level statements only:
 *   - a directive prologue of `'use client'`
 *   - `import X from '<string>'`, `import { a, b as c } from '<string>'`, type-only imports
 *   - `export { a, b as c } from '<string>'`
 *   - `export { local, local as name }` of names imported in the same file
 *   - `export const name = <literal>` where the literal is exactly what `evaluateNextLiteral`
 *     (Next's extract-const-value) accepts
 *
 * The `facade` grammar also allows a fixed stylesheet import, `import '<string>.css'`: the root layout
 * imports the project's global stylesheet. It selects no module by a runtime value: the specifier is a
 * string literal, and only a `.css` one is accepted.
 *
 * Grammar `composed-facade` (a route whose default export or Route Handler methods are a fixed
 * composition, render.mjs / entity-routes.mjs): the `facade` grammar plus
 *   - at most one `export default <composition>`, and
 *   - any number of `export const NAME = <composition>`,
 * where a composition is `wrapper(arg, ...)`: the callee is a name imported in the same file, each argument
 * is an imported name, a string literal, an array of string literals, or a nested composition. No other
 * call, member access, spread or expression is accepted, so a composition can only apply fixed, statically
 * imported modules to each other: `export default withPublicMessages(Template)`,
 * `export default createEntityListRoute(taskEntityConfig, Template)`,
 * `export const POST = createStripeWebhookRoute(stripeWebhookExtensions)`.
 *
 * Grammar `dev-facade` (the root layout of a `nextspark dev` generation, render.mjs): the
 * `composed-facade` grammar, except that the only composition is exactly one `export default` whose
 * outermost callee is `withGenerationStatus`, imported from './_nextspark/generation-status' - a fixed
 * composition of fixed modules, never emitted by a production preparation.
 *
 * Grammar `registry` (`.nextspark/registries`):
 *   - the same imports
 *   - `export const NAME = <value>` where value is an object or array literal (optionally
 *     `as const` / `satisfies T`) whose keys are identifiers or string/number literals and whose
 *     leaves are literals (string, number, boolean, null, plain template) or identifiers imported
 *     in the same file; shorthand properties only for imported names; no computed keys, spreads,
 *     methods, getters/setters or calls
 *
 * @module core/scripts/build/registry/host/static-imports
 */

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { evaluateNextLiteral } from './next-literal.mjs'

export const GRAMMARS = ['facade', 'composed-facade', 'dev-facade', 'registry']

/** The module the `dev-facade` grammar's composition imports its wrapper from. */
export const DEV_STATUS_SPECIFIER = './_nextspark/generation-status'
/** The wrapper a dev root layout composes with. */
export const DEV_STATUS_WRAPPER = 'withGenerationStatus'

const ALLOWED_DIRECTIVES = new Set(['use client'])

const INTERNAL = '@nextsparkjs/core/routes/_internal/'

/**
 * The composition wrappers of core the generator writes calls of, by the exact module specifier that exports them.
 * `withSuperadminMessages` / `withDevtoolsMessages` are deliberately absent: a protected group's override is composed only
 * with the guard wrappers, which put core's role check around the project's layout.
 */
export const CORE_COMPOSITION_WRAPPERS = Object.freeze({
  [`${INTERNAL}root-layout`]: ['withRootLayout'],
  [`${INTERNAL}root-layout.ppr`]: ['withRootLayout'],
  [`${INTERNAL}auth-layout`]: ['withAuthMessages'],
  [`${INTERNAL}public-layout`]: ['withPublicMessages'],
  [`${INTERNAL}superadmin-layout`]: ['withSuperadminGuard'],
  [`${INTERNAL}devtools-layout`]: ['withDevtoolsGuard'],
  // The Cache Components modules (variants.json): the same wrappers over that mode's messages, each imported from the module
  // that exports it. `withSuperadminMessages` / `withDevtoolsMessages` stay absent here too.
  [`${INTERNAL}auth-layout.cc`]: ['withAuthMessages'],
  [`${INTERNAL}public-layout.cc`]: ['withPublicMessages'],
  [`${INTERNAL}superadmin-layout.cc`]: ['withSuperadminGuard'],
  [`${INTERNAL}devtools-layout.cc`]: ['withDevtoolsGuard'],
  // Every page and layout under /superadmin and /devtools (the manifest's `access`).
  [`${INTERNAL}area-access`]: ['withSuperadminAccess', 'withDevtoolsAccess', 'withSuperadminMetadata', 'withDevtoolsMetadata', 'withSuperadminRouteAccess', 'withDevtoolsRouteAccess'],
  // The same, for a Cache Components host (each segment checks inside its own Suspense boundary).
  [`${INTERNAL}area-access.cc`]: ['withSuperadminAccess', 'withDevtoolsAccess', 'withSuperadminMetadata', 'withDevtoolsMetadata', 'withSuperadminRouteAccess', 'withDevtoolsRouteAccess'],
  [`${INTERNAL}entity-layout-route`]: ['createEntityLayoutRoute'],
  [`${INTERNAL}entity-list-route`]: ['createEntityListRoute'],
  [`${INTERNAL}entity-detail-route`]: ['createEntityDetailRoute'],
  [`${INTERNAL}entity-create-route`]: ['createEntityCreateRoute'],
  [`${INTERNAL}entity-edit-route`]: ['createEntityEditRoute'],
  [`${INTERNAL}entity-detail-route.cc`]: ['createEntityDetailRoute'],
  [`${INTERNAL}entity-edit-route.cc`]: ['createEntityEditRoute'],
  [`${INTERNAL}public-item-route`]: ['createPublicItemRoute', 'createPublicItemMetadata'],
  [`${INTERNAL}public-item-route.cc`]: ['createPublicItemRoute', 'createPublicItemMetadata'],
  [`${INTERNAL}public-archive-route`]: ['createPublicArchiveRoute', 'createPublicArchiveMetadata'],
  [`${INTERNAL}billing-webhooks`]: ['createStripeWebhookRoute', 'createPolarWebhookRoute'],
  [DEV_STATUS_SPECIFIER]: [DEV_STATUS_WRAPPER],
})

/** The callees that take the array of child entity names as their second argument. */
const CHILD_NAMES_CALLEES = new Set(['createEntityDetailRoute'])

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === kind))
}

/**
 * Violations of `grammar` in a parsed generated module.
 * @returns {{ kind: string, line: number, text: string }[]}
 */
export function validateGeneratedSourceFile(sourceFile, ts, grammar, wrappers = CORE_COMPOSITION_WRAPPERS) {
  if (!GRAMMARS.includes(grammar)) throw new Error(`Unknown generated-module grammar "${grammar}"`)
  const facade = grammar !== 'registry'
  const composing = grammar === 'composed-facade' || grammar === 'dev-facade'
  const K = ts.SyntaxKind
  const violations = []
  const report = (kind, node, detail) =>
    violations.push({
      kind,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      text: `${detail ? `${detail}: ` : ''}${node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 120)}`,
    })

  // Pass 1: imports (they may appear anywhere at top level; their names are what exports and
  // registry leaves may reference).
  const imported = new Set()
  // local name -> where a named import comes from (a composition callee must be an allowlisted wrapper)
  const importedFrom = new Map()
  const defaultImports = new Set()
  const devWrappers = new Set()
  let composed = 0
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const clause = statement.importClause
    if (!clause) {
      // Only a fixed stylesheet: `import '@/styles/globals.css'`.
      if (!(facade && ts.isStringLiteral(statement.moduleSpecifier) && /\.css$/.test(statement.moduleSpecifier.text))) report('side-effect-import', statement)
      continue
    }
    if (clause.namedBindings && !ts.isNamedImports(clause.namedBindings)) {
      report('namespace-import', statement)
      continue
    }
    if (clause.isTypeOnly) continue
    if (clause.name) {
      imported.add(clause.name.text)
      defaultImports.add(clause.name.text)
    }
    if (statement.moduleSpecifier.text === DEV_STATUS_SPECIFIER) {
      for (const element of clause.namedBindings?.elements ?? []) {
        if (!element.isTypeOnly && (element.propertyName ?? element.name).text === DEV_STATUS_WRAPPER) devWrappers.add(element.name.text)
      }
    }
    for (const element of clause.namedBindings?.elements ?? []) {
      if (element.isTypeOnly) continue
      imported.add(element.name.text)
      importedFrom.set(element.name.text, { specifier: statement.moduleSpecifier.text, name: (element.propertyName ?? element.name).text })
    }
  }

  let prologue = true
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && prologue) {
      if (!facade || !ALLOWED_DIRECTIVES.has(statement.expression.text)) report('directive', statement, 'directive not allowed')
      continue
    }
    prologue = false

    if (ts.isImportDeclaration(statement)) continue

    // composed-facade: `export default wrapper(...)`, once; dev-facade: once, outermost `withGenerationStatus`.
    if (ts.isExportAssignment(statement) && !statement.isExportEquals && composing) {
      composed += 1
      const problem = compositionProblem(statement.expression, ts, imported, importedFrom, wrappers)
      if (composed > 1) report('composition', statement, 'only one composed `export default`')
      else if (problem) report('composition', statement, problem)
      else if (grammar === 'dev-facade') {
        // `withGenerationStatus(<default import | composition>)`, nothing else.
        const call = statement.expression
        const [argument] = call.arguments
        const ok =
          ts.isIdentifier(call.expression) &&
          devWrappers.has(call.expression.text) &&
          call.arguments.length === 1 &&
          (ts.isCallExpression(argument) || (ts.isIdentifier(argument) && defaultImports.has(argument.text)))
        if (!ok) report('composition', statement, `only \`export default ${DEV_STATUS_WRAPPER}(<default import or composition>)\``)
      }
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        report('export-star', statement)
        continue
      }
      if (statement.moduleSpecifier) {
        if (!facade) report('re-export', statement, 'registries do not re-export')
        continue
      }
      if (statement.isTypeOnly) continue
      for (const element of statement.exportClause.elements) {
        const local = (element.propertyName ?? element.name).text
        if (!element.isTypeOnly && !imported.has(local)) report('export-of-local', element, `"${local}" is not an imported name`)
      }
      continue
    }

    if (ts.isVariableStatement(statement)) {
      const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      if (!hasModifier(statement, K.ExportKeyword) || !isConst || statement.modifiers.length !== 1) {
        report('declaration', statement, 'only `export const` declarations are allowed')
        continue
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer || declaration.type) {
          report('declaration', declaration, 'expected `export const name = value`')
          continue
        }
        if (facade) {
          const literal = evaluateNextLiteral(declaration.initializer, ts)
          if ('unsupported' in literal) {
            // `export const POST = wrapper(...)`: a composition instead of a literal (composed-facade only).
            const problem = grammar === 'composed-facade' && ts.isCallExpression(declaration.initializer) ? compositionProblem(declaration.initializer, ts, imported, importedFrom, wrappers) : null
            if (grammar !== 'composed-facade' || !ts.isCallExpression(declaration.initializer)) report('non-literal', declaration.initializer, literal.unsupported)
            else if (problem) report('composition', declaration.initializer, problem)
          }
        } else {
          validateRegistryValue(declaration.initializer, ts, imported, report, true)
        }
      }
      continue
    }

    report('statement', statement, `${K[statement.kind]} is not allowed in a generated ${grammar}`)
  }
  return violations
}


/**
 * Why `node` is not a composition (`wrapper(arg, ...)` where `wrapper` is an allowlisted core wrapper imported from the exact
 * specifier that exports it, and each argument an imported name or a nested composition), or null when it is one.
 */
function compositionProblem(node, ts, imported, importedFrom, wrappers) {
  if (!ts.isCallExpression(node)) return 'expected a call of a core composition wrapper'
  if (node.typeArguments || node.questionDotToken) return 'no type arguments or optional calls'
  if (!ts.isIdentifier(node.expression) || !imported.has(node.expression.text)) return 'the callee must be a name imported in this file'
  const origin = importedFrom.get(node.expression.text)
  if (!origin || !wrappers[origin.specifier]?.includes(origin.name)) {
    return `"${node.expression.text}" is not a core composition wrapper (allowed: the wrappers of CORE_COMPOSITION_WRAPPERS, imported from the module that exports them)`
  }
  const callee = origin.name
  for (const [index, argument] of node.arguments.entries()) {
    if (ts.isIdentifier(argument)) {
      if (!imported.has(argument.text)) return `"${argument.text}" is not an imported name`
    } else if (ts.isArrayLiteralExpression(argument) && index === 1 && CHILD_NAMES_CALLEES.has(callee)) {
      if (!argument.elements.every(element => ts.isStringLiteral(element))) return 'the child entity names are string literals'
    } else if (ts.isCallExpression(argument)) {
      const nested = compositionProblem(argument, ts, imported, importedFrom, wrappers)
      if (nested) return nested
    } else {
      return 'arguments are imported names or nested compositions (only createEntityDetailRoute takes a second argument that is an array of child entity names)'
    }
  }
  return null
}

/** A registry value: object/array literals whose leaves are literals or imported identifiers. */
function validateRegistryValue(node, ts, imported, report, root = false) {
  const K = ts.SyntaxKind
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return validateRegistryValue(node.expression, ts, imported, report, root)
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name) && !ts.isNumericLiteral(property.name)) {
          report('computed-key', property)
          continue
        }
        validateRegistryValue(property.initializer, ts, imported, report)
      } else if (ts.isShorthandPropertyAssignment(property)) {
        if (!imported.has(property.name.text) || property.objectAssignmentInitializer) report('shorthand', property, 'shorthand of a name that is not imported')
      } else {
        report('property', property, `${K[property.kind]} is not allowed in a registry`)
      }
    }
    return
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) report('array-element', element.kind === K.OmittedExpression ? node : element)
      else validateRegistryValue(element, ts, imported, report)
    }
    return
  }
  if (root) {
    report('registry-value', node, 'a registry export must be an object or array literal')
    return
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node) ||
      node.kind === K.TrueKeyword || node.kind === K.FalseKeyword || node.kind === K.NullKeyword) return
  if (ts.isIdentifier(node) && imported.has(node.text)) return
  report('registry-leaf', node, 'registry leaves must be literals or imported identifiers')
}

/**
 * Parse `source` (TS/TSX/JS by its file name) and validate it against `grammar`. A file that
 * does not parse is itself a violation.
 */
export function validateGeneratedModule({ ts, source, file, grammar, wrappers }) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  const [parseError] = sourceFile.parseDiagnostics ?? []
  if (parseError) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(parseError.start ?? 0)
    return [{ kind: 'parse-error', line: line + 1, text: ts.flattenDiagnosticMessageText(parseError.messageText, ' ') }]
  }
  return validateGeneratedSourceFile(sourceFile, ts, grammar, wrappers)
}

/** `validateGeneratedModule` with the registry build's TypeScript compiler. */
export async function checkGeneratedModule({ source, file, grammar, projectRoot = process.cwd(), wrappers }) {
  return validateGeneratedModule({ ts: await loadTypeScriptFor(projectRoot), source, file, grammar, wrappers })
}
