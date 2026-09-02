/**
 * MCP Override Discovery
 *
 * Discovers `entities/<slug>/mcp.ts` files for the active theme — the
 * extension point a theme uses to customize how one entity is exposed by the
 * MCP engine (@nextsparkjs/core/lib/mcp): exclude it, exclude specific
 * operations, relax required fields, transform input/output, or add extra
 * (non-CRUD) tools.
 *
 * Mirrors discoverApiPresets's discoverEntityFolders (same
 * `{theme}/entities/<slug>/` scan, same theme-only scope) with one
 * difference: `mcp.ts` sits at the entity folder root (a sibling of `api/`,
 * `migrations/`, `messages/`), not nested under `api/` like `presets.ts`.
 *
 * Unlike the presets discovery, this module does NOT parse file contents —
 * an McpEntityOverride exports real functions (transformInput, extraTools),
 * which can't be recovered by regex/brace-counting. The generator instead
 * emits a literal `import` statement per discovered file (same approach as
 * entity-registry.mjs), and the override object itself is resolved by the
 * TypeScript compiler/bundler at build time, not by this script.
 *
 * @module core/scripts/build/registry/discovery/mcp-overrides
 */

import { readdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { log, verbose } from '../../../utils/index.mjs'

/**
 * Discover MCP entity overrides for the active theme.
 * @param {object} config - Configuration object from getConfig()
 * @returns {Promise<Array<{slug: string, importPath: string, themeName: string}>>}
 */
export async function discoverMcpOverrides(config) {
  const overrides = []
  const themeName = config.activeTheme

  if (!themeName) {
    verbose('[mcp-overrides] No active theme configured — skipping MCP override discovery')
    return overrides
  }

  const entitiesDir = join(config.themesDir, themeName, 'entities')
  if (!existsSync(entitiesDir)) {
    verbose(`[mcp-overrides] No entities directory found for theme "${themeName}"`)
    return overrides
  }

  try {
    const entries = await readdir(entitiesDir, { withFileTypes: true })
    const entityDirs = entries.filter((entry) => entry.isDirectory())

    for (const dir of entityDirs) {
      const entityName = dir.name
      const mcpPath = join(entitiesDir, entityName, 'mcp.ts')
      if (!existsSync(mcpPath)) continue

      overrides.push({
        slug: entityName,
        importPath: `@/contents/themes/${themeName}/entities/${entityName}/mcp`,
        themeName,
      })
      verbose(`[mcp-overrides] MCP override discovered: ${entityName} -> ${mcpPath}`)
    }
  } catch (error) {
    log(`[mcp-overrides] Error discovering MCP overrides: ${error.message}`, 'error')
  }

  return overrides
}
