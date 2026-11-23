/**
 * The scopes some tool of this app's MCP server needs (#541), from the same registries the `/api/mcp` route builds
 * its tools from: the entity registry and the `entities/<slug>/mcp.ts` overrides.
 *
 * They are the scopes of MCP browser sign-in: what the authorization server publishes, what the consent screen
 * offers and what a connection can be granted (`mcpOAuthResourceScopes`). An entity kept out of MCP (`patterns`,
 * by default) and an operation an override excludes have no tool, and so no permission. For hand-written tools
 * it is what the overrides declare (`extraToolScopes`): no tool factory runs here.
 *
 * A project that mounts its own MCP route with other `excludeSlugs`, `defaultOperations` or `utilityTools` exposes
 * something else than this list says: the default route is the one this follows.
 */
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import type { EntityConfig } from '../../entities/types'
import { toolScopesOf } from '../exposure'
import type { McpEntityOverride } from '../types'

let cached: string[] | undefined
let warned = false

/**
 * The overrides of the app, loaded when the list is first asked for and not with this module.
 *
 * This module is in the import graph of `lib/auth`, and the registry of overrides imports every
 * `entities/<slug>/mcp.ts` of the project, tool code included. Imported at the top, those modules would be
 * evaluated whenever auth loads, in every project, with or without browser sign-in: an `mcp.ts` that reads `auth`
 * in its module scope (it used to be in the graph of `/api/mcp` only) would find it not yet initialized. Loaded
 * here, they are evaluated only when sign-in is built and enabled, which is the only time the list is asked for.
 * A project that enables it keeps the module scope of its `mcp.ts` free of anything that reads `lib/auth`.
 *
 * `require`, like the other registries core loads late (lib/translations/i18n-integration): Next (Turbopack and
 * webpack) and Jest resolve and transform it. Where it does not exist the list is computed without the overrides.
 */
function appOverrides(): Record<string, McpEntityOverride> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MCP_OVERRIDES } = require('@nextsparkjs/registries/mcp-registry') as typeof import('@nextsparkjs/registries/mcp-registry')
    // Core declares the registries loosely (nextspark-registries.d.ts); their real types exist in the host app
    return MCP_OVERRIDES as unknown as Record<string, McpEntityOverride>
  } catch (error) {
    // A runtime that runs core's built ES modules as they are has no `require`: `nextspark worker` (Node, tsx and
    // the registry preload), when a handler of the project imports `lib/auth`. Sign-in is not served from there,
    // so the list only has to exist: without the overrides it is the scopes of every generated tool, wider than
    // what the app serves and never an access (a scope with no tool does nothing). Auth still loads.
    if (!warned) {
      warned = true
      console.warn('[mcp] The MCP overrides could not be loaded here, so the scopes of sign-in are computed without them:', error)
    }
    return {}
  }
}

/** Sorted, computed once per process: the registries are fixed at build time. */
export function mcpToolScopes(): string[] {
  if (!cached) {
    const entityConfigs = Object.fromEntries(
      Object.entries(ENTITY_REGISTRY as unknown as Record<string, { config: EntityConfig }>).map(([slug, entry]) => [slug, entry.config])
    )
    cached = toolScopesOf(entityConfigs, { overrides: appOverrides() })
  }
  return cached
}
