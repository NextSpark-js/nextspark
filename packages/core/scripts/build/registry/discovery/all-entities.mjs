/**
 * Every entity the project serves: the enabled plugins', core's and the project's, merged with the
 * priority the registry build applies (plugins < core < project; a later entity replaces an earlier one
 * of the same name).
 *
 * The registry build (registry.mjs) merges the discoveries it already ran; `nextspark prepare` needs the
 * same list to write the per-entity routes of the generated host (host/entity-routes.mjs), so both share
 * `mergeEntities` and the host calls `discoverAllEntities`.
 *
 * @module core/scripts/build/registry/discovery/all-entities
 */

import { discoverCoreEntities } from './core-entities.mjs'
import { discoverPlugins } from './plugins.mjs'
import { discoverThemes } from './themes.mjs'

/**
 * Merge the discovered plugin, core and project entities.
 *
 * @param {object} input
 * @param {object[]} input.plugins - `discoverPlugins()`
 * @param {object[]} input.coreEntities - `discoverCoreEntities()`
 * @param {object[]} input.themes - `discoverThemes()` (the project's contribution)
 * @param {(entity: object, replaced: object) => void} [input.onOverride] - called when an entity replaces one of the same name
 * @returns {object[]}
 */
export function mergeEntities({ plugins, coreEntities, themes, onOverride }) {
  const merged = [
    ...plugins.flatMap(plugin => plugin.entities ?? []), // lowest priority
    ...coreEntities, // core framework entities
    ...themes.flatMap(theme => theme.entities ?? []), // highest priority (can override core)
  ]
  const byName = new Map()
  for (const entity of merged) {
    if (byName.has(entity.name)) onOverride?.(entity, byName.get(entity.name))
    byName.set(entity.name, entity)
  }
  return Array.from(byName.values())
}

/**
 * Discover and merge every entity of the project described by `config` (`getConfig()`).
 * `includeCore: false` leaves core's own entities out (the host serves those with core's own routes).
 */
export async function discoverAllEntities(config, { includeCore = true } = {}) {
  const [plugins, coreEntities, themes] = await Promise.all([
    discoverPlugins(config),
    includeCore ? discoverCoreEntities(config) : [],
    discoverThemes(config),
  ])
  return mergeEntities({ plugins, coreEntities, themes })
}
