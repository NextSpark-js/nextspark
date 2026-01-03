/**
 * Plan Service
 *
 * Provides core plan management functions including database queries
 * and registry-based configuration lookups.
 *
 * @module PlanService
 */

import { queryOneWithRLS, queryWithRLS } from '../db'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { Plan } from '../billing/types'
import type { PlanDefinition } from '../billing/config-types'

// ===========================================
// TYPES
// ===========================================

export interface ListPlansOptions {
  /** Include hidden plans (default: false) */
  includeHidden?: boolean
}

// ===========================================
// SERVICE
// ===========================================

export class PlanService {
  // ===========================================
  // DATABASE QUERIES
  // ===========================================

  /**
   * Get plan by ID
   *
   * @param id - Plan ID
   * @returns Plan or null if not found
   *
   * @example
   * const plan = await PlanService.getById('plan-uuid-123')
   */
  static async getById(id: string): Promise<Plan | null> {
    if (!id || id.trim() === '') {
      throw new Error('Plan ID is required')
    }

    const plan = await queryOneWithRLS<Plan>(
      'SELECT * FROM "plans" WHERE id = $1',
      [id]
    )

    return plan
  }

  /**
   * Get plan by slug
   *
   * @param slug - Plan slug (e.g., 'free', 'pro', 'enterprise')
   * @returns Plan or null if not found
   *
   * @example
   * const plan = await PlanService.getBySlug('pro')
   */
  static async getBySlug(slug: string): Promise<Plan | null> {
    if (!slug || slug.trim() === '') {
      throw new Error('Plan slug is required')
    }

    const plan = await queryOneWithRLS<Plan>(
      'SELECT * FROM "plans" WHERE slug = $1',
      [slug]
    )

    return plan
  }

  /**
   * Get all plans
   *
   * @param options - List options (includeHidden)
   * @returns Array of plans ordered by sortOrder
   *
   * @example
   * // Get public plans only
   * const plans = await PlanService.list()
   *
   * // Get all plans including hidden
   * const allPlans = await PlanService.list({ includeHidden: true })
   */
  static async list(options: ListPlansOptions = {}): Promise<Plan[]> {
    const { includeHidden = false } = options

    if (includeHidden) {
      return queryWithRLS<Plan>(
        'SELECT * FROM "plans" ORDER BY "sortOrder" ASC'
      )
    }

    return queryWithRLS<Plan>(
      `SELECT * FROM "plans" WHERE visibility = 'public' ORDER BY "sortOrder" ASC`
    )
  }

  /**
   * Get the default plan (typically 'free')
   * Uses the defaultPlan from billing registry configuration
   *
   * @returns Default plan or null if not found
   *
   * @example
   * const freePlan = await PlanService.getDefault()
   */
  static async getDefault(): Promise<Plan | null> {
    const defaultSlug = BILLING_REGISTRY.defaultPlan || 'free'
    return this.getBySlug(defaultSlug)
  }

  /**
   * Check if a plan exists by slug
   *
   * @param slug - Plan slug to check
   * @returns True if plan exists, false otherwise
   *
   * @example
   * const exists = await PlanService.exists('enterprise')
   */
  static async exists(slug: string): Promise<boolean> {
    if (!slug || slug.trim() === '') {
      return false
    }

    const plan = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "plans" WHERE slug = $1 LIMIT 1',
      [slug]
    )

