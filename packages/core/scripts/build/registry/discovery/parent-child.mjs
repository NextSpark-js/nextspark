/**
 * Parent-Child Discovery
 *
 * Discovers parent-child relationships between entities dynamically
 * by scanning the filesystem for entities with /children directories.
 *
 * @module core/scripts/build/registry/discovery/parent-child
 */

import { readdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'

// Cached discovery data (singleton pattern)
let _discoveredParentData = null

/**
 * Discover parent-child relationships between entities
 * Must be called before entity discovery to initialize the cache
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<{parentEntities: string[], childTypeMappings: object}>}
 */
export async function discoverParentChildRelations(config = DEFAULT_CONFIG) {
  if (_discoveredParentData) return _discoveredParentData

  const discoveredParents = new Set()
  const childTypeMappings = new Map()

  // Scan all discovered entities to find parent-child patterns in filesystem
  const scanDirs = [
    config.themesDir,
    config.pluginsDir,
    join(config.contentsDir, 'entities')
  ]

  for (const baseDir of scanDirs) {
    if (!existsSync(baseDir)) continue

    try {
      await scanForParentChildPatterns(baseDir, discoveredParents, childTypeMappings)
    } catch (error) {
      // Skip directories that can't be read
      continue
    }
  }

  _discoveredParentData = {
    parentEntities: Array.from(discoveredParents),
    childTypeMappings: Object.fromEntries(childTypeMappings)
  }

  return _discoveredParentData
}

/**
 * Scan directory structure to discover parent-child patterns dynamically
 * @param {string} baseDir - Base directory to scan
 * @param {Set} discoveredParents - Set of discovered parent entity names
 * @param {Map} childTypeMappings - Map of child type singular -> plural mappings
 */
export async function scanForParentChildPatterns(baseDir, discoveredParents, childTypeMappings) {
  const entities = await readdir(baseDir, { withFileTypes: true })

  for (const entity of entities) {
    if (!entity.isDirectory()) continue

    const entityPath = join(baseDir, entity.name)
    const childPath = join(entityPath, 'children') // Only 'children' accepted

    // Check if this is a parent entity with children directory
    if (existsSync(childPath)) {
      // This entity is a parent - add to discovered parents
      discoveredParents.add(entity.name)

      // Discover child types and their mappings from actual config files
      try {
        await discoverChildTypeMappings(childPath, entity.name, childTypeMappings)
      } catch (error) {
        // Continue even if child discovery fails
      }
    } else {
      // Recursively scan subdirectories (for themes/plugins/etc)
      try {
        await scanForParentChildPatterns(entityPath, discoveredParents, childTypeMappings)
      } catch (error) {
        // Skip directories that can't be read
        continue
      }
    }
  }
}

/**
 * Discover child type mappings from actual config files
 * @param {string} childPath - Path to children directory
 * @param {string} parentName - Name of parent entity
 * @param {Map} childTypeMappings - Map to populate with mappings
 */
export async function discoverChildTypeMappings(childPath, parentName, childTypeMappings) {
  const childEntities = await readdir(childPath, { withFileTypes: true })

  for (const child of childEntities) {
    if (!child.isDirectory()) continue

    // Look for config file to determine proper child type mapping
    const configFiles = [
      join(childPath, child.name, child.name + '.config.ts'),
      join(childPath, child.name, 'config.ts'),
      join(childPath, child.name, child.name + '.config.js')
    ]

    for (const configFile of configFiles) {
      if (existsSync(configFile)) {
        // Found config - map singular to plural
        const singular = child.name
        const plural = singular.endsWith('s') ? singular : singular + 's'

        // Handle common irregular plurals
        const irregularPlurals = {
          'person': 'people',
          'child': 'children',
          'foot': 'feet',
          'tooth': 'teeth',
          'goose': 'geese',
          'mouse': 'mice'
        }

        const finalPlural = irregularPlurals[singular] || plural
        childTypeMappings.set(singular, finalPlural)
        break
      }
    }
  }
}

/**
 * Parse child entity information - now fully dynamic
 * Uses pre-computed discovery data for synchronous operation
 * @param {string} entityType - Entity type to parse (e.g., "teams_member")
 * @returns {{isChild: boolean, parentEntity?: string, childType?: string}}
 */
export function parseChildEntity(entityType) {
  // Use pre-computed discovery data (initialized at script start)
  if (!_discoveredParentData) {
    throw new Error('Parent-child discovery not initialized. Call discoverParentChildRelations() first.')
  }

  const { parentEntities, childTypeMappings } = _discoveredParentData

  // Check against discovered parent entities (not hardcoded list)
  for (const parent of parentEntities) {
    if (entityType.startsWith(parent + '_')) {
      const childSingular = entityType.substring(parent.length + 1) // Remove "parent_"

      // Use discovered child type mappings (not hardcoded mappings)
      const childType = childTypeMappings[childSingular] || childSingular + 's'

      return {
        isChild: true,
        parentEntity: parent,
        childType
      }
    }
  }

  return { isChild: false }
}

/**
 * Reset the discovery cache (useful for testing)
 */
export function resetParentChildCache() {
  _discoveredParentData = null
}

/**
 * Get the current discovery data (for debugging)
 * @returns {object|null}
 */
export function getDiscoveredParentData() {
  return _discoveredParentData
}
