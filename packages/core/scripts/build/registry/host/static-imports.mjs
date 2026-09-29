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
 * Grammar `dev-facade` (the root layout of a `nextspark dev` generation, render.mjs): the `facade`
 * grammar plus exactly one `export default withGenerationStatus(Source)`, where
 * `withGenerationStatus` is imported from './_nextspark/generation-status' and `Source` is a
 * default import - a fixed composition of two fixed modules, never emitted by a production
 * preparation.
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

export const GRAMMARS = ['facade', 'dev-facade', 'registry']

/** The module the `dev-facade` grammar's composition imports its wrapper from. */
export const DEV_STATUS_SPECIFIER = './_nextspark/generation-status'
/** The wrapper a dev root layout composes with. */
export const DEV_STATUS_WRAPPER = 'withGenerationStatus'

const ALLOWED_DIRECTIVES = new Set(['use client'])

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === kind))
}

/**
 * Violations of `grammar` in a parsed generated module.
 * @returns {{ kind: string, line: number, text: string }[]}
 */
export function validateGeneratedSourceFile(sourceFile, ts, grammar) {
  if (!GRAMMARS.includes(grammar)) throw new Error(`Unknown generated-module grammar "${grammar}"`)
  const facade = grammar === 'facade' || grammar === 'dev-facade'
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
  const defaultImports = new Set()
  const devWrappers = new Set()
  let composed = 0
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const clause = statement.importClause
    if (!clause) {
      report('side-effect-import', statement)
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
      if (!element.isTypeOnly) imported.add(element.name.text)
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

    // dev-facade: `export default withGenerationStatus(Source)`, once.
    if (grammar === 'dev-facade' && ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const call = statement.expression
      const ok =
        ts.isCallExpression(call) &&
        !call.typeArguments &&
        ts.isIdentifier(call.expression) &&
        devWrappers.has(call.expression.text) &&
        call.arguments.length === 1 &&
        ts.isIdentifier(call.arguments[0]) &&
        defaultImports.has(call.arguments[0].text) &&
        composed === 0
      composed += 1
      if (!ok) report('composition', statement, `only \`export default ${DEV_STATUS_WRAPPER}(<default import>)\` once`)
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
          if ('unsupported' in literal) report('non-literal', declaration.initializer, literal.unsupported)
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
export function validateGeneratedModule({ ts, source, file, grammar }) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  const [parseError] = sourceFile.parseDiagnostics ?? []
  if (parseError) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(parseError.start ?? 0)
    return [{ kind: 'parse-error', line: line + 1, text: ts.flattenDiagnosticMessageText(parseError.messageText, ' ') }]
  }
  return validateGeneratedSourceFile(sourceFile, ts, grammar)
}

/** `validateGeneratedModule` with the registry build's TypeScript compiler. */
export async function checkGeneratedModule({ source, file, grammar, projectRoot = process.cwd() }) {
  return validateGeneratedModule({ ts: await loadTypeScriptFor(projectRoot), source, file, grammar })
}
