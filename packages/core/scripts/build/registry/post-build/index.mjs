/**
 * Post-Build Module - Tasks that run after registry generation
 *
 * Handles page generation, cleanup, test fixtures, and tree display.
 *
 * @module core/scripts/build/registry/post-build
 */

export { generateMissingPages, generateTemplatePage } from './page-generator.mjs'
export { displayTreeStructure } from './tree-display.mjs'
export { generateTestEntitiesJson, generateTestBlocksJson, extractEntityTestData } from './test-fixtures.mjs'
export {
  cleanupOldRouteFiles,
  cleanupOrphanedTemplates,
  mapTemplateToAppPath,
  cleanupDeletedTemplate
} from './route-cleanup.mjs'
