/**
 * What an entity config says about its API shape, read statically (#203 stage 7b).
 *
 * The portable contracts (DTO types and zod schemas) are generated from the entity configs, but a
 * config imports lucide icons and core types, so it is never executed: the file is parsed with
 * TypeScript and only literals are read (the same way host/entity-routes.mjs reads route facts).
 * A field this reader cannot understand is never dropped silently: it degrades to `unknown` and
 * says so in the entity's warnings.
 *
 * @module core/scripts/build/registry/contracts/read-entities
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { readColumnTypes } from './read-columns.mjs'

const MAX_DEPTH = 8
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']

/** Field types that carry a string on the wire (ids, urls, text, ISO dates). */
const STRING_TYPES = new Set([
  'text', 'textarea', 'email', 'url', 'phone', 'date', 'datetime', 'markdown', 'richtext', 'code', 'timezone', 'currency', 'country',
  'relation', 'reference', 'user', 'relation-prop',
])
const NUMBER_TYPES = new Set(['number', 'range', 'rating'])
const FILE_LIST_TYPES = new Set(['file', 'video', 'audio'])
const OPTION_TYPES = new Set(['select', 'radio', 'buttongroup', 'combobox'])

const unwrap = (node, ts) => {
  let current = node
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression?.(current))) current = current.expression
  return current
}

/** `{ node }` for the property `name` of an object literal, `{ state: 'absent' | 'unknown' }` otherwise. */
function property(object, name, ts) {
  let found = null
  let opaque = false
  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member)) {
      opaque = true
    } else if (ts.isPropertyAssignment(member) || ts.isShorthandPropertyAssignment(member)) {
      const key = member.name
      if (ts.isComputedPropertyName(key)) {
        opaque = true
      } else if ((ts.isIdentifier(key) || ts.isStringLiteral(key)) && key.text === name) {
        found = ts.isShorthandPropertyAssignment(member) ? { node: member.name, shorthand: true } : { node: member.initializer }
      }
    } else if (member.name && ts.isComputedPropertyName(member.name)) {
      opaque = true
    } else if (member.name && member.name.text === name) {
      return { state: 'unknown' }
    }
  }
  if (found) return found
  return opaque ? { state: 'unknown' } : { state: 'absent' }
}

/** The parsed sources of one run, by file. */
class Sources {
  constructor(ts, projectRoot) {
    this.ts = ts
    this.projectRoot = projectRoot
    this.files = new Map()
  }

  load(file) {
    if (this.files.has(file)) return this.files.get(file)
    let parsed = null
    try {
      const source = readFileSync(file, 'utf8')
      const sourceFile = this.ts.createSourceFile(file, source, this.ts.ScriptTarget.Latest, true, this.ts.getScriptKindFromFileName(file))
      parsed = (sourceFile.parseDiagnostics ?? []).length > 0 ? null : sourceFile
    } catch {
      parsed = null
    }
    this.files.set(file, parsed)
    return parsed
  }
}

/** The file a relative import specifier names, or null. */
function resolveRelative(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = join(dirname(fromFile), specifier)
  const stripped = base.replace(/\.(?:[cm]?[jt]sx?)$/, '')
  for (const candidate of [base, ...EXTENSIONS.map(extension => `${stripped}${extension}`), ...EXTENSIONS.map(extension => join(base, `index${extension}`))]) {
    if (existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate)) return candidate
  }
  return null
}

function topLevelConst(sourceFile, name, ts) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) return declaration.initializer
    }
  }
  return null
}

/** `{ file, imported }` when `name` is a named import of the file from a relative module. */
function importedBinding(sourceFile, name, ts) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.name.text === name) return { specifier: statement.moduleSpecifier.text, imported: (element.propertyName ?? element.name).text }
    }
  }
  return null
}

/**
 * Follow an expression to a literal node: an identifier resolves to its `const` in the same file
 * or in the relative module it is imported from. Returns `{ node, file }` or null.
 */
function resolve(node, file, sources, depth = 0) {
  const { ts } = sources
  const inner = unwrap(node, ts)
  if (depth > MAX_DEPTH || !inner) return null
  if (!ts.isIdentifier(inner)) return { node: inner, file }
  const sourceFile = sources.load(file)
  if (!sourceFile) return null
  const local = topLevelConst(sourceFile, inner.text, ts)
  if (local) return resolve(local, file, sources, depth + 1)
  const binding = importedBinding(sourceFile, inner.text, ts)
  const target = binding ? resolveRelative(file, binding.specifier) : null
  const targetFile = target ? sources.load(target) : null
  if (!binding || !target || !targetFile) return null
  const exported = topLevelConst(targetFile, binding.imported, ts)
  return exported ? resolve(exported, target, sources, depth + 1) : null
}

