/**
 * MCP Scopes Generator (#541)
 *
 * Generates mcp-scopes.ts: the two lists MCP browser sign-in configures the authorization server with, as plain
 * data. `lib/auth` imports it, and `lib/auth` is in the module graph of every route of the app: read from the
 * entity registry and from the registry of `entities/<slug>/mcp.ts` files, the same lists put the config of every
 * entity in each route and made auth evaluate the project's tool code.
 *
 * So nothing of the project runs here either. The entity configs and the `mcp.ts` files are parsed and only
 * literals are read (the way host/entity-routes.mjs and contracts/read-entities.mjs read them):
 *
 * - of an entity config: `slug`, `enabled` and `access.api`;
 * - of an `mcp.ts`: `exclude`, `excludeOperations`, `extraToolScopes`, and whether it has `extraTools`.
 *
 * What is exposed is then decided by core's own `lib/mcp/exposure.ts`, the module the `/api/mcp` route builds its
 * tools with: it is transpiled and called on those facts, so there is one implementation of the rules.
 *
 * A value this cannot read as a literal stops the build, with the file and what to write: the lists are an
 * authorization policy, and a guess in either direction would publish a permission no tool needs or hide one a
 * tool does. A project that does not turn `features.mcpOAuth` on is not read at all and gets empty lists.
 *
 * @module core/scripts/build/registry/generators/mcp-scopes
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { errorWithLines } from '../../../utils/logging.mjs'
import { Sources, literal, property, resolve } from '../contracts/read-entities.mjs'
import { entityConfigFile } from '../host/entity-routes.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

/** The core sources the rules are in. `exposure.ts` may import `api-access.ts` and nothing else that runs. */
export const EXPOSURE_SOURCE = 'src/lib/mcp/exposure.ts'
export const API_ACCESS_SOURCE = 'src/lib/entities/api-access.ts'

const API_OPERATIONS = ['read', 'create', 'update', 'delete']
const MCP_OPERATIONS = ['list', 'get', 'create', 'update', 'delete']

/**
 * Evaluate core's `lib/mcp/exposure.ts` and return its exports (`toolScopesOf`, ...).
 * Both files are TypeScript with no dependency: they are transpiled and run as they are.
 */
export async function loadExposure(coreRoot, projectRoot) {
  const ts = await loadTypeScriptFor(projectRoot)
  const evaluate = (relativePath, require) => {
    const file = join(coreRoot, relativePath)
    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      throw errorWithLines([`The installed @nextsparkjs/core (${coreRoot}) does not ship ${relativePath}, which the scopes of MCP browser sign-in are computed with.`])
    }
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    const module = { exports: {} }
    new Function('require', 'module', 'exports', outputText)(require, module, module.exports)
    return module.exports
  }
  const apiAccess = evaluate(API_ACCESS_SOURCE, id => {
    throw errorWithLines([`${API_ACCESS_SOURCE} imports ${id}: it is evaluated when the registries are generated and may import nothing.`])
  })
  return evaluate(EXPOSURE_SOURCE, id => {
    if (id === '../entities/api-access') return apiAccess
    throw errorWithLines([`${EXPOSURE_SOURCE} imports ${id}: it is evaluated when the registries are generated and may import only ../entities/api-access.`])
  })
}

/** The file of an entity config: the project's, a plugin's, or core's own (`@nextsparkjs/core/entities/...`). */
function configFileOf(entity, { projectRoot, sourceRoot, coreRoot, plugins }) {
  const corePrefix = '@nextsparkjs/core/entities/'
  if (entity.configPath?.startsWith(corePrefix)) {
    const base = join(coreRoot, 'src/entities', entity.configPath.slice(corePrefix.length).replace(/\.tsx?$/, ''))
    return ['.ts', '.tsx'].map(extension => `${base}${extension}`).find(candidate => existsSync(candidate)) ?? `${base}.ts`
  }
  return entityConfigFile(entity, { projectRoot, sourceRoot, plugins })
}

const whereOf = (entity) =>
  entity.source === 'plugin' ? `plugins/${entity.pluginContext?.pluginName}/entities/${entity.relativePath}` : entity.isCore ? `@nextsparkjs/core entities/${entity.relativePath}` : `entities/${entity.relativePath}`

/**
 * What the config of one entity says of its API, as the object `exposure.ts` reads: `{ slug, enabled, access: { api } }`.
 * Returns `{ config }` or `{ errors }`.
 */
