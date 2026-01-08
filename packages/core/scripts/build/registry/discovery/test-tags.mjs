/**
 * Test Tags Discovery
 *
 * Scans Cypress test files to discover all tags in use.
 * Extracts @feat-*, @flow-*, @b-*, and other tags from test files.
 *
 * Tag prefixes:
 * - @feat-{key} - Feature tags (must exist in features.config.ts)
 * - @flow-{key} - Flow tags (must exist in flows.config.ts)
 * - @b-{slug} - Block tags (must exist in block-registry.ts)
 *
 * @module core/scripts/build/registry/discovery/test-tags
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'

/**
 * Regex patterns to find tags in test files
 * Matches: tags: ['@tag1', '@tag2'] or tags: "@tag1" or { tags: ['@tag'] }
 */
const TAG_PATTERNS = [
  /tags:\s*\[\s*([^\]]+)\s*\]/g,
  /tags:\s*['"]([^'"]+)['"]/g,
  /\{\s*tags:\s*\[\s*([^\]]+)\s*\]\s*\}/g,
  /\{\s*tags:\s*['"]([^'"]+)['"]\s*\}/g,
]

/**
 * Find all .cy.ts files recursively
 */
function findTestFiles(dir) {
  const files = []
  if (!existsSync(dir)) return files

  function walk(currentDir) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && /\.cy\.(ts|js)$/.test(entry.name)) {
          files.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  walk(dir)
  return files
}

/**
 * Extract tags from file content
 */
function extractTagsFromContent(content) {
  const tags = new Set()

  for (const pattern of TAG_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    while ((match = regex.exec(content)) !== null) {
      const tagString = match[1]
      const tagMatches = tagString.match(/@[\w-]+/g)
      if (tagMatches) {
        tagMatches.forEach((tag) => tags.add(tag))
      }
    }
  }

  return tags
}

/**
 * Discover all tags from test files
 * @param {string} testsDir - Path to tests directory
 * @param {string} rootDir - Project root for relative paths
 * @returns {Object} Discovered tags with metadata
 */
export function discoverTestTags(testsDir, rootDir) {
  const testFiles = findTestFiles(testsDir)

  // Tag -> { files: [], count: 0 }
  const tagUsage = new Map()

  for (const file of testFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      const fileTags = extractTagsFromContent(content)
      const relativePath = relative(rootDir, file)

      for (const tag of fileTags) {
        if (!tagUsage.has(tag)) {
          tagUsage.set(tag, { files: [], count: 0 })
        }
        const usage = tagUsage.get(tag)
        usage.files.push(relativePath)
        usage.count++
      }
    } catch {
      // Ignore read errors
    }
  }

  // Categorize tags
  const result = {
    features: {},    // @feat-*
    flows: {},       // @flow-*
    blocks: {},      // @b-* (block tests)
    layers: {},      // @api, @uat
    priorities: {},  // @smoke, @sanity, @regression
    roles: {},       // @role-*
    operations: {},  // @crud, @security, etc
    other: {},       // Everything else

    // Metadata
    meta: {
      totalTags: tagUsage.size,
      totalFiles: testFiles.length,
      scannedDir: testsDir,
    }
  }

  // Known category mappings
  const layerTags = ['@api', '@uat']
  const priorityTags = ['@smoke', '@sanity', '@regression']
  const operationTags = ['@crud', '@metas', '@workflow', '@security', '@search', '@block-crud', '@admin']

  for (const [tag, usage] of tagUsage) {
    const tagData = {
      tag,
      testCount: usage.count,
      files: usage.files,
    }

    if (tag.startsWith('@feat-')) {
      const featureKey = tag.replace('@feat-', '')
      result.features[featureKey] = tagData
    } else if (tag.startsWith('@flow-')) {
      const flowKey = tag.replace('@flow-', '')
      result.flows[flowKey] = tagData
    } else if (tag.startsWith('@b-')) {
      const blockSlug = tag.replace('@b-', '')
      result.blocks[blockSlug] = tagData
    } else if (tag.startsWith('@role-')) {
      const roleKey = tag.replace('@role-', '')
      result.roles[roleKey] = tagData
    } else if (layerTags.includes(tag)) {
      result.layers[tag] = tagData
    } else if (priorityTags.includes(tag)) {
      result.priorities[tag] = tagData
    } else if (operationTags.includes(tag)) {
      result.operations[tag] = tagData
    } else {
      result.other[tag] = tagData
    }
  }

  return result
}

/**
 * Validate feature, flow, and block tags against configs
 * @param {Object} discoveredTags - Tags from discoverTestTags
 * @param {Object} featuresConfig - Features from features.config.ts
 * @param {Object} flowsConfig - Flows from flows.config.ts
 * @param {Object} blocksConfig - Blocks from block-registry (slug -> block)
 * @returns {Object} Validation result with errors and warnings
 */
export function validateTags(discoveredTags, featuresConfig, flowsConfig, blocksConfig = {}) {
  const errors = []
  const warnings = []

  // Check for orphan @feat-* tags (in tests but not in config)
  for (const featureKey of Object.keys(discoveredTags.features)) {
    if (!featuresConfig[featureKey]) {
      errors.push({
        type: 'orphan_feature_tag',
        tag: `@feat-${featureKey}`,
        message: `Tag @feat-${featureKey} found in tests but no matching feature in features.config.ts`,
        files: discoveredTags.features[featureKey].files.slice(0, 3),
      })
    }
  }

  // Check for orphan @flow-* tags (in tests but not in config)
  for (const flowKey of Object.keys(discoveredTags.flows)) {
    if (!flowsConfig[flowKey]) {
      errors.push({
        type: 'orphan_flow_tag',
        tag: `@flow-${flowKey}`,
        message: `Tag @flow-${flowKey} found in tests but no matching flow in flows.config.ts`,
        files: discoveredTags.flows[flowKey].files.slice(0, 3),
      })
    }
  }

  // Check for orphan @b-* tags (in tests but block doesn't exist) - ERROR
  for (const blockSlug of Object.keys(discoveredTags.blocks)) {
    if (!blocksConfig[blockSlug]) {
      errors.push({
        type: 'orphan_block_tag',
        tag: `@b-${blockSlug}`,
        message: `Tag @b-${blockSlug} found in tests but no matching block in block-registry`,
        files: discoveredTags.blocks[blockSlug].files.slice(0, 3),
      })
    }
  }

  // Check for features without tests (warning, not error)
  for (const featureKey of Object.keys(featuresConfig)) {
    if (!discoveredTags.features[featureKey]) {
      warnings.push({
        type: 'feature_no_coverage',
        feature: featureKey,
        message: `Feature "${featureKey}" has no tests with @feat-${featureKey} tag`,
      })
    }
  }

  // Check for flows without tests (warning, not error)
  for (const flowKey of Object.keys(flowsConfig)) {
    if (!discoveredTags.flows[flowKey]) {
      warnings.push({
        type: 'flow_no_coverage',
        flow: flowKey,
        message: `Flow "${flowKey}" has no tests with @flow-${flowKey} tag`,
      })
    }
  }

  // NOTE: Blocks without tests do NOT generate warnings (permissive)
  // Many blocks cannot be easily tested with automation

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
