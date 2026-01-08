/**
 * Entity Validator
 *
 * Validates entity configurations during build
 *
 * @module core/scripts/build/registry/validation/entity-validator
 */

import { CONFIG } from '../config.mjs'
import { verbose } from '../../../utils/index.mjs'
import { validateBuilderEntityConfig, validateTaxonomiesConfig } from '../../../../dist/lib/entities/schema-generator.js'

/**
 * Validate all entity configurations
 * Ensures all entities have required fields
 * @param {Array} entities - All discovered entities
 * @returns {Promise<void>}
 */
export async function validateEntityConfigurations(entities) {
  for (const entity of entities) {
    // Load the actual config to check access.shared
    try {
      const configModule = await import(entity.configPath)
      const config = configModule[entity.exportName]

      if (!config || !config.access) {
        continue // Skip validation for entities without config/access
      }

      // PHASE 3 CRITICAL VALIDATION: access.shared must be defined
      if (config.access.shared === undefined) {
        console.error(`\n[Registry Error] Entity "${entity.name}" is missing required field: access.shared`)
        console.error(`   Location: ${entity.configPath}`)
        console.error(`   Add to your ${entity.name}.config.ts:`)
        console.error(`   access: {`)
        console.error(`     ...`)
        console.error(`     shared: true,  // or false for user-private data`)
        console.error(`   }`)
        console.error(``)
        process.exit(1) // Fail the build
      }

      // BUILDER CONFIG VALIDATION: If builder.enabled, validate required fields
      if (config.builder?.enabled) {
        const builderErrors = validateBuilderEntityConfig(config)
        if (builderErrors.length > 0) {
          console.error(`\n[Registry Error] Entity "${entity.name}" has invalid builder configuration:`)
          console.error(`   Location: ${entity.configPath}`)
          builderErrors.forEach(error => {
            console.error(`   - ${error}`)
          })
          console.error(``)
          process.exit(1) // Fail the build
        }

        if (CONFIG.verbose) {
          verbose(`   [builder] Entity "${entity.name}" - Page builder enabled`)
        }
      }

      // TAXONOMIES CONFIG VALIDATION: If taxonomies.enabled, validate types
      if (config.taxonomies?.enabled) {
        const taxonomiesErrors = validateTaxonomiesConfig(config)
        if (taxonomiesErrors.length > 0) {
          console.error(`\n[Registry Error] Entity "${entity.name}" has invalid taxonomies configuration:`)
          console.error(`   Location: ${entity.configPath}`)
          taxonomiesErrors.forEach(error => {
            console.error(`   - ${error}`)
          })
          console.error(``)
          process.exit(1) // Fail the build
        }

        if (CONFIG.verbose) {
          const typesList = config.taxonomies.types.map(t => t.type).join(', ')
          verbose(`   [taxonomies] Entity "${entity.name}" - Types: ${typesList}`)
        }
      }

      // Log informative message about entity access mode
      if (CONFIG.verbose) {
        const sharedLabel = config.access.shared === true ? 'shared' : 'private'
        const description = config.access.shared === true
          ? 'Data visible to all team members'
          : 'Data visible only to creator'
        verbose(`   [${sharedLabel}] Entity "${entity.name}" - ${description}`)
      }

    } catch (error) {
      if (CONFIG.verbose) {
        verbose(`   Could not validate entity "${entity.name}": ${error.message}`)
      }
    }
  }
}