    return !!plan
  }

  // ===========================================
  // REGISTRY HELPERS (Synchronous)
  // ===========================================

  /**
   * Get plan configuration from billing registry
   * This is the static config, not the database record
   *
   * @param slug - Plan slug
   * @returns Plan definition from registry or null
   *
   * @example
   * const config = PlanService.getConfig('pro')
   * console.log(config?.features) // ['feature1', 'feature2']
   */
  static getConfig(slug: string): PlanDefinition | null {
    if (!slug || slug.trim() === '') {
      return null
    }

    const config = BILLING_REGISTRY.plans.find(p => p.slug === slug)
    return config || null
  }

  /**
   * Get features for a plan from registry
   *
   * @param slug - Plan slug
   * @returns Array of feature slugs or empty array
   *
   * @example
   * const features = PlanService.getFeatures('pro')
   * // ['advanced_analytics', 'custom_branding', ...]
   */
  static getFeatures(slug: string): string[] {
    const config = this.getConfig(slug)
    if (!config) {
      return []
    }

    // If features is ['*'], return all feature slugs
    if (config.features.includes('*')) {
      return Object.keys(BILLING_REGISTRY.features)
    }

    return config.features
  }

  /**
   * Get limits for a plan from registry
   *
   * @param slug - Plan slug
   * @returns Object mapping limit slugs to values (-1 = unlimited)
   *
   * @example
   * const limits = PlanService.getLimits('pro')
   * // { projects: 100, api_calls: 10000, storage_mb: 5120 }
   */
  static getLimits(slug: string): Record<string, number> {
    const config = this.getConfig(slug)
    if (!config) {
      return {}
    }

    return config.limits
  }

  /**
   * Get a specific limit value for a plan
   *
   * @param slug - Plan slug
   * @param limitSlug - Limit slug to get
   * @returns Limit value (-1 = unlimited, 0 if not found)
   *
   * @example
   * const maxProjects = PlanService.getLimit('pro', 'projects')
   * // 100
   */
  static getLimit(slug: string, limitSlug: string): number {
    const limits = this.getLimits(slug)
    return limits[limitSlug] ?? 0
  }

  /**
   * Check if a plan has a specific feature
   *
   * @param slug - Plan slug
   * @param featureSlug - Feature slug to check
   * @returns True if plan has the feature
   *
   * @example
   * const hasAnalytics = PlanService.hasFeature('pro', 'advanced_analytics')
   */
  static hasFeature(slug: string, featureSlug: string): boolean {
    const features = this.getFeatures(slug)
    return features.includes(featureSlug)
  }

  // ===========================================
  // COMPARISON HELPERS
  // ===========================================

  /**
   * Check if changing from one plan to another is an upgrade
   * Based on price comparison (higher price = upgrade)
   *
   * @param fromSlug - Current plan slug
   * @param toSlug - Target plan slug
   * @returns True if it's an upgrade, false if downgrade or same
   *
   * @example
   * const isUpgrade = PlanService.isUpgrade('free', 'pro') // true
   * const isDowngrade = PlanService.isUpgrade('pro', 'free') // false
   */
  static isUpgrade(fromSlug: string, toSlug: string): boolean {
    const fromConfig = this.getConfig(fromSlug)
    const toConfig = this.getConfig(toSlug)

    if (!fromConfig || !toConfig) {
      return false
    }

    const fromPrice = fromConfig.price?.monthly ?? 0
    const toPrice = toConfig.price?.monthly ?? 0

    return toPrice > fromPrice
  }

  /**
   * Get all plan slugs from registry
   *
   * @returns Array of plan slugs
   *
   * @example
   * const slugs = PlanService.getAllSlugs()
   * // ['free', 'pro', 'enterprise']
   */
  static getAllSlugs(): string[] {
    return BILLING_REGISTRY.plans.map(p => p.slug)
  }

  /**
   * Get price for a plan in a specific interval
   *
   * @param slug - Plan slug
   * @param interval - 'monthly' or 'yearly'
   * @returns Price in cents or null if free/not found
   *
   * @example
   * const monthlyPrice = PlanService.getPrice('pro', 'monthly')
   * // 2900 (cents)
   */
  static getPrice(slug: string, interval: 'monthly' | 'yearly'): number | null {
    const config = this.getConfig(slug)
    if (!config || !config.price) {
      return null
    }

    return interval === 'yearly' ? config.price.yearly : config.price.monthly
  }

  /**
   * Get Stripe price ID for a plan
   *
   * @param slug - Plan slug
   * @param interval - 'monthly' or 'yearly'
   * @returns Stripe price ID or null
   *
   * @example
   * const priceId = PlanService.getStripePriceId('pro', 'monthly')
   */
  static getStripePriceId(slug: string, interval: 'monthly' | 'yearly'): string | null {
    const config = this.getConfig(slug)
    if (!config) {
      return null
    }

    return interval === 'yearly'
      ? config.stripePriceIdYearly || null
      : config.stripePriceIdMonthly || null
  }
}