export function readEntityApiFacts({ file, exportName, sources }) {
  const { ts } = sources
  const sourceFile = sources.load(file)
  if (!sourceFile) return { errors: ['cannot be read or does not parse'] }
  let initializer = null
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) initializer = declaration.initializer
    }
  }
  const resolved = initializer ? resolve(initializer, file, sources) : null
  if (!resolved || !ts.isObjectLiteralExpression(resolved.node)) return { errors: [`has no \`const ${exportName} = { ... }\` object literal`] }
  const { node: object, file: configFile } = resolved
  const errors = []

  const readLiteral = (holder, holderFile, name) => {
    const found = property(holder, name, ts)
    return found.state ? found : literal(found.node, holderFile, sources)
  }

  const slug = readLiteral(object, configFile, 'slug')
  if (slug.state !== 'value' || typeof slug.value !== 'string' || !slug.value) errors.push('`slug` is not a string literal: write it as `slug: \'<name>\'`')

  // The registry serves an entity only when `enabled` is true: absent is not enabled
  const enabled = readLiteral(object, configFile, 'enabled')
  if (enabled.state === 'unknown' || (enabled.state === 'value' && typeof enabled.value !== 'boolean')) errors.push('`enabled` is not a literal `true` or `false`')

  let api
  const access = property(object, 'access', ts)
  if (access.state === 'unknown') {
    errors.push('`access` is spread in or computed: write `access: { api: ... }` as a literal')
  } else if (!access.state) {
    const accessObject = resolve(access.node, configFile, sources)
    if (!accessObject || !ts.isObjectLiteralExpression(accessObject.node)) {
      errors.push('`access` is not an object literal')
    } else {
      const read = readLiteral(accessObject.node, accessObject.file, 'api')
      if (read.state === 'unknown') {
        errors.push('`access.api` is not a literal: write `true`, `false` or `{ read, create, update, delete }` with literal booleans')
      } else if (read.state === 'value') {
        const value = read.value
        const isOperations = typeof value === 'object' && value !== null && !Array.isArray(value)
          && Object.entries(value).every(([key, flag]) => API_OPERATIONS.includes(key) && typeof flag === 'boolean')
        if (typeof value === 'boolean' || isOperations) api = value
        else errors.push('`access.api` must be `true`, `false` or `{ read, create, update, delete }` with literal booleans')
      }
    }
  }
  if (errors.length) return { errors }
  return { config: { slug: slug.value, enabled: enabled.state === 'value' ? enabled.value : undefined, access: { api } } }
}

/**
 * What an `entities/<slug>/mcp.ts` says of what is exposed, as the override `exposure.ts` reads. `extraTools` is
 * only known to exist: it is never built here. Returns `{ override }` or `{ errors }`.
 */
export function readMcpOverrideFacts({ file, sources }) {
  const { ts } = sources
  const sourceFile = sources.load(file)
  if (!sourceFile) return { errors: ['cannot be read or does not parse'] }
  const exported = sourceFile.statements.find(statement => ts.isExportAssignment(statement) && !statement.isExportEquals)
  const resolved = exported ? resolve(exported.expression, file, sources) : null
  if (!resolved || !ts.isObjectLiteralExpression(resolved.node)) {
    return { errors: ['has no `export default` of an object literal (directly, or a `const` of the same file or of a relative import)'] }
  }
  const { node: object, file: overrideFile } = resolved
  const errors = []
  const override = {}

  const exclude = property(object, 'exclude', ts)
  if (exclude.state === 'unknown') {
    errors.push('`exclude` cannot be read (the object spreads another one or computes a key): write it as a literal `true` or `false`')
  } else if (!exclude.state) {
    const value = literal(exclude.node, overrideFile, sources)
    if (value.state === 'value' && typeof value.value === 'boolean') override.exclude = value.value
    else errors.push('`exclude` is not a literal `true` or `false`')
  }

  const stringList = (name, allowed) => {
    const found = property(object, name, ts)
    if (found.state === 'absent') return undefined
    if (found.state === 'unknown') {
      errors.push(`\`${name}\` cannot be read (the object spreads another one or computes a key): write it as a literal array of strings`)
      return undefined
    }
    const value = literal(found.node, overrideFile, sources)
    if (value.state !== 'value' || !Array.isArray(value.value) || !value.value.every(item => typeof item === 'string')) {
      errors.push(`\`${name}\` is not a literal array of strings`)
      return undefined
    }
    const unknown = allowed ? value.value.filter(item => !allowed.includes(item)) : []
    if (unknown.length) {
      errors.push(`\`${name}\` names ${unknown.map(item => `"${item}"`).join(', ')}: use ${allowed.join(', ')}`)
      return undefined
    }
    return value.value
  }
  const excludeOperations = stringList('excludeOperations', MCP_OPERATIONS)
  if (excludeOperations) override.excludeOperations = excludeOperations
  const extraToolScopes = stringList('extraToolScopes')
  if (extraToolScopes) override.extraToolScopes = extraToolScopes

  // Only whether the entity has hand-written tools: a function, a reference to one or a method all count
  const extraTools = property(object, 'extraTools', ts)
  if (extraTools.state === 'unknown') {
    const declared = object.properties.some(member => member.name && !ts.isComputedPropertyName(member.name) && member.name.text === 'extraTools')
    if (declared) override.extraTools = () => []
    else errors.push('whether it has `extraTools` cannot be read (the object spreads another one or computes a key): write the override as one object literal')
  } else if (!extraTools.state) {
    const node = extraTools.node
    const isNothing = node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(node) && node.text === 'undefined' && !extraTools.shorthand)
    if (!isNothing) override.extraTools = () => []
  }

  return errors.length ? { errors } : { override }
}

