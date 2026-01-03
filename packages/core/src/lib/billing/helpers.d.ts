/**
 * Billing Helper Functions
 *
 * Utility functions for billing operations including period calculations,
 * percentage calculations, and subscription status checks.
 */
import type { LimitDefinition } from './config-types';
import type { SubscriptionStatus } from './types';
/**
 * Generate period key based on limit reset period
 * Used to track usage within specific time windows
 *
 * @param resetPeriod - The reset period for the limit
 * @returns Period key string (e.g., '2024-01' for monthly, '2024-01-15' for daily)
 */
export declare function getPeriodKey(resetPeriod: LimitDefinition['resetPeriod']): string;
/**
 * Calculate next reset date based on period
 *
 * @param resetPeriod - The reset period for the limit
 * @returns Next reset date or null if period is 'never'
 */
export declare function getNextResetDate(resetPeriod: LimitDefinition['resetPeriod']): Date | null;
/**
 * Calculate percentage used
 *
 * @param current - Current usage value
 * @param max - Maximum allowed value (-1 for unlimited)
 * @returns Percentage used (0-100)
 */
export declare function calculatePercentUsed(current: number, max: number): number;
/**
 * Calculate remaining quota
 *
 * @param current - Current usage value
 * @param max - Maximum allowed value (-1 for unlimited)
 * @returns Remaining quota
 */
export declare function calculateRemaining(current: number, max: number): number;
/**
 * Check if subscription is active (can use features)
 *
 * @param status - Subscription status
 * @returns True if subscription is active
 */
export declare function isSubscriptionActive(status: SubscriptionStatus): boolean;
/**
 * Check if subscription is in trial period
 *
 * @param trialEndsAt - Trial end date
 * @returns True if currently in trial
 */
export declare function isInTrial(trialEndsAt: Date | null): boolean;
/**
 * Calculate remaining days in trial
 *
 * @param trialEndsAt - Trial end date
 * @returns Number of days remaining (0 if trial ended)
 */
export declare function getTrialDaysRemaining(trialEndsAt: Date | null): number;
/**
 * Check if plan has a specific feature
 *
 * @param planFeatures - Array of feature slugs from plan
 * @param featureSlug - Feature to check
 * @returns True if plan has the feature
 */
export declare function hasFeature(planFeatures: string[], featureSlug: string): boolean;
/**
 * Format price in cents to currency string
 *
 * @param cents - Price in cents
 * @param currency - Currency code (ISO 4217)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted price string
 */
export declare function formatPrice(cents: number, currency?: string, locale?: string): string;
/**
 * Calculate yearly savings vs monthly
 *
 * @param priceMonthly - Monthly price in cents
 * @param priceYearly - Yearly price in cents
 * @returns Percentage saved (0-100)
 */
export declare function calculateYearlySavings(priceMonthly: number, priceYearly: number): number;
//# sourceMappingURL=helpers.d.ts.map