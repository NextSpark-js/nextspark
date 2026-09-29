import { createHash } from 'node:crypto'

/**
 * Client-JS comparison for the generated-host conformance check (#203).
 *
 * The manual and generated hosts compile the same source modules, so their client chunks must
 * be the same code and the same module graph. Module ids differ legitimately (they are derived
 * from module paths, which differ between the hosts), so ids are never compared as numbers and
 * never erased either: every module gets an identity-preserving canonical label
 * (`labelModules`), computed from its own body with each module id it references replaced by the
 * label of the module it points to, iterated to a fixpoint over the whole host's module table.
 * The same graph under other numeric ids gets the same labels; pointing a `require(id)`, an entry
 * (`require.s = id`, Turbopack `runtimeModuleIds`) or a client reference at another module
 * changes them.
 *
 * Module ids are recognized only in module-system positions of the bundlers' top-level chunk
 * registrations, and only when their object is lexically the factory's module-system parameter:
 *   - webpack module factory `(module, exports, require) =>`: `require(id)`,
 *     `require.bind(require, id)`, and the factory's numeric key;
 *   - webpack chunk entry callback `require =>`: `require(id)`, `require.s = id`;
 *   - Turbopack factory `context =>`: `context.r(id)`, `context.i(id)`, `context.s([...], id)`,
 *     and the factory's numeric array slot;
 *   - Turbopack runtime registration `{ runtimeModuleIds: [id, ...] }`.
 *
 * Facade artifacts are an enumerated set of shapes:
 *   - `webpack-esm-marker`: `require.r(exports)` (+ its comma) in a webpack module factory;
 *   - `turbopack-reexport`: `context.s([],N),context.i(N),` in a Turbopack factory, together
 *     with that factory's group argument `,F` of `context.s([...],F)`.
 * The caller compares the artifacts of both hosts against a fixed expected list; only artifacts
 * on that list are cut before labeling and comparing. Anything else stays a difference.
 */

const isFunction = (node, ts) => ts.isArrowFunction(node) || ts.isFunctionExpression(node)

