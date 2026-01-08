/**
 * Entity Types Generator
 *
 * Generates entity-types.ts
 *
 * @module core/scripts/build/registry/generators/entity-types
 */

/**
 * Generate the entity types file
 * @param {Array} entities - Discovered entities
 * @param {object} config - Configuration object from getConfig()
 * @returns {string} Generated TypeScript content
 */
export function generateEntityTypes(entities, config) {
  // Extract entity names for union type
  const entityNames = entities.map(entity => `'${entity.name}'`).join(' | ')

  // Extract entity names for array usage
  const entityNamesArray = entities.map(entity => `'${entity.name}'`).join(', ')

  // Extract search priority configurations
  const searchTypeOrder = entities.reduce((acc, entity, index) => {
    // Higher priority for earlier entities (reverse priority)
    const priority = entities.length - index
    acc[entity.name] = priority
    return acc
  }, {})

  // Core system types (these are always available)
  const systemTypes = ['task', 'page', 'setting', 'entity'].map(t => `'${t}'`).join(' | ')

  return `// 🤖 AUTO-GENERATED FILE - DO NOT EDIT
// Generated at: ${new Date().toISOString()}
// Source: scripts/build-registry.mjs

// ==================== Auto-Generated Entity Types ====================

/**
 * All discovered entity names from themes and plugins
 * Auto-generated from registry discovery
 */
export type EntityName = ${entityNames || "'unknown'"}

/**
 * System search result types
 */
export type SystemSearchType = ${systemTypes}

/**
 * Combined search result types (system + entities)
 */
export type SearchResultType = SystemSearchType | EntityName

/**
 * Auto-generated search type priorities for relevance scoring
 * Higher numbers = higher priority in search results
 */
export const SEARCH_TYPE_PRIORITIES: Record<SearchResultType, number> = {
  // System types (fixed priorities)
  'task': 1,
  'setting': 3,
  'page': 5,
  'entity': 7,

  // Auto-generated entity priorities (based on discovery order)
${Object.entries(searchTypeOrder).map(([name, priority]) => `  '${name}': ${priority + 10}`).join(',\n')}
} as const

// ==================== Registry Metadata ====================

// Query functions have been moved to: @nextsparkjs/core/lib/services/entity-type.service
// Import from there instead:
// import { EntityTypeService } from '@nextsparkjs/core/lib/services/entity-type.service'
// - EntityTypeService.isEntityType(type) - Check if type is entity vs system
// - EntityTypeService.getAllNames() - Get all entity names
// - EntityTypeService.getPriority(type) - Get search priority for type

export const ENTITY_METADATA = {
  totalEntities: ${entities.length},
  entityNames: [${entityNamesArray}],
  generatedAt: '${new Date().toISOString()}',
  source: 'build-registry.mjs'
} as const
`
}
