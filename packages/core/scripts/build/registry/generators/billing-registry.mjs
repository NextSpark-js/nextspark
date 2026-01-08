/**
 * Billing Registry Generator
 *
 * Generates billing-registry.ts
 *
 * @module core/scripts/build/registry/generators/billing-registry
 */

import { existsSync } from 'fs'
import { join } from 'path'

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
// To add billing: create contents/themes/{theme}/config/billing.config.ts

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

/**
 * Generate billing registry from active theme's billing config
 * Pre-computes features matrix, public plans, and metadata at build time
 *
 * PATTERN: Data-only registry (consistent with entity-registry)
 * - Only imports the active theme's billing config
 * - All matrices and metadata are pre-computed as JSON literals
 * - No functions in generated code
 *
 * @param {string} activeTheme - Active theme name
 * @param {string} contentsDir - Contents directory path
 * @param {object} config - Configuration object from getConfig()
 * @returns {Promise<string>} Generated TypeScript content
 */
export async function generateBillingRegistry(activeTheme, contentsDir, config) {
  const themeName = activeTheme || 'default'
  // Use config.themesDir for monorepo support (contentsDir kept for backward compatibility)
  const themesDir = config.themesDir || join(contentsDir, 'themes')
  const billingConfigPath = join(themesDir, themeName, 'config', 'billing.config.ts')

  // Check if billing config exists for active theme
  if (!existsSync(billingConfigPath)) {
    log(`No billing config found for theme '${themeName}', using default`, 'warning')
    // Fall back to default theme
    const defaultPath = join(themesDir, 'default', 'config', 'billing.config.ts')
    if (!existsSync(defaultPath)) {
      log('No billing config found for default theme either!', 'error')
      return generateEmptyBillingRegistry(config)
    }
  }

  // Dynamically import the billing config at build time
  const themePath = existsSync(billingConfigPath) ? themeName : 'default'
  // Use file:// URL for ESM dynamic import
  const absolutePath = join(themesDir, themePath, 'config', 'billing.config.ts')

  let billingConfig
  try {
    const module = await import(`file://${absolutePath}`)
    billingConfig = module.billingConfig
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
    theme: themePath,
  }

  // Generate static output with JSON literals
  const outputFilePath = join(config.outputDir, 'billing-registry.ts')
  const typesImport = convertCorePath('@/core/lib/billing/config-types', outputFilePath, config)

  return `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Active theme: ${themePath}
// To regenerate: node scripts/build-registry.mjs
//
// This file contains the billing config for the active theme.
// All matrices and metadata are pre-computed at build time.
//
// Query functions: @nextsparkjs/core/lib/billing/queries
// Import from there for planHasFeature, getPlan, etc.

import type { BillingConfig, FeatureDefinition, LimitDefinition, PlanDefinition } from '${typesImport}'

// Import only the active theme's billing config
import { billingConfig } from '@/contents/themes/${themePath}/config/billing.config'

// Export the active theme's billing config
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
 * Billing metadata for the active theme
 */
export const BILLING_METADATA = ${JSON.stringify(metadata, null, 2)} as const

// ============================================================================
// Type Exports
// ============================================================================

export type { BillingConfig, PlanDefinition, FeatureDefinition, LimitDefinition }
`
}