const unwrapParens = (node, ts) => {
  while (ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function leftmost(node, ts) {
  while (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) node = node.left
  return node
}

/**
 * The bundler whose top-level chunk registration `array` is, or null. Only these two containers,
 * as Next.js 16.3.5 emits them, register modules:
 *   webpack:   (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([[chunkIds], { id: factory }, entry?])
 *   Turbopack: (globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([script, id, factory, ...])
 * and only as a statement directly in the chunk's source file.
 */
export function chunkContainer(array, ts) {
  if (!array || !ts.isArrayLiteralExpression(array)) return null
  const call = array.parent
  if (!call || !ts.isCallExpression(call) || call.arguments.length !== 1 || call.arguments[0] !== array) return null
  if (!ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'push') return null
  // The call is the statement, or the leftmost operand of a top-level comma sequence
  // (Turbopack's runtime chunk: `(...).push([script, { runtimeModuleIds }]), (() => { ... })()`).
  let statement = call.parent
  while (statement && ts.isBinaryExpression(statement) && statement.operatorToken.kind === ts.SyntaxKind.CommaToken && leftmost(statement, ts) === call) {
    statement = statement.parent
  }
  if (!statement || !ts.isExpressionStatement(statement) || !ts.isSourceFile(statement.parent) || leftmost(statement.expression, ts) !== call) return null
  const target = unwrapParens(call.expression.expression, ts)
  if (!ts.isBinaryExpression(target)) return null
  const globalProperty = (node, name) =>
    ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && ['self', 'globalThis'].includes(node.expression.text) &&
    (typeof name === 'string' ? node.name.text === name : name.test(node.name.text))
  // webpack: X.webpackChunk_* = X.webpackChunk_* || []
  if (target.operatorToken.kind === ts.SyntaxKind.EqualsToken && globalProperty(target.left, /^webpackChunk/)) {
    return ts.isObjectLiteralExpression(array.elements[1] ?? {}) && ts.isArrayLiteralExpression(array.elements[0] ?? {}) ? 'webpack' : null
  }
  // Turbopack: globalThis.TURBOPACK || (globalThis.TURBOPACK = [])
  if (target.operatorToken.kind === ts.SyntaxKind.BarBarToken && globalProperty(target.left, 'TURBOPACK')) return 'turbopack'
  return null
}

/**
 * Classify a function node as a module factory: `{ kind, node, id, ... }` naming its
 * module-system parameters, or null. A function is a factory only in its exact slot of a
 * top-level chunk registration (`chunkContainer`); the same shape anywhere else - a lookup table
 * or an `[id, fn]` pair inside application code - is application code.
 */
export function factoryOf(fn, ts) {
  if (!isFunction(fn, ts)) return null
  const paramName = index => {
    const param = fn.parameters[index]
    return param && ts.isIdentifier(param.name) ? param.name.text : null
  }
  const parent = fn.parent
  // webpack module: the value of a numeric key of the container's module map (element 1).
  if (ts.isPropertyAssignment(parent) && parent.initializer === fn && ts.isNumericLiteral(parent.name)) {
    const map = parent.parent
    const array = map?.parent
    if (ts.isObjectLiteralExpression(map) && array && ts.isArrayLiteralExpression(array) && array.elements[1] === map && chunkContainer(array, ts) === 'webpack') {
      return { kind: 'webpack-module', node: fn, id: Number(parent.name.text), require: paramName(2), exports: paramName(1) }
    }
    return null
  }
  if (!ts.isArrayLiteralExpression(parent)) return null
  const container = chunkContainer(parent, ts)
  const index = parent.elements.indexOf(fn)
  // webpack entry callback: element 2 of the registration.
  if (container === 'webpack' && index === 2) return { kind: 'webpack-entry', node: fn, id: null, require: paramName(0) }
  // Turbopack module: [script, id, factory, id, factory, ...] - factories at even indexes >= 2.
  const previous = parent.elements[index - 1]
  if (container === 'turbopack' && index >= 2 && index % 2 === 0 && previous && ts.isNumericLiteral(previous)) {
    return { kind: 'turbopack-module', node: fn, id: Number(previous.text), context: paramName(0) }
  }
  return null
}

// --- lexical scope ---------------------------------------------------------

function bindingNames(name, ts, into = new Set()) {
  if (ts.isIdentifier(name)) into.add(name.text)
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindingNames(element.name, ts, into)
  }
  return into
}

/** `var` and function declarations of a function body, not crossing nested functions. */
function varScopedNames(body, ts) {
  const names = new Set()
  const visit = node => {
    if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node))) {
      if (ts.isFunctionDeclaration(node) && node.name) names.add(node.name.text)
      return
    }
    if (ts.isVariableDeclarationList(node) && !(node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
      for (const declaration of node.declarations) bindingNames(declaration.name, ts, names)
    }
    ts.forEachChild(node, visit)
  }
  if (body) visit(body)
  return names
}

/** Names a node declares for the code nested inside it (block-scoped or function-scoped). */
function declaredBy(node, ts) {
  const names = new Set()
  if (ts.isFunctionLike(node)) {
    for (const param of node.parameters ?? []) bindingNames(param.name, ts, names)
    if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.name) names.add(node.name.text)
    for (const name of varScopedNames(node.body, ts)) names.add(name)
  } else if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node)) {
    const statements = ts.isCaseBlock(node) ? node.clauses.flatMap(clause => clause.statements) : node.statements
    for (const statement of statements) {
      if (ts.isVariableStatement(statement) && statement.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) {
        for (const declaration of statement.declarationList.declarations) bindingNames(declaration.name, ts, names)
      } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
        names.add(statement.name.text)
      }
    }
  } else if (ts.isCatchClause(node) && node.variableDeclaration) {
    bindingNames(node.variableDeclaration.name, ts, names)
  } else if ((ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) && node.initializer && ts.isVariableDeclarationList(node.initializer)) {
    for (const declaration of node.initializer.declarations) bindingNames(declaration.name, ts, names)
  } else if (ts.isClassExpression(node) && node.name) {
    names.add(node.name.text)
  }
  return names
}

/**
 * The factory whose parameter `identifier` refers to, or null: walks outward and stops at the
 * first scope that declares the name. A shadowed name (`n => n.slice(1)` inside a factory whose
 * require is `n`) resolves to the inner binding and is not a module-system reference.
 */
