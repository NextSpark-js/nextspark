/**
 * Billing Registry Generator
 *
 * Generates billing-registry.ts
 *
 * @module core/scripts/build/registry/generators/billing-registry
 */

import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'
// Resolve jiti via createRequire (its CommonJS build) instead of a static ESM
// `import { createJiti } from 'jiti'`. Depending on the node_modules layout
// (e.g. pnpm monorepo hoisting) Node may resolve jiti's CJS build, where the
// named ESM export isn't statically detectable ("Named export 'createJiti' not
// found"). The CJS entry reliably exposes createJiti across all layouts.
const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')

import { log } from '../../../utils/index.mjs'
import { convertCorePath } from '../config.mjs'

/**
 * Build features matrix from billing config at build time
 * This is the same logic as before, but executed during build
 *
 * @param {Object} config - Billing config
 * @returns {Object} Features and limits matrix
 */
function buildBillingMatrix(config) {
  const matrix = {
    features: {},
    limits: {},
  }

  const allFeatureSlugs = Object.keys(config.features)
  const allLimitSlugs = Object.keys(config.limits)

  // Build feature matrix
  for (const featureSlug of allFeatureSlugs) {
    matrix.features[featureSlug] = {}
    for (const plan of config.plans) {
      const hasFeature = plan.features.includes('*') || plan.features.includes(featureSlug)
      matrix.features[featureSlug][plan.slug] = hasFeature
    }
  }

  // Build limit matrix
  for (const limitSlug of allLimitSlugs) {
    matrix.limits[limitSlug] = {}
    for (const plan of config.plans) {
      matrix.limits[limitSlug][plan.slug] = plan.limits[limitSlug] ?? 0
    }
  }

  return matrix
}

/**
 * Generate empty billing registry when no config is available
 *
 * @param {object} config - Configuration object from getConfig()
 * @returns {string} Generated TypeScript content
 */
function generateEmptyBillingRegistry(config) {
  const outputFilePath = join(config.outputDir, 'billing-registry.ts')
  const typesImport = convertCorePath('@/core/lib/billing/config-types', outputFilePath, config)

  return `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// No billing config found - empty registry generated
// To add billing: create config/billing.config.ts

import type { BillingConfig, FeatureDefinition, LimitDefinition, PlanDefinition } from '${typesImport}'

export const BILLING_REGISTRY: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',
  features: {},
  limits: {},
  plans: [],
  actionMappings: { permissions: {}, features: {}, limits: {} }
}

export const BILLING_MATRIX = {
  features: {},
  limits: {}
} as const

export const PUBLIC_PLANS: readonly PlanDefinition[] = []

export const BILLING_METADATA = {
  totalPlans: 0,
  publicPlans: 0,
  totalFeatures: 0,
  totalLimits: 0,
  theme: 'none'
} as const

export type { BillingConfig, PlanDefinition, FeatureDefinition, LimitDefinition }
`
}

/** Generate the billing registry from project config/billing.config.ts. */
export async function generateBillingRegistry(configOrName, _legacyContentsDir, legacyConfig) {
  const config = legacyConfig || configOrName
  const themeName = config.projectName || 'project'
  const absolutePath = join(config.projectSourceDir || config.projectRoot, 'config', 'billing.config.ts')

  if (!existsSync(absolutePath)) {
    log('No project billing config found; using the empty registry', 'warning')
    return generateEmptyBillingRegistry(config)
  }

  // Dynamically import the billing config at build time
  let billingConfig
  try {
    // Use jiti to import .ts files at build time (Node.js can't import .ts natively)
    const jiti = createJiti(import.meta.url, { interopDefault: true, fsCache: false })
    const module = await jiti.import(absolutePath)
    billingConfig = module.billingConfig || module.default
  } catch (error) {
    log(`Failed to import billing config from ${absolutePath}: ${error.message}`, 'error')
    return generateEmptyBillingRegistry(config)
  }

  // Pre-compute everything at build time
  const matrix = buildBillingMatrix(billingConfig)
  const publicPlans = billingConfig.plans.filter(p => p.visibility === 'public')

  const metadata = {
    totalPlans: billingConfig.plans.length,
    publicPlans: publicPlans.length,
    totalFeatures: Object.keys(billingConfig.features).length,
    totalLimits: Object.keys(billingConfig.limits).length,
    theme: themeName,
  }

  // Generate static output with JSON literals
  const outputFilePath = join(config.outputDir, 'billing-registry.ts')
  const typesImport = convertCorePath('@/core/lib/billing/config-types', outputFilePath, config)

  return `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Project: ${themeName}
// To regenerate: node scripts/build-registry.mjs
//
// This file contains the billing config for the project.
// All matrices and metadata are pre-computed at build time.
//
// Query functions: @nextsparkjs/core/lib/billing/queries
// Import from there for planHasFeature, getPlan, etc.

import type { BillingConfig, FeatureDefinition, LimitDefinition, PlanDefinition } from '${typesImport}'

// Import only the project's billing config
import { billingConfig } from '@/config/billing.config'

// Export the project's billing config
export const BILLING_REGISTRY: BillingConfig = billingConfig

// ============================================================================
// PRE-COMPUTED BILLING FEATURES MATRIX (Build-time generated)
// ============================================================================

/**
 * Features matrix type for O(1) lookups
 */
interface FeaturesMatrix {
  /** Feature slug -> Plan slug -> boolean (has feature) */
  features: Record<string, Record<string, boolean>>
  /** Limit slug -> Plan slug -> value (-1 = unlimited) */
  limits: Record<string, Record<string, number>>
}

/**
 * Pre-computed features matrix for O(1) lookups
 * - features[featureSlug][planSlug] = boolean
 * - limits[limitSlug][planSlug] = number (-1 = unlimited)
 */
export const BILLING_MATRIX: FeaturesMatrix = ${JSON.stringify(matrix, null, 2)}

// ============================================================================
// PRE-COMPUTED PUBLIC PLANS (Build-time generated)
// ============================================================================

/**
 * Pre-filtered list of public plans for pricing pages
 */
export const PUBLIC_PLANS: readonly PlanDefinition[] = BILLING_REGISTRY.plans.filter(p => p.visibility === 'public')

// ============================================================================
// PRE-COMPUTED METADATA (Build-time generated)
// ============================================================================

/**
 * Billing metadata for the project
 */
export const BILLING_METADATA = ${JSON.stringify(metadata, null, 2)} as const

// ============================================================================
// Type Exports
// ============================================================================

export type { BillingConfig, PlanDefinition, FeatureDefinition, LimitDefinition }
`
}
