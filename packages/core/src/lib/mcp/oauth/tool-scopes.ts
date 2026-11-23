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
import type { EntityConfig } from '../../entities/types'
import { toolScopesOf } from '../exposure'
import type { McpEntityOverride } from '../types'

interface AppRegistries {
  entities: Record<string, EntityConfig>
  overrides: Record<string, McpEntityOverride>
}

let cached: string[] | undefined
let known = true
let warned = false

/**
 * The two registries of the app, loaded when the list is first asked for and not with this module.
 *
 * This module is in the import graph of `lib/auth`, which every route of the app reaches:
 *
 * - The entity registry imports the config of every entity. Imported at the top, each per-entity route would carry
 *   them all, which core keeps out of those routes (tests/node/core-routes.test.ts).
 * - The registry of overrides imports every `entities/<slug>/mcp.ts` of the project, tool code included. Imported
 *   at the top, those modules would be evaluated whenever auth loads, in every project, with or without browser
 *   sign-in: an `mcp.ts` that reads `auth` in its module scope (it used to be in the graph of `/api/mcp` only)
 *   would find it not yet initialized.
 *
 * Loaded here, they are read only when sign-in is built and enabled, which is the only time the list is asked
 * for. A project that enables it keeps the module scope of its `mcp.ts` free of anything that reads `lib/auth`.
 *
 * `require`, like the other registries core loads late (lib/translations/i18n-integration): Next (Turbopack and
 * webpack) and Jest resolve and transform it. Where it does not exist there is no list: see `mcpToolScopesKnown`.
 */
function appRegistries(): AppRegistries | null {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { ENTITY_REGISTRY } = require('@nextsparkjs/registries/entity-registry') as typeof import('@nextsparkjs/registries/entity-registry')
    const { MCP_OVERRIDES } = require('@nextsparkjs/registries/mcp-registry') as typeof import('@nextsparkjs/registries/mcp-registry')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return {
      entities: Object.fromEntries(
        Object.entries(ENTITY_REGISTRY as unknown as Record<string, { config: EntityConfig }>).map(([slug, entry]) => [slug, entry.config])
      ),
      // Core declares the registries loosely (nextspark-registries.d.ts); their real types exist in the host app
      overrides: MCP_OVERRIDES as unknown as Record<string, McpEntityOverride>,
    }
  } catch (error) {
    // Only where `require` itself does not exist: a runtime that runs core's built ES modules as they are, which
    // is `nextspark worker` (Node, tsx and the registry preload) when a handler of the project imports `lib/auth`.
    // Any other error is the project's own (an `mcp.ts` that fails to load) and is not hidden.
    if (!(error instanceof ReferenceError && /\brequire is not defined\b/.test(error.message))) throw error
    // Sign-in is not served from there, so auth only has to load. The list is empty and marked as not known, and
    // that process leaves the stored policy of the resource as the app wrote it (mcpOAuthPlugins).
    if (!warned) {
      warned = true
      console.warn('[mcp] The registries of the app could not be loaded here, so this process has no list of the scopes MCP sign-in works with:', error)
    }
    return null
  }
}

/** Sorted, computed once per process: the registries are fixed at build time. Empty where they cannot be loaded. */
export function mcpToolScopes(): string[] {
  if (!cached) {
    const registries = appRegistries()
    known = registries !== null
    cached = registries ? toolScopesOf(registries.entities, { overrides: registries.overrides }) : []
  }
  return cached
}

/**
 * Whether this process could read the registries the list comes from. It is false only where they cannot be
 * loaded late (`nextspark worker`): the list is then empty and says nothing about the app, so nothing that
 * outlives the process may be written from it.
 */
export function mcpToolScopesKnown(): boolean {
  mcpToolScopes()
  return known
}
