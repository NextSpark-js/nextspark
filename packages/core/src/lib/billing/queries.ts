/**
 * Billing Queries
 *
 * Query functions for the Billing Registry.
 * These operate on the auto-generated BILLING_REGISTRY data.
 *
 * @module core/lib/billing/queries
 */

import {
  BILLING_REGISTRY,
  BILLING_MATRIX,
  BILLING_METADATA,
  PUBLIC_PLANS
} from '@nextsparkjs/registries/billing-registry'
import type {
  BillingConfig,
  PlanDefinition,
  FeatureDefinition,
  LimitDefinition
} from './config-types'

// Re-export types and interfaces
export interface FullBillingMatrix {
  plans: PlanDefinition[]
  features: Record<string, FeatureDefinition>
  limits: Record<string, LimitDefinition>
  matrix: typeof BILLING_MATRIX
  metadata: typeof BILLING_METADATA
}

/**
 * Check if a plan has a specific feature - O(1)
 */
export function planHasFeature(planSlug: string, featureSlug: string): boolean {
  const features = BILLING_MATRIX.features as Record<string, Record<string, boolean> | undefined>
  return features[featureSlug]?.[planSlug] ?? false
}

/**
 * Get limit value for a plan - O(1)
 * Returns -1 for unlimited, 0 if not defined
 */
export function getPlanLimit(planSlug: string, limitSlug: string): number {
  const limits = BILLING_MATRIX.limits as Record<string, Record<string, number> | undefined>
  return limits[limitSlug]?.[planSlug] ?? 0
}

/**
 * Get all features for a plan - O(n) where n = features
 */
export function getPlanFeatures(planSlug: string): string[] {
  const features = BILLING_MATRIX.features as Record<string, Record<string, boolean>>
  return Object.entries(features)
    .filter(([, plans]) => plans[planSlug])
    .map(([featureSlug]) => featureSlug)
}

/**
 * Get all limits for a plan - O(n)
 */
export function getPlanLimits(planSlug: string): Record<string, number> {
  const matrixLimits = BILLING_MATRIX.limits as Record<string, Record<string, number>>
  const limits: Record<string, number> = {}
  for (const [limitSlug, plans] of Object.entries(matrixLimits)) {
    limits[limitSlug] = plans[planSlug] ?? 0
  }
  return limits
}

/**
 * Get full matrix for UI components - O(1)
 */
export function getFullBillingMatrix(): FullBillingMatrix {
  return {
    plans: BILLING_REGISTRY.plans,
    features: BILLING_REGISTRY.features,
    limits: BILLING_REGISTRY.limits,
    matrix: BILLING_MATRIX,
    metadata: BILLING_METADATA,
  }
}

/**
 * Get plan by slug - O(n) but plans are typically < 10
 */
export function getPlan(slug: string): PlanDefinition | undefined {
  return BILLING_REGISTRY.plans.find(p => p.slug === slug)
}

/**
 * Get public plans (for pricing pages) - O(1) pre-computed
 */
export function getPublicPlans(): readonly PlanDefinition[] {
  return PUBLIC_PLANS
}

// Re-export for convenience
export {
  BILLING_REGISTRY,
  BILLING_MATRIX,
  BILLING_METADATA,
  PUBLIC_PLANS
}
