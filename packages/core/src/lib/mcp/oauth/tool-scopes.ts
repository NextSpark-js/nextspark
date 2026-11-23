/**
 * The scopes some tool of this app's MCP server needs (#541), from the same registries the `/api/mcp` route builds
 * its tools from: the entity registry and the `entities/<slug>/mcp.ts` overrides.
 *
 * They are the scopes of MCP browser sign-in: what the authorization server publishes, what the consent screen
 * offers and what a connection can be granted (`mcpOAuthResourceScopes`). An entity kept out of MCP (`patterns`,
 * by default) and an operation an override excludes have no tool, and so no permission. For hand-written tools
 * it is what the overrides declare (`extraToolScopes`): no tool factory runs here. The overrides are imported,
 * though, while `lib/auth` is being configured: an `mcp.ts` keeps its module scope free of work.
 *
 * A project that mounts its own MCP route with other `excludeSlugs`, `defaultOperations` or `utilityTools` exposes
 * something else than this list says: the default route is the one this follows.
 */
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { MCP_OVERRIDES } from '@nextsparkjs/registries/mcp-registry'
import type { EntityConfig } from '../../entities/types'
import { toolScopesOf } from '../exposure'
import type { McpEntityOverride } from '../types'

let cached: string[] | undefined

/** Sorted, computed once per process: the registries are fixed at build time. */
export function mcpToolScopes(): string[] {
  if (!cached) {
    const entityConfigs = Object.fromEntries(
      Object.entries(ENTITY_REGISTRY as unknown as Record<string, { config: EntityConfig }>).map(([slug, entry]) => [slug, entry.config])
    )
    // Core declares the registries loosely (nextspark-registries.d.ts); their real types exist in the host app
    cached = toolScopesOf(entityConfigs, { overrides: MCP_OVERRIDES as unknown as Record<string, McpEntityOverride> })
  }
  return cached
}