/** The elements of an array expression (spreads of resolvable arrays included), each `{ node, file }`; null when not literal. */
function elementsOf(node, file, sources, depth = 0) {
  const { ts } = sources
  const resolved = resolve(node, file, sources, depth)
  if (!resolved || !ts.isArrayLiteralExpression(resolved.node)) return null
  const elements = []
  for (const element of resolved.node.elements) {
    if (ts.isSpreadElement(element)) {
      const spread = elementsOf(element.expression, resolved.file, sources, depth + 1)
      if (!spread) return null
      elements.push(...spread)
    } else {
      elements.push({ node: element, file: resolved.file })
    }
  }
  return elements
}

const literal = (node, file, sources) => {
  const resolved = resolve(node, file, sources)
  const inner = resolved && unwrap(resolved.node, sources.ts)
  const { ts } = sources
  if (!inner) return { state: 'unknown' }
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return { state: 'value', value: inner.text }
  if (ts.isNumericLiteral(inner)) return { state: 'value', value: Number(inner.text) }
  if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(inner.operand)) return { state: 'value', value: -Number(inner.operand.text) }
  if (inner.kind === ts.SyntaxKind.TrueKeyword) return { state: 'value', value: true }
  if (inner.kind === ts.SyntaxKind.FalseKeyword) return { state: 'value', value: false }
  return { state: 'unknown' }
}

/** The literal at `path` of an object literal node: `{ state: 'value' | 'absent' | 'unknown' }`. */
function read(objectNode, file, path, sources) {
  const { ts } = sources
  let object = objectNode
  let currentFile = file
  for (const [index, key] of path.entries()) {
    const found = property(object, key, ts)
    if (found.state) return found
    if (index === path.length - 1) return literal(found.node, currentFile, sources)
    const next = resolve(found.node, currentFile, sources)
    if (!next || !ts.isObjectLiteralExpression(next.node)) return { state: 'unknown' }
    object = next.node
    currentFile = next.file
  }
  return { state: 'unknown' }
}

/** The options of a select-like field as `[{ value, label? }]`, or null when they are not literal. */
function readOptions(node, file, sources) {
  const elements = elementsOf(node, file, sources)
  if (!elements) return null
  const options = []
  for (const element of elements) {
    const resolved = resolve(element.node, element.file, sources)
    if (!resolved || !sources.ts.isObjectLiteralExpression(resolved.node)) return null
    const value = read(resolved.node, resolved.file, ['value'], sources)
    if (value.state !== 'value' || (typeof value.value !== 'string' && typeof value.value !== 'number')) return null
    const label = read(resolved.node, resolved.file, ['label'], sources)
    options.push({ value: value.value, ...(label.state === 'value' && typeof label.value === 'string' ? { label: label.value } : {}) })
  }
  return options
}

/** What one field object literal says (name, type, constraints, defaults), and what it could not tell. */
function readField(element, sources, warn) {
  const { ts } = sources
  const resolved = resolve(element.node, element.file, sources)
  if (!resolved || !ts.isObjectLiteralExpression(resolved.node)) {
    warn('a field is not an object literal and was left out of the contract')
    return null
  }
  const { node: object, file } = resolved
  const name = read(object, file, ['name'], sources)
  if (name.state !== 'value' || typeof name.value !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name.value)) {
    warn('a field has no literal identifier `name` and was left out of the contract')
    return null
  }
  const label = name.value
  const type = read(object, file, ['type'], sources)
  if (type.state !== 'value' || typeof type.value !== 'string') {
    warn(`field "${label}": its \`type\` is not a literal, so it was left out of the contract`)
    return null
  }
  const required = read(object, file, ['required'], sources)
  const readOnly = read(object, file, ['api', 'readOnly'], sources)
  const defaultProperty = property(object, 'defaultValue', ts)
  const displayLabel = read(object, file, ['display', 'label'], sources)
  const numeric = key => {
    const found = read(object, file, [key], sources)
    return found.state === 'value' && typeof found.value === 'number' ? found.value : undefined
  }
  if (required.state === 'unknown') warn(`field "${label}": \`required\` is not a literal, so it is treated as optional`)
  if (readOnly.state === 'unknown') warn(`field "${label}": \`api.readOnly\` is not a literal, so it is treated as writable`)

  let defaultValue
  if (defaultProperty.state === 'unknown') {
    warn(`field "${label}": \`defaultValue\` is not a literal, so the contract does not apply it`)
  } else if (!defaultProperty.state) {
    const value = literal(defaultProperty.node, file, sources)
    if (value.state === 'value') defaultValue = { value: value.value }
    else warn(`field "${label}": \`defaultValue\` is not a literal, so the contract does not apply it`)
  }

  let options = null
  const optionsProperty = property(object, 'options', ts)
  if (!optionsProperty.state) {
    options = readOptions(optionsProperty.node, file, sources)
    if (!options) warn(`field "${label}": \`options\` could not be read literally, so its values are typed as plain strings`)
  } else if (optionsProperty.state === 'unknown') {
    warn(`field "${label}": \`options\` could not be read literally, so its values are typed as plain strings`)
  }

  return {
    name: label,
    type: type.value,
    label: displayLabel.state === 'value' && typeof displayLabel.value === 'string' ? displayLabel.value : label,
    required: required.state === 'value' && required.value === true,
    hasDefault: defaultProperty.state !== 'absent',
    defaultValue,
    readOnly: readOnly.state === 'value' && readOnly.value === true,
    optionDescriptors: options && options.length > 0 ? options : null,
    options: options && options.length > 0 ? options.map(option => option.value) : null,
    min: numeric('min'),
    max: numeric('max'),
    maxLength: numeric('maxLength'),
  }
}