export function resolveFactoryParameter(identifier, ts) {
  const name = identifier.text
  for (let scope = identifier.parent; scope; scope = scope.parent) {
    const factory = isFunction(scope, ts) ? factoryOf(scope, ts) : null
    if (factory) {
      const params = new Set()
      for (const param of scope.parameters) bindingNames(param.name, ts, params)
      if (params.has(name)) {
        // `var n` / `function n` inside the factory body rebinds the parameter: not trusted.
        return varScopedNames(scope.body, ts).has(name) ? null : { factory, name }
      }
    }
    if (declaredBy(scope, ts).has(name)) return null
  }
  return null
}

function isParam(expression, role, ts) {
  if (!ts.isIdentifier(expression)) return null
  const resolved = resolveFactoryParameter(expression, ts)
  return resolved && resolved.factory[role] === resolved.name ? resolved.factory : null
}

/** Whether a numeric literal is an entry of Turbopack's `runtimeModuleIds` registration. */
function isRuntimeModuleId(literal, ts) {
  const list = literal.parent
  const property = list?.parent
  const object = property?.parent
  const array = object?.parent
  return Boolean(
    list && ts.isArrayLiteralExpression(list) && property && ts.isPropertyAssignment(property) && property.initializer === list &&
      ts.isIdentifier(property.name) && property.name.text === 'runtimeModuleIds' && object && ts.isObjectLiteralExpression(object) &&
      array && ts.isArrayLiteralExpression(array) && array.elements[1] === object && chunkContainer(array, ts) === 'turbopack'
  )
}

/** Whether a numeric literal is a module id in an enumerated module-system position. */
function isModuleIdPosition(literal, ts) {
  if (isRuntimeModuleId(literal, ts)) return true
  const parent = literal.parent
  if (ts.isPropertyAssignment(parent) && parent.name === literal) return Boolean(factoryOf(parent.initializer, ts))
  if (ts.isArrayLiteralExpression(parent)) {
    const next = parent.elements[parent.elements.indexOf(literal) + 1]
    return Boolean(next && factoryOf(next, ts)?.kind === 'turbopack-module')
  }
  if (ts.isCallExpression(parent)) {
    const index = parent.arguments.indexOf(literal)
    const callee = parent.expression
    // require(id)
    if (index === 0 && ts.isIdentifier(callee)) return Boolean(isParam(callee, 'require', ts))
    if (!ts.isPropertyAccessExpression(callee)) return false
    const method = callee.name.text
    // require.bind(require, id)
    if (method === 'bind' && index === 1 && parent.arguments.length === 2 && isParam(callee.expression, 'require', ts) &&
        ts.isIdentifier(parent.arguments[0]) && parent.arguments[0].text === callee.expression.text) return true
    // context.r(id) / context.i(id) / context.s([...], id)
    const factory = isParam(callee.expression, 'context', ts)
    if (!factory) return false
    return ((method === 'r' || method === 'i') && index === 0 && parent.arguments.length === 1) ||
      (method === 's' && index === 1 && parent.arguments.length === 2 && ts.isArrayLiteralExpression(parent.arguments[0]))
  }
  // require.s = id (webpack entry callback)
  if (ts.isBinaryExpression(parent) && parent.right === literal && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(parent.left) && parent.left.name.text === 's') {
    const factory = isParam(parent.left.expression, 'require', ts)
    return factory?.kind === 'webpack-entry'
  }
  return false
}

// --- artifacts --------------------------------------------------------------

function flattenComma(node, ts, items = []) {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    flattenComma(node.left, ts, items)
    flattenComma(node.right, ts, items)
  } else items.push(node)
  return items
}

const isCallOf = (node, method, ts) =>
  ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === method

const bytes = text => Buffer.byteLength(text, 'utf8')

/**
 * Scan one chunk: module-id tokens and facade artifacts.
 * @returns {{ bytes: number, idTokens: {start:number,end:number,digits:number}[], artifacts: object[], factoryIds: number[] }}
 */
