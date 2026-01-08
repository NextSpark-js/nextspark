/**
 * Generators Module - Orchestrates registry file generation
 *
 * Generates all registry files from discovered content.
 *
 * @module core/scripts/build/registry/generators
 */

// Re-export individual generators
export { generatePluginRegistry, generatePluginRegistryClient } from './plugin-registry.mjs'
export { generateEntityRegistry, generateEntityRegistryClient } from './entity-registry.mjs'
export { generateThemeRegistry } from './theme-registry.mjs'
export { generateTemplateRegistry, generateTemplateRegistryClient } from './template-registry.mjs'
export { generateBlockRegistry } from './block-registry.mjs'
export { generateMiddlewareRegistry } from './middleware-registry.mjs'
export { generateTranslationRegistry } from './translation-registry.mjs'
export { generateRouteHandlersRegistry } from './route-handlers.mjs'
export { generateScopeRegistry } from './scope-registry.mjs'
export { generateNamespaceRegistry } from './namespace-registry.mjs'
export { generateBillingRegistry } from './billing-registry.mjs'
export { generatePermissionsRegistry } from './permissions-registry.mjs'
export { generateEntityTypes } from './entity-types.mjs'
export { generateAuthRegistry } from './auth-registry.mjs'
export { generateUnifiedRegistry } from './unified-registry.mjs'
export { generateFeatureRegistry, generateFeatureRegistryFull, generateTagsRegistryJson } from './feature-registry.mjs'