/**
 * The wire kind of a field: what zod schema and TypeScript type the contract gives it.
 * `{ kind }` is one of `string`, `number`, `boolean`, `json`, `unknown`, `tuple`, `string-array`, `address`, `media`,
 * `image`, `files`, `id-list`, or `enum` / `enum-array` with `values`. Each is what core's schema-generator.ts accepts
 * (and stores) for the field type, so the contract does not promise a shape the server would refuse.
 */
export function wireKind(field) {
  const values = field.options
  if (field.type === 'boolean') return { kind: 'boolean' }
  if (field.type === 'json') return { kind: 'json' }
  if (field.type === 'doublerange') return { kind: 'tuple' }
  if (field.type === 'address') return { kind: 'address' }
  if (field.type === 'media-library') return { kind: 'media' }
  if (field.type === 'image') return { kind: 'image' }
  if (FILE_LIST_TYPES.has(field.type)) return { kind: 'files' }
  // The server stores these as a JSON string of ids and accepts an array or that string
  if (field.type === 'relation-multi' || field.type === 'relation-prop-multi') return { kind: 'id-list' }
  if (field.type === 'multiselect') return values ? { kind: 'enum-array', values } : { kind: 'string-array' }
  if (OPTION_TYPES.has(field.type)) return values ? { kind: 'enum', values } : { kind: 'string' }
  if (field.type === 'tags') return { kind: 'string-array' }
  if (NUMBER_TYPES.has(field.type)) return { kind: 'number' }
  if (STRING_TYPES.has(field.type)) return { kind: 'string' }
  return { kind: 'unknown' }
}

/**
 * `childEntities: { lines: { table, fields: [...] } }` as the descriptor the shared generator reads.
 * `{ value: null }` when there are none; `{ error }` when they cannot be described exactly.
 */
function readChildEntities(object, file, sources) {
  const { ts } = sources
  const property_ = property(object, 'childEntities', ts)
  if (property_.state === 'absent') return { value: null }
  const fail = message => ({ error: `\`childEntities\` cannot be described (${message}), and the contract's request schema needs it to match the server's` })
  if (property_.state === 'unknown') return fail('it is spread in or computed')
  const children = resolve(property_.node, file, sources)
  if (!children || !ts.isObjectLiteralExpression(children.node)) return fail('it is not an object literal')
  const value = {}
  for (const member of children.node.properties) {
    if (!ts.isPropertyAssignment(member) || !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) return fail('an entry is spread in, computed or a method')
    const name = member.name.text
    const definition = resolve(member.initializer, children.file, sources)
    if (!definition || !ts.isObjectLiteralExpression(definition.node)) return fail(`"${name}" is not an object literal`)
    const table = read(definition.node, definition.file, ['table'], sources)
    const fieldsProperty = property(definition.node, 'fields', ts)
    if (fieldsProperty.state) return fail(`"${name}" has no literal \`fields\``)
    const elements = elementsOf(fieldsProperty.node, definition.file, sources)
    if (!elements) return fail(`the fields of "${name}" are not a literal array`)
    const problems = []
    const fields = elements.map(element => readField(element, sources, message => problems.push(message)))
    if (problems.length > 0 || fields.some(field => !field)) return fail(`"${name}": ${problems.join('; ') || 'a field is unreadable'}`)
    value[name] = { table: table.state === 'value' && typeof table.value === 'string' ? table.value : name, fields }
  }
  return { value: Object.keys(value).length > 0 ? value : null }
}

/**
 * Read one entity config.
 *
 * @param {{ file: string, exportName: string, projectRoot: string, sources?: Sources, migrationDirs?: string[] }} input
 * @returns {Promise<{ contract: object } | { skipped: string } | { error: string }>}
 */
