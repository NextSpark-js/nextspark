/**
 * Plan Service
 *
 * Provides core plan management functions including database queries
 * and registry-based configuration lookups.
 *
 * @module PlanService
 */
import type { Plan } from '../billing/types';
import type { PlanDefinition } from '../billing/config-types';
export interface ListPlansOptions {
    /** Include hidden plans (default: false) */
    includeHidden?: boolean;
}
export declare class PlanService {
    /**
     * Get plan by ID
     *
     * @param id - Plan ID
     * @returns Plan or null if not found
     *
     * @example
     * const plan = await PlanService.getById('plan-uuid-123')
     */
    static getById(id: string): Promise<Plan | null>;
    /**
     * Get plan by slug
     *
     * @param slug - Plan slug (e.g., 'free', 'pro', 'enterprise')
     * @returns Plan or null if not found
     *
     * @example
     * const plan = await PlanService.getBySlug('pro')
     */
    static getBySlug(slug: string): Promise<Plan | null>;
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
    static list(options?: ListPlansOptions): Promise<Plan[]>;
    /**
     * Get the default plan (typically 'free')
     * Uses the defaultPlan from billing registry configuration
     *
     * @returns Default plan or null if not found
     *
     * @example
     * const freePlan = await PlanService.getDefault()
     */
    static getDefault(): Promise<Plan | null>;
    /**
     * Check if a plan exists by slug
     *
     * @param slug - Plan slug to check
     * @returns True if plan exists, false otherwise
     *
     * @example
     * const exists = await PlanService.exists('enterprise')
     */
    static exists(slug: string): Promise<boolean>;
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
    static getConfig(slug: string): PlanDefinition | null;
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
    static getFeatures(slug: string): string[];
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
    static getLimits(slug: string): Record<string, number>;
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
    static getLimit(slug: string, limitSlug: string): number;
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
    static hasFeature(slug: string, featureSlug: string): boolean;
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
    static isUpgrade(fromSlug: string, toSlug: string): boolean;
    /**
     * Get all plan slugs from registry
     *
     * @returns Array of plan slugs
     *
     * @example
     * const slugs = PlanService.getAllSlugs()
     * // ['free', 'pro', 'enterprise']
     */
    static getAllSlugs(): string[];
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
    static getPrice(slug: string, interval: 'monthly' | 'yearly'): number | null;
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
    static getStripePriceId(slug: string, interval: 'monthly' | 'yearly'): string | null;
}
//# sourceMappingURL=plan.service.d.ts.map