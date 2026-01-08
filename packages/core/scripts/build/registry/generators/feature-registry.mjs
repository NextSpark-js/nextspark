/**
 * Testing Registry Generator
 *
 * Generates testing-registry.ts with:
 * - Features (from features.config.ts)
 * - Flows (from flows.config.ts)
 * - Tags (discovered from test files)
 * - Coverage summary
 *
 * NOTE: Tag keys are stored WITHOUT the @ prefix (e.g., 'smoke' not '@smoke')
 * since the @ is just a convention for grep patterns.
 *
 * @module core/scripts/build/registry/generators/testing-registry
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { discoverTestTags, validateTags } from '../discovery/test-tags.mjs'

/**
 * Transform tag data for registry output
 * - Removes @ prefix from keys
 * - Ensures consistent structure
 * @param {Object} tagData - Raw tag data from discovery
 * @returns {Object} Transformed data
 */
function transformTagsForRegistry(tagData) {
  const result = {}
  for (const [key, value] of Object.entries(tagData)) {
    // Remove @ prefix from keys
    const cleanKey = key.replace(/^@/, '')
    result[cleanKey] = value
  }
  return result
}

/**
 * Stringify object with proper indentation for embedding in template
 * - Removes quotes from simple keys (alphanumeric + underscore)
 * - Keeps quotes for keys with special chars (e.g., "api-key", "page-builder")
 * @param {Object} obj - Object to stringify
 * @param {number} baseIndent - Base indentation level (spaces)
 * @returns {string} Formatted string
 */
function stringifyWithIndent(obj, baseIndent = 2) {
  const json = JSON.stringify(obj, null, 2)
  // Remove quotes from simple property keys (word chars only)
  // Keep quotes for keys with hyphens or special chars
  const cleaned = json.replace(/"(\w+)":/g, '$1:')
  // Add base indentation to all lines except the first
  const indent = ' '.repeat(baseIndent)
  return cleaned.split('\n').map((line, i) => i === 0 ? line : indent + line).join('\n')
}

/**
 * Load block slugs from generated block-registry.ts
 * @param {string} registryDir - Path to registries directory
 * @returns {Object} Map of slug -> { slug, name }
 */
function loadBlockSlugs(registryDir) {
  const registryPath = join(registryDir, 'block-registry.ts')
  if (!existsSync(registryPath)) {
    return {}
  }

  try {
    const content = readFileSync(registryPath, 'utf-8')
    const blocks = {}

    // Extract block entries: 'slug': { slug: 'slug', name: 'Name', ... }
    const slugMatches = content.matchAll(/'([\w-]+)':\s*\{[^}]*slug:\s*'([\w-]+)'[^}]*name:\s*'([^']+)'/g)

    for (const match of slugMatches) {
      const slug = match[2]
      blocks[slug] = {
        slug,
        name: match[3],
      }
    }

    return blocks
  } catch {
    return {}
  }
}

/**
 * Load features config from theme
 * @param {string} themePath - Path to theme directory
 * @returns {Object|null} Features config or null
 */
function loadFeaturesConfig(themePath) {
  const configPath = join(themePath, 'config', 'features.config.ts')
  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = readFileSync(configPath, 'utf-8')
    // Simple extraction - parse the defineFeatures({ ... }) content
    const match = content.match(/defineFeatures\s*\(\s*\{([\s\S]*)\}\s*\)/)
    if (!match) return null

    // Extract feature keys from the config (simplified parsing)
    const features = {}
    const featureMatches = content.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*description:\s*['"]([^'"]+)['"][^}]*category:\s*['"]([^'"]+)['"][^}]*icon:\s*['"]([^'"]+)['"]?/gm)

    for (const m of featureMatches) {
      features[m[1]] = {
        key: m[1],
        name: m[2],
        description: m[3],
        category: m[4],
        icon: m[5],
      }
    }

    // Fallback: simpler regex for keys only
    if (Object.keys(features).length === 0) {
      const keyMatches = content.matchAll(/^\s{2}['"]?([\w-]+)['"]?\s*:\s*\{/gm)
      for (const m of keyMatches) {
        if (!['name', 'description', 'category', 'icon', 'entities', 'permissions', 'docs'].includes(m[1])) {
          features[m[1]] = { key: m[1] }
        }
      }
    }

    return features
  } catch {
    return null
  }
}

/**
 * Load flows config from theme
 * @param {string} themePath - Path to theme directory
 * @returns {Object|null} Flows config or null
 */
function loadFlowsConfig(themePath) {
  const configPath = join(themePath, 'config', 'flows.config.ts')
  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = readFileSync(configPath, 'utf-8')
    const flows = {}

    // Match flow blocks: key: { ... } at root level (2 spaces indent)
    // Use a simple state machine to track brace depth
    const lines = content.split('\n')
    let currentFlow = null
    let braceDepth = 0
    let flowContent = ''

    for (const line of lines) {
      // Match flow key at indent level 2 (within defineFlows({ ... }))
      const flowStart = line.match(/^\s{2}['"]?([\w-]+)['"]?\s*:\s*\{/)
      if (flowStart && braceDepth === 0) {
        const key = flowStart[1]
        // Skip reserved words
        if (!['name', 'description', 'category', 'icon', 'steps', 'features', 'criticalPath'].includes(key)) {
          currentFlow = key
          braceDepth = 1
          flowContent = '{'
          continue
        }
      }

      if (currentFlow) {
        flowContent += line + '\n'
        braceDepth += (line.match(/\{/g) || []).length
        braceDepth -= (line.match(/\}/g) || []).length

        if (braceDepth === 0) {
          // Parse flow properties from flowContent
          const nameMatch = flowContent.match(/name:\s*['"]([^'"]+)['"]/)
          const descMatch = flowContent.match(/description:\s*['"]([^'"]+)['"]/)
          const categoryMatch = flowContent.match(/category:\s*['"]([^'"]+)['"]/)
          const iconMatch = flowContent.match(/icon:\s*['"]([^'"]+)['"]/)
          const criticalMatch = flowContent.match(/criticalPath:\s*(true|false)/)

          flows[currentFlow] = {
            key: currentFlow,
            name: nameMatch?.[1] || currentFlow,
            description: descMatch?.[1] || `Flow: ${currentFlow}`,
            category: categoryMatch?.[1] || 'navigation',
            icon: iconMatch?.[1] || 'workflow',
            criticalPath: criticalMatch?.[1] === 'true',
          }

          currentFlow = null
          flowContent = ''
        }
      }
    }

    return flows
  } catch {
    return null
  }
}

/**
 * Generate feature-registry.ts content
 * @param {Object} features - Features config
 * @param {Object} flows - Flows config
 * @param {Object} discoveredTags - Tags from test scan
 * @param {string} themeName - Active theme name
 * @returns {string} TypeScript content
 */
export function generateFeatureRegistry(features, flows, discoveredTags, themeName) {
  // Build features with coverage
  const featuresWithCoverage = Object.entries(features || {}).map(([key, config]) => {
    const tagData = discoveredTags.features[key]
    return {
      key,
      ...config,
      tag: `feat-${key}`,
      testing: tagData ? {
        hasTests: true,
        testCount: tagData.testCount,
        files: tagData.files,
      } : {
        hasTests: false,
        testCount: 0,
        files: [],
      }
    }
  })

  // Build flows with coverage
  const flowsWithCoverage = Object.entries(flows || {}).map(([key, config]) => {
    const tagData = discoveredTags.flows[key]
    return {
      key,
      ...config,
      tag: `flow-${key}`,
      testing: tagData ? {
        hasTests: true,
        testCount: tagData.testCount,
        files: tagData.files,
      } : {
        hasTests: false,
        testCount: 0,
        files: [],
      }
    }
  })

  // Generate TypeScript
  return `/**
 * Auto-generated Feature Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Features: ${featuresWithCoverage.length}
 * Flows: ${flowsWithCoverage.length}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FeatureTesting {
  hasTests: boolean
  testCount: number
  files: string[]
}

export interface FeatureEntry {
  key: string
  name: string
  description: string
  category: 'core' | 'entities' | 'content' | 'settings' | 'admin' | 'public'
  icon: string
  tag: string
  testing: FeatureTesting
}

export interface FlowEntry {
  key: string
  name: string
  description: string
  category: 'acquisition' | 'navigation' | 'content' | 'settings' | 'admin' | 'public'
  icon: string
  tag: string
  criticalPath?: boolean
  testing: FeatureTesting
}

export interface TagEntry {
  tag: string
  testCount: number
  files: string[]
}

// =============================================================================
// FEATURES REGISTRY
// =============================================================================

export const FEATURE_REGISTRY: Record<string, FeatureEntry> = ${JSON.stringify(
    Object.fromEntries(featuresWithCoverage.map(f => [f.key, f])),
    null,
    2
  ).replace(/"(\w+)":/g, '$1:')}

// =============================================================================
// FLOWS REGISTRY
// =============================================================================

export const FLOW_REGISTRY: Record<string, FlowEntry> = ${JSON.stringify(
    Object.fromEntries(flowsWithCoverage.map(f => [f.key, f])),
    null,
    2
  ).replace(/"(\w+)":/g, '$1:')}

// =============================================================================
// TAGS REGISTRY (all discovered tags)
// =============================================================================

export const TAGS_REGISTRY = {
  features: ${stringifyWithIndent(discoveredTags.features)},
  flows: ${stringifyWithIndent(discoveredTags.flows)},
  blocks: ${stringifyWithIndent(discoveredTags.blocks)},
  layers: ${stringifyWithIndent(transformTagsForRegistry(discoveredTags.layers))},
  priorities: ${stringifyWithIndent(transformTagsForRegistry(discoveredTags.priorities))},
  roles: ${stringifyWithIndent(discoveredTags.roles)},
  operations: ${stringifyWithIndent(transformTagsForRegistry(discoveredTags.operations))},
  other: ${stringifyWithIndent(transformTagsForRegistry(discoveredTags.other))},
} as const

// =============================================================================
// COVERAGE SUMMARY
// =============================================================================

export const COVERAGE_SUMMARY = {
  theme: '${themeName}',
  generatedAt: '${new Date().toISOString()}',
  features: {
    total: ${featuresWithCoverage.length},
    withTests: ${featuresWithCoverage.filter(f => f.testing.hasTests).length},
    withoutTests: ${featuresWithCoverage.filter(f => !f.testing.hasTests).length},
  },
  flows: {
    total: ${flowsWithCoverage.length},
    withTests: ${flowsWithCoverage.filter(f => f.testing.hasTests).length},
    withoutTests: ${flowsWithCoverage.filter(f => !f.testing.hasTests).length},
  },
  tags: {
    total: ${discoveredTags.meta.totalTags},
    testFiles: ${discoveredTags.meta.totalFiles},
  }
} as const

// =============================================================================
// HELPER TYPES
// =============================================================================

export type FeatureKey = keyof typeof FEATURE_REGISTRY
export type FlowKey = keyof typeof FLOW_REGISTRY
export type FeatureCategory = FeatureEntry['category']
export type FlowCategory = FlowEntry['category']
`
}

/**
 * Main generator function - orchestrates the full generation
 * @param {string} themeName - Active theme name
 * @param {string} contentsDir - Path to contents directory (legacy, use config.themesDir instead)
 * @param {string} outputDir - Path for registry output
 * @param {object} config - Optional configuration object from getConfig()
 * @returns {Object} Generation result
 */
export async function generateFeatureRegistryFull(themeName, contentsDir, outputDir, config = null) {
  // Use config.themesDir for monorepo support, fall back to contentsDir/themes
  const themesDir = config?.themesDir || join(contentsDir, 'themes')
  const themePath = join(themesDir, themeName)
  const testsDir = join(themePath, 'tests', 'cypress', 'e2e')

  // Load configs
  const features = loadFeaturesConfig(themePath)
  const flows = loadFlowsConfig(themePath)

  // Load blocks from block-registry (already generated at this point)
  const blocks = loadBlockSlugs(outputDir)

  // Discover tags from tests
  const rootDir = config?.monorepoRoot || join(contentsDir, '..')
  const discoveredTags = discoverTestTags(testsDir, rootDir)

  // Validate (includes block tag validation)
  const validation = validateTags(discoveredTags, features || {}, flows || {}, blocks)

  // Return result (caller handles errors)
  return {
    features,
    flows,
    discoveredTags,
    validation,
    themeName,

    // Generate content
    registryContent: generateFeatureRegistry(features, flows, discoveredTags, themeName),

    // Output paths
    registryPath: join(outputDir, 'testing-registry.ts'),
  }
}
