/**
 * Discovery Module - Orchestrates content discovery
 *
 * Runs all discovery functions in parallel and aggregates results.
 *
 * @module core/scripts/build/registry/discovery
 */

// Re-export individual discovery functions
export { discoverPlugins, discoverRouteFiles } from './plugins.mjs'
export { discoverEntities, discoverNestedEntities } from './entities.mjs'
export { discoverThemes, discoverThemeRouteFiles } from './themes.mjs'
export { discoverTemplates, discoverThemeTemplates } from './templates.mjs'
export { discoverBlocks } from './blocks.mjs'
export { discoverMiddlewares } from './middlewares.mjs'
export { discoverPermissionsConfig } from './permissions.mjs'
export { discoverAuthConfig } from './auth.mjs'
export { discoverParentChildRelations } from './parent-child.mjs'
export { discoverCoreRoutes } from './core-routes.mjs'
