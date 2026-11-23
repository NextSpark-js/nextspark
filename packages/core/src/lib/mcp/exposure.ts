/**
 * What the MCP server exposes of the entity registry, computed in one place.
 *
 * The engine builds its tools from it, and MCP browser sign-in (#541) takes from it the scopes it publishes, offers
 * on the consent screen and grants: a permission no tool needs would do nothing, so it is not a permission of the
 * server at all, whatever a connecting client asks for.
 *
 * The authorization server is configured from this module while `lib/auth` loads, so it imports nothing of the
 * request path (no executor, no SDK) and runs nothing of the project: it reads configuration, never tool
 * factories.
 */

import type { EntityConfig } from '../entities/types'
import { isApiOperationEnabled } from '../entities/api-access'
import type { EngineApi, McpEngineOptions, McpEntityOverride, McpOperation, McpToolDefinition } from './types'

export const DEFAULT_OPERATIONS: McpOperation[] = ['list', 'get', 'create', 'update', 'delete']
/** Entities kept out of MCP unless a project says otherwise (`excludeSlugs`): no tools, and so no permissions. */
export const DEFAULT_EXCLUDED_SLUGS = ['patterns']
export const DEFAULT_TIMEZONE = 'UTC'

/** The options that decide what is exposed: the same ones `createMcpEngine` takes. */
export type McpExposureOptions = Pick<
  McpEngineOptions,
  'overrides' | 'excludeSlugs' | 'defaultOperations' | 'utilityTools' | 'utilityToolScopes'
>

export interface ExposedEntity {
  slug: string
  entityConfig: EntityConfig
  override?: McpEntityOverride
  /** The operations a tool is generated for, in the order of `defaultOperations`. Never empty. */
  operations: McpOperation[]
}

/**
 * The entities the server generates tools for, each with its operations: enabled, served by the API, not kept out
 * by slug or by its override, minus the operations its override excludes and the ones `access.api` does not serve
 * (#376: list and get are reads, the rest map 1:1).
 */
export function exposedEntities(registry: Record<string, EntityConfig>, options: McpExposureOptions = {}): ExposedEntity[] {
  const excluded = new Set(options.excludeSlugs ?? DEFAULT_EXCLUDED_SLUGS)
  const defaultOperations = options.defaultOperations ?? DEFAULT_OPERATIONS
  const overrides = options.overrides ?? {}
  const exposed: ExposedEntity[] = []

  for (const [slug, entityConfig] of Object.entries(registry)) {
    if (excluded.has(slug)) continue
    if (!entityConfig?.enabled) continue
    if (!entityConfig.access?.api) continue

    const override = overrides[slug]
    if (override?.exclude) continue

    const operations = defaultOperations.filter(
      (op) =>
        !override?.excludeOperations?.includes(op) &&
        isApiOperationEnabled(entityConfig, op === 'list' || op === 'get' ? 'read' : op)
    )
    if (!operations.length) continue

    exposed.push({ slug, entityConfig, override, operations })
  }
  return exposed
}

/** The tool factories of a project (the `extraTools` of an override whose slug is not kept out, then `utilityTools`), in the order the engine builds them. */
export function handWrittenToolFactories(options: McpExposureOptions = {}): Array<(api: EngineApi) => McpToolDefinition[]> {
  const excluded = new Set(options.excludeSlugs ?? DEFAULT_EXCLUDED_SLUGS)
  const factories: Array<(api: EngineApi) => McpToolDefinition[]> = []
  for (const [slug, override] of Object.entries(options.overrides ?? {})) {
    if (!override.extraTools) continue
    if (excluded.has(slug)) continue
    factories.push(override.extraTools)
  }
  if (options.utilityTools) factories.push(options.utilityTools)
  return factories
}

/** The scope the API handler of an operation asks for: `<slug>:read|write|delete`. */
export function operationScope(slug: string, operation: McpOperation): string {
  const action = operation === 'list' || operation === 'get' ? 'read' : operation === 'delete' ? 'delete' : 'write'
  return `${slug}:${action}`
}

/**
 * The scopes a call to a tool needs before it runs, from its `meta`. A generated entity tool: the scope of its
 * operation. A hand-written tool: what it declares in `meta.requiredScopes`; one that declares nothing and is not
 * a single entity operation needs none here, and is checked call by call where it makes them.
 */
export function scopesOfToolMeta(meta: McpToolDefinition['meta']): string[] {
  if (meta?.requiredScopes) return [...meta.requiredScopes]
  if (!meta?.entitySlug || !meta.operation || meta.operation === 'workflow') return []
  return [operationScope(meta.entitySlug, meta.operation)]
}

/**
 * Every scope a server built from `registry` and `options` can need, sorted: the scopes of the generated tools,
 * and the ones a project declares for its hand-written tools (`extraToolScopes` of an override whose `extraTools`
 * the engine builds, `utilityToolScopes` next to `utilityTools`).
 *
 * Nothing of the project runs here. The hand-written tools are not built to find out what they need: a factory
 * gets the engine's own API (tool prefix, schemas, executor) and may depend on any of it, and this is read while
 * the authorization server is configured, before there is an engine. The engine warns when it builds a
 * hand-written tool that needs a scope outside this list.
 */
export function toolScopesOf(registry: Record<string, EntityConfig>, options: McpExposureOptions = {}): string[] {
  const scopes = new Set<string>()
  for (const { entityConfig, operations } of exposedEntities(registry, options)) {
    for (const operation of operations) scopes.add(operationScope(entityConfig.slug, operation))
  }
  const excluded = new Set(options.excludeSlugs ?? DEFAULT_EXCLUDED_SLUGS)
  for (const [slug, override] of Object.entries(options.overrides ?? {})) {
    if (!override.extraTools || excluded.has(slug)) continue
    for (const scope of override.extraToolScopes ?? []) scopes.add(scope)
  }
  if (options.utilityTools) {
    for (const scope of options.utilityToolScopes ?? []) scopes.add(scope)
  }
  return [...scopes].sort()
}
