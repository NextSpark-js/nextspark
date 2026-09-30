/**
 * Post-Build Module - Tasks that run after registry generation
 *
 * Handles test fixtures and tree display.
 *
 * @module core/scripts/build/registry/post-build
 */

export { displayTreeStructure } from './tree-display.mjs'
export { generateTestEntitiesJson, generateTestBlocksJson, extractEntityTestData } from './test-fixtures.mjs'