export async function readEntityContract({ file, exportName, projectRoot, sources: shared, migrationDirs = [] }) {
  const ts = await loadTypeScriptFor(projectRoot)
  const sources = shared ?? new Sources(ts, projectRoot)
  const sourceFile = sources.load(file)
  if (!sourceFile) return { error: 'cannot be read or does not parse' }
  const initializer = topLevelConst(sourceFile, exportName, ts)
  const resolved = initializer ? resolve(initializer, file, sources) : null
  if (!resolved || !ts.isObjectLiteralExpression(resolved.node)) return { error: `has no \`const ${exportName} = { ... }\` object literal` }
  const { node: object, file: configFile } = resolved

  const warnings = []
  const slug = read(object, configFile, ['slug'], sources)
  if (slug.state !== 'value' || typeof slug.value !== 'string') return { error: 'has no literal `slug`' }
  const warn = message => warnings.push(message)

  const enabled = read(object, configFile, ['enabled'], sources)
  if (enabled.state === 'value' && enabled.value === false) return { skipped: 'the entity is disabled' }
  const api = read(object, configFile, ['access', 'api'], sources)
  if (api.state === 'value' && api.value === false) return { skipped: 'the entity has no external API (access.api is false)' }
  const shared_ = read(object, configFile, ['access', 'shared'], sources)
  const singular = read(object, configFile, ['names', 'singular'], sources)

  const fieldsProperty = property(object, 'fields', ts)
  let fields = []
  if (fieldsProperty.state === 'absent') {
    fields = []
  } else if (fieldsProperty.state === 'unknown') {
    warn('`fields` is spread in or computed, so the entity has only its system fields in the contract')
  } else {
    const elements = elementsOf(fieldsProperty.node, configFile, sources)
    if (!elements) {
      warn('`fields` is not a literal array (or one it spreads is not resolvable), so the entity has only its system fields in the contract')
    } else {
      fields = elements.map(element => readField(element, sources, warn)).filter(Boolean)
    }
  }

  const builder = read(object, configFile, ['builder', 'enabled'], sources)
  const softDelete = read(object, configFile, ['table', 'softDelete'], sources)
  if (builder.state === 'unknown') warn('`builder.enabled` is not a literal, so the entity is treated as not builder-enabled')
  if (softDelete.state === 'unknown') warn('`table.softDelete` is not a literal, so the entity is treated as having no soft delete')

  // taxonomies: { enabled, types: [{ type, field }] }
  let taxonomies = []
  const taxonomiesProperty = property(object, 'taxonomies', ts)
  if (taxonomiesProperty.state === 'unknown') {
    warn('`taxonomies` is spread in or computed, so its fields are not in the contract')
  } else if (!taxonomiesProperty.state) {
    const config = resolve(taxonomiesProperty.node, configFile, sources)
    const enabledFlag = config && ts.isObjectLiteralExpression(config.node) ? read(config.node, config.file, ['enabled'], sources) : { state: 'unknown' }
    if (enabledFlag.state === 'value' && enabledFlag.value === true) {
      const types = config && ts.isObjectLiteralExpression(config.node) ? property(config.node, 'types', ts) : { state: 'unknown' }
      const elements = types.state ? null : elementsOf(types.node, config.file, sources)
      if (!elements) warn('`taxonomies.types` is not a literal array, so its fields are not in the contract')
      else {
        for (const element of elements) {
          const entry = resolve(element.node, element.file, sources)
          const type = entry && ts.isObjectLiteralExpression(entry.node) ? read(entry.node, entry.file, ['type'], sources) : { state: 'unknown' }
          const field = entry && ts.isObjectLiteralExpression(entry.node) ? read(entry.node, entry.file, ['field'], sources) : { state: 'unknown' }
          if (type.state === 'value' && field.state === 'value' && typeof type.value === 'string' && /^[A-Za-z_$][\w$]*$/.test(field.value)) taxonomies.push({ type: type.value, field: field.value })
          else warn('a taxonomy type has no literal `type` and `field`, so it is not in the contract')
        }
      }
    } else if (enabledFlag.state === 'unknown') {
      warn('`taxonomies.enabled` is not a literal, so its fields are not in the contract')
    }
  }
  // childEntities: the shared generator adds `children` to the request schemas when they exist, so they are described
  // exactly, or generation fails: a contract that dropped them would reject what the server accepts
  const childEntities = readChildEntities(object, configFile, sources)
  if (childEntities.error) return { error: childEntities.error }

  return {
    contract: {
      slug: slug.value,
      singular: singular.state === 'value' && typeof singular.value === 'string' ? singular.value : null,
      shared: shared_.state === 'value' && shared_.value === true,
      builder: builder.state === 'value' && builder.value === true,
      softDelete: softDelete.state === 'value' && softDelete.value === true,
      taxonomies,
      childEntities: childEntities.value,
      fields,
      columnTypes: readColumnTypes(slug.value, migrationDirs),
      warnings,
    },
  }
}

export { Sources }