export function scanChunk({ text, ts, file = 'chunk.js' }) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const idTokens = []
  const artifacts = []
  const factoryIds = []
  // Every module factory of the registrations: its id and the [start, end) range of its body.
  const modules = []
  // Module entries of each top-level registration, as [start, end) ranges: a module map's order
  // follows the ids, so the canonical form sorts them (see canonicalText).
  const moduleGroups = []
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement)) continue
    const call = leftmost(statement.expression, ts)
    if (!ts.isCallExpression(call)) continue
    const array = call.arguments[0]
    const container = chunkContainer(array, ts)
    if (container === 'webpack') {
      moduleGroups.push(array.elements[1].properties.map(property => [property.getStart(sourceFile), property.getEnd()]))
    } else if (container === 'turbopack') {
      const pairs = []
      for (let index = 1; index + 1 < array.elements.length; index += 2) {
        pairs.push([array.elements[index].getStart(sourceFile), array.elements[index + 1].getEnd()])
      }
      moduleGroups.push(pairs)
    }
  }
  const spanAfter = (items, index, node) => [node.getStart(sourceFile), items[index + 1] ? items[index + 1].getStart(sourceFile) : node.getEnd()]

  const visit = node => {
    if (isFunction(node, ts)) {
      const factory = factoryOf(node, ts)
      if (factory?.id !== null && factory?.id !== undefined) {
        factoryIds.push(factory.id)
        modules.push({ id: factory.id, start: node.getStart(sourceFile), end: node.getEnd() })
      }
    }
    if (ts.isNumericLiteral(node) && isModuleIdPosition(node, ts)) {
      // A declaration is the factory's own key/slot; everything else references a module.
      const parent = node.parent
      const declaration = (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isArrayLiteralExpression(parent) && !isRuntimeModuleId(node, ts))
      idTokens.push({ start: node.getStart(sourceFile), end: node.getEnd(), digits: bytes(node.text), value: Number(node.text), role: declaration ? 'declaration' : 'reference' })
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken &&
        !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.CommaToken)) {
      const items = flattenComma(node, ts)
      items.forEach((item, index) => {
        // webpack: require.r(exports),
        if (isCallOf(item, 'r', ts) && item.arguments.length === 1) {
          const factory = isParam(item.expression.expression, 'require', ts)
          if (factory?.kind === 'webpack-module' && isParam(item.arguments[0], 'exports', ts)?.node === factory.node) {
            const [start, end] = spanAfter(items, index, item)
            artifacts.push({ type: 'webpack-esm-marker', factoryId: factory.id, spans: [[start, end]], text: text.slice(start, end) })
          }
        }
        // Turbopack: context.s([],N),context.i(N),
        const next = items[index + 1]
        if (isCallOf(item, 's', ts) && item.arguments.length === 2 && ts.isArrayLiteralExpression(item.arguments[0]) &&
            item.arguments[0].elements.length === 0 && ts.isNumericLiteral(item.arguments[1]) && next && isCallOf(next, 'i', ts) &&
            next.arguments.length === 1 && ts.isNumericLiteral(next.arguments[0]) && next.arguments[0].text === item.arguments[1].text) {
          const factory = isParam(item.expression.expression, 'context', ts)
          if (factory?.kind === 'turbopack-module' && isParam(next.expression.expression, 'context', ts)?.node === factory.node) {
            const start = item.getStart(sourceFile)
            const end = items[index + 2] ? items[index + 2].getStart(sourceFile) : next.getEnd()
            artifacts.push({ type: 'turbopack-reexport', factoryId: factory.id, spans: [[start, end]], text: text.slice(start, end), group: null })
          }
        }
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  // The group argument `,F` of `context.s([...],F)` belongs to a factory's re-export artifact.
  const attachGroup = node => {
    if (isCallOf(node, 's', ts) && node.arguments.length === 2 && ts.isArrayLiteralExpression(node.arguments[0]) &&
        node.arguments[0].elements.length > 0 && ts.isNumericLiteral(node.arguments[1])) {
      const factory = isParam(node.expression.expression, 'context', ts)
      const artifact = factory && artifacts.find(a => a.type === 'turbopack-reexport' && a.factoryId === factory.id && !a.group)
      if (artifact && Number(node.arguments[1].text) === factory.id) {
        const span = [node.arguments[0].getEnd(), node.arguments[1].getEnd()]
        artifact.group = text.slice(...span)
        artifact.spans.push(span)
      }
    }
    ts.forEachChild(node, attachGroup)
  }
  attachGroup(sourceFile)

  for (const artifact of artifacts) {
    artifact.bytes = artifact.spans.reduce((sum, [start, end]) => sum + bytes(text.slice(start, end)), 0)
    // The exact expected shape, ids aside.
    artifact.shape =
      artifact.type === 'webpack-esm-marker'
        ? artifact.text.replace(/\s+/g, '')
        : `${artifact.text.replace(/\d+/g, '#')}${artifact.group ? artifact.group.replace(/\d+/g, '#') : ''}`
  }
  return { bytes: bytes(text), idTokens, artifacts, factoryIds, moduleGroups, modules }
}

const hash = value => createHash('sha1').update(value).digest('hex').slice(0, 16)

/** Replace id tokens and cut removed spans in `text` (positions relative to `text`). */
function rewrite(text, idTokens, removedSpans, replace) {
  const inside = position => removedSpans.some(([start, end]) => position >= start && position < end)
  const edits = [
    ...removedSpans.map(([start, end]) => ({ start, end, replacement: '' })),
    ...idTokens.filter(token => !inside(token.start)).map(token => ({ start: token.start, end: token.end, replacement: replace(token) })),
  ].sort((a, b) => a.start - b.start)
  let output = ''
  let cursor = 0
  for (const { start, end, replacement } of edits) {
    output += text.slice(cursor, start) + replacement
    cursor = end
  }
  return output + text.slice(cursor)
}

/**
 * Identity-preserving canonical labels for every module of one host.
 *
 * `chunks`: `{ scan, text }[]` - every client chunk the host emitted, so the table is complete.
 * `remove`: selects the artifacts to cut (the expected ones for this host) before labeling.
 *
 * label_0(m) is the hash of m's body with every module id it references replaced by `#`;
 * label_k+1(m) hashes label_k(m) with m's body where each reference is replaced by
 * label_k(target), or `external:<id>` when the target is not in the table. Including the previous
 * label makes each round a refinement, so the iteration stops as soon as a round creates no new
 * distinct label (at most one round per module). Isomorphic graphs stop at the same round with
 * the same labels, whatever their numeric ids.
 * @returns {{ labels: Map<number, string>, externals: number[], rounds: number }}
 */
export function labelModules(chunks, remove = () => false) {
  // One template per module occurrence: literal segments and the ids referenced between them.
  const templates = new Map()
  for (const { scan, text } of chunks) {
    const removedSpans = scan.artifacts.filter(remove).flatMap(artifact => artifact.spans)
    for (const module of scan.modules) {
      const inRange = ([start, end]) => start >= module.start && end <= module.end
      const spans = removedSpans.filter(inRange).map(([start, end]) => [start - module.start, end - module.start])
      const tokens = scan.idTokens
        .filter(token => token.role === 'reference' && token.start >= module.start && token.end <= module.end)
        .map(token => ({ ...token, start: token.start - module.start, end: token.end - module.start }))
      const body = text.slice(module.start, module.end)
      const parts = []
      const refs = []
      rewrite(body, tokens, spans, token => {
        refs.push(token.value)
        return '\u0000'
      }).split('\u0000').forEach(part => parts.push(part))
      const list = templates.get(module.id) ?? []
      list.push({ parts, refs })
      templates.set(module.id, list)
    }
  }
  const externals = new Set()
  const render = (template, labelOf) => template.parts.map((part, index) => (index === 0 ? part : `${labelOf(template.refs[index - 1])}${part}`)).join('')
  const ids = [...templates.keys()]
  let labels = new Map(ids.map(id => [id, hash(`0|${[...new Set(templates.get(id).map(t => render(t, () => '#')))].sort().join('\u0001')}`)]))
  let distinct = new Set(labels.values()).size
  let rounds = 1
  for (; rounds <= ids.length; rounds += 1) {
    const labelOf = id => {
      if (labels.has(id)) return labels.get(id)
      externals.add(id)
      return `external:${id}`
    }
    const next = new Map(ids.map(id => [id, hash(`${labels.get(id)}|${[...new Set(templates.get(id).map(t => render(t, labelOf)))].sort().join('\u0001')}`)]))
    const nextDistinct = new Set(next.values()).size
    labels = next
    if (nextDistinct === distinct) break
    distinct = nextDistinct
  }
  return { labels, externals: [...externals].sort((a, b) => a - b), rounds }
}

const labelFor = labels => token => labels.get(token.value) ?? `external:${token.value}`

/**
 * Normalized text of a scanned chunk: the spans of the artifacts `remove` selects are cut, and
 * every module id in a module-system position is replaced by the canonical label of the module it
 * declares or references. `labels` comes from `labelModules` over the whole host; without it, the
 * chunk is labeled on its own.
 */
export function normalizedText(scan, text, remove = () => false, labels = labelModules([{ scan, text }], remove).labels) {
  const removedSpans = scan.artifacts.filter(remove).flatMap(artifact => artifact.spans)
  return rewrite(text, scan.idTokens, removedSpans, labelFor(labels))
}

/**
 * Canonical text of a scanned chunk: `normalizedText`, with the module entries of each top-level
 * registration sorted by their normalized text (a module map's order follows the numeric ids).
 */
export function canonicalText(scan, text, remove = () => false, labels = labelModules([{ scan, text }], remove).labels) {
  const normalize = (start, end) => normalizedText(sliceScan(scan, start, end), text.slice(start, end), remove, labels)
  let output = ''
  let cursor = 0
  for (const group of scan.moduleGroups) {
    if (group.length === 0) continue
    output += normalize(cursor, group[0][0])
    output += group.map(([start, end]) => normalize(start, end)).sort().join(',')
    cursor = group.at(-1)[1]
  }
  return output + normalize(cursor, text.length)
}

/** The part of a scan that falls in [start, end), with positions made relative to `start`. */
function sliceScan(scan, start, end) {
  const within = ([a]) => a >= start && a < end
  return {
    idTokens: scan.idTokens.filter(token => token.start >= start && token.start < end).map(token => ({ ...token, start: token.start - start, end: token.end - start })),
    artifacts: scan.artifacts
      .filter(artifact => artifact.spans.every(within))
      .map(artifact => ({ ...artifact, spans: artifact.spans.map(([a, b]) => [a - start, b - start]) })),
  }
}

/** Byte size of `normalizedText`. */
export function normalizedBytes(scan, text, remove = () => false, labels) {
  return bytes(normalizedText(scan, text, remove, labels ?? labelModules([{ scan, text }], remove).labels))
}

/**
 * Compare the facade artifacts found in both hosts against the fixed expected list.
 *
 * `expected`: `{ key, host, shape, count }[]` - `key` is `<type>@<module identity>`, `shape` the
 * exact artifact text with module ids as `#`, `count` the exact number of occurrences in `host`.
 * `manual` / `generated`: `{ artifacts: { [key]: { count, shapes, bytes } } }`.
 *
 * An expected artifact must occur in its host exactly `count` times, every time with exactly
 * `shape`, and never in the other host. Every other artifact must be identical in both hosts:
 * same module, same count, same shapes. Nothing is inferred from the output being judged.
 * @returns {{ key: string, equal: boolean, note: string, manual: object, generated: object }[]}
 */
export function compareArtifacts({ expected, manual, generated }) {
  const none = { count: 0, shapes: [], bytes: [] }
  const byKey = new Map(expected.map(item => [item.key, item]))
  const results = []
  for (const key of new Set([...Object.keys(manual.artifacts), ...Object.keys(generated.artifacts), ...byKey.keys()])) {
    const a = manual.artifacts[key] ?? none
    const b = generated.artifacts[key] ?? none
    const item = byKey.get(key)
    let equal
    let note
    if (item) {
      const [present, absent] = item.host === 'manual' ? [a, b] : [b, a]
      equal = present.count === item.count && absent.count === 0 && present.shapes.every(shape => shape === item.shape)
      note = `expected exactly ${item.count} × ${item.shape} in ${item.host} only`
    } else {
      equal = a.count === b.count && JSON.stringify([...a.shapes].sort()) === JSON.stringify([...b.shapes].sort())
      note = 'not on the expected list: must be identical in both hosts'
    }
    results.push({ key, equal, note, manual: a, generated: b })
  }
  return results
}

/**
 * CSS is compared by content, never by file name or count: the sorted multiset of content digests
 * of `files` (a trailing sourceMappingURL comment is the only thing stripped). `read(file)`
 * returns the content, or null for a file that does not exist (reported as `missing:<file>`).
 */
export function cssDigests(files, read) {
  return [...new Set(files)]
    .map(file => {
      const content = read(file)
      if (content === null || content === undefined) return `missing:${file}`
      return createHash('sha1').update(content.replace(/\s*\/\*# sourceMappingURL=[^*]*\*\/\s*$/, '')).digest('hex').slice(0, 16)
    })
    .sort()
}