/**
 * The scopes of MCP browser sign-in for a project: `{ apiEntities, toolScopes }`, both sorted.
 *
 * @param {object} input
 * @param {object[]} input.entities - the merged entities of the registry build (plugins, core and the project)
 * @param {Array<{slug: string}>} input.mcpOverrides - `discoverMcpOverrides()`
 * @param {string} input.projectRoot - where TypeScript resolves from
 * @param {string} [input.sourceRoot] - where the project's `@/` sources are (default: the project root)
 * @param {string} input.coreRoot
 * @param {Array<{root: string, importBase: string}>} [input.plugins]
 */
export async function planMcpScopes({ entities, mcpOverrides, projectRoot, sourceRoot = projectRoot, coreRoot, plugins = [] }) {
  const ts = await loadTypeScriptFor(projectRoot)
  const sources = new Sources(ts, projectRoot)
  const problems = []

  // The entity registry has an entry per discovered entity, children included. A child (`...ChildConfig`) is a
  // `{ table, fields }` definition with no `enabled` and no `access`: the API never serves it on its own.
  const registry = {}
  for (const entity of entities) {
    if (!/EntityConfig$/.test(entity.exportName ?? '')) continue
    const file = configFileOf(entity, { projectRoot, sourceRoot, coreRoot, plugins })
    const read = file && existsSync(file) ? readEntityApiFacts({ file, exportName: entity.exportName, sources }) : { errors: ['cannot be found'] }
    if (read.errors) problems.push(...read.errors.map(error => `  - ${whereOf(entity)} (${entity.configPath}): ${error}`))
    else registry[entity.name] = read.config
  }

  const overrides = {}
  for (const { slug } of mcpOverrides) {
    const file = join(sourceRoot, 'entities', slug, 'mcp.ts')
    const read = readMcpOverrideFacts({ file, sources })
    if (read.errors) problems.push(...read.errors.map(error => `  - entities/${slug}/mcp.ts: ${error}`))
    else overrides[slug] = read.override
  }

  if (problems.length) {
    throw errorWithLines([
      'MCP browser sign-in (`features.mcpOAuth`) is on, and the permissions it works with are read from the source of the entity configs and of the `entities/<slug>/mcp.ts` files, without running them. These could not be read:',
      ...problems,
      'Write those values as literals (a `const` of the same file or of a relative import is followed), then run the build again.',
    ])
  }

  const { toolScopesOf } = await loadExposure(coreRoot, projectRoot)
  return {
    // The entities a scope can name: the ones the scope registry gives role scopes for (`access.api` set and a slug)
    apiEntities: [...new Set(Object.values(registry).filter(config => config.access.api && config.slug).map(config => config.slug))].sort(),
    toolScopes: toolScopesOf(registry, { overrides }),
  }
}

/**
 * @param {{ apiEntities: string[], toolScopes: string[] } | null} scopes - `planMcpScopes()`, or null for a project without `features.mcpOAuth`
 * @returns {string} Generated TypeScript content
 */
export function generateMcpScopes(scopes) {
  const data = scopes ?? { apiEntities: [], toolScopes: [] }
  return `/**
 * MCP Scopes (data only)
 *
 * What MCP browser sign-in (\`features.mcpOAuth\`) configures the authorization server with, read from the source of
 * the entity configs and of the \`entities/<slug>/mcp.ts\` files when the registries are generated:
 *
 * - \`apiEntities\`: the entities the API serves, the ones a scope \`<entity>:read|write|delete\` can name.
 * - \`toolScopes\`: the scopes some tool of the default \`/api/mcp\` route needs.
 *
 * It imports nothing: \`lib/auth\` reads it, and nothing of the project is loaded for that.
 * ${scopes ? 'Both lists are computed.' : 'Both lists are empty: the project does not turn `features.mcpOAuth` on, so its sources were not read.'}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build/registry.mjs
 */

export const MCP_SCOPES: { readonly apiEntities: readonly string[]; readonly toolScopes: readonly string[] } = ${JSON.stringify({ apiEntities: data.apiEntities, toolScopes: data.toolScopes }, null, 2)}
`
}
