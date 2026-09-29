/**
 * Literal evaluation for route segment config, mirroring
 * next/dist/build/analysis/extract-const-value.js on the TypeScript AST.
 * Shared by the facade emitter and the generated-module gate (static-imports.mjs).
 *
 * @module core/scripts/build/registry/host/next-literal
 */

/**
 * Evaluate an initializer the way Next.js's `extractExportedConstValue` does,
 * on the TypeScript AST instead of SWC's. Accepting exactly what Next.js
 * accepts matters twice: the emitter must not copy a value Next.js would
 * ignore in a hand-written route file, and must not reject one it reads.
 * Notably Next.js does NOT read negative numbers (a unary expression) or
 * parenthesized values.
 *
 * @returns {{ value: unknown } | { unsupported: string }}
 */
export function evaluateNextLiteral(node, ts) {
  const K = ts.SyntaxKind
  switch (node.kind) {
    case K.NullKeyword:
      return { value: null }
    case K.TrueKeyword:
      return { value: true }
    case K.FalseKeyword:
      return { value: false }
    case K.StringLiteral:
    case K.NoSubstitutionTemplateLiteral:
      return { value: node.text }
    case K.NumericLiteral:
      return { value: Number(node.text.replace(/_/g, '')) }
    case K.RegularExpressionLiteral: {
      const lastSlash = node.text.lastIndexOf('/')
      return { value: new RegExp(node.text.slice(1, lastSlash), node.text.slice(lastSlash + 1)) }
    }
    case K.Identifier:
      return node.text === 'undefined' ? { value: undefined } : { unsupported: `Unknown identifier "${node.text}"` }
    case K.ArrayLiteralExpression: {
      const values = []
      for (const element of node.elements) {
        if (element.kind === K.OmittedExpression) {
          values.push(undefined)
          continue
        }
        if (element.kind === K.SpreadElement) return { unsupported: 'Unsupported spread operator in the Array Expression' }
        const item = evaluateNextLiteral(element, ts)
        if ('unsupported' in item) return item
        values.push(item.value)
      }
      return { value: values }
    }
    case K.ObjectLiteralExpression: {
      const object = {}
      for (const property of node.properties) {
        if (property.kind !== K.PropertyAssignment) {
          return { unsupported: 'Unsupported spread operator, shorthand or method in the Object Expression' }
        }
        if (property.name.kind !== K.Identifier && property.name.kind !== K.StringLiteral) {
          return { unsupported: 'Unsupported key type in the Object Expression' }
        }
        const item = evaluateNextLiteral(property.initializer, ts)
        if ('unsupported' in item) return item
        object[property.name.text] = item.value
      }
      return { value: object }
    }
    case K.AsExpression:
    case K.SatisfiesExpression:
    case K.TypeAssertionExpression:
      return evaluateNextLiteral(node.expression, ts)
    default:
      return { unsupported: `Unsupported node type "${K[node.kind]}"` }
  }
}

/** Render a value produced by `evaluateNextLiteral` back as source. */
export function renderLiteral(value) {
  if (value === undefined) return 'undefined'
  if (value instanceof RegExp) return String(value)
  if (Array.isArray(value)) return `[${value.map(renderLiteral).join(', ')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${renderLiteral(item)}`)
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`
  }
  return JSON.stringify(value)
}
