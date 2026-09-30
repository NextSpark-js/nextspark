/**
 * Registry Build Module
 *
 * Main entry point for the registry build process.
 * Orchestrates discovery, generation, and post-build tasks.
 *
 * @module core/scripts/build/registry
 */

// Configuration
export { CONFIG, CONTENT_TYPES, rootDir } from './config.mjs'

// Discovery functions
export {
  discoverPlugins,
  discoverRouteFiles,
  discoverEntities,
  discoverNestedEntities,
  discoverThemes,
  discoverThemeRouteFiles,
  discoverBlocks,
  discoverMiddlewares,
  discoverPermissionsConfig,
  discoverAuthConfig,
  discoverParentChildRelations
} from './discovery/index.mjs'

// Generators
export {
  generatePluginRegistry,
  generatePluginRegistryClient,
  generatePluginCatalog,
  generateEntityRegistry,
  generateEntityRegistryClient,
  generateThemeRegistry,
  generateThemeRegistryClient,
  generateAppConfigClient,
  generateBlockRegistry,
  generateMiddlewareRegistry,
  generateTranslationRegistry,
  generateRouteHandlersRegistry,
  generateScopeRegistry,
  generateNamespaceRegistry,
  generateBillingRegistry,
  generatePermissionsRegistry,
  generateEntityTypes,
  generateAuthRegistry,
  generateUnifiedRegistry
} from './generators/index.mjs'

// Post-build tasks
export {
  displayTreeStructure,
  generateTestEntitiesJson,
  extractEntityTestData
} from './post-build/index.mjs'

// Validation
export { validateEntityConfigurations } from './validation/entity-validator.mjs'

/**
 * Build all registries
 *
 * Main build function that orchestrates the entire process:
 * 1. Discover content
 * 2. Validate configurations
 * 3. Generate registry files
 * 4. Run post-build tasks
 *
 * @returns {Promise<void>}
 */
export async function buildRegistries() {
  // TODO: Migrate from registry.mjs lines 4224-4353 (buildRegistries)
  throw new Error('buildRegistries() not yet migrated - use registry.mjs directly')
}
