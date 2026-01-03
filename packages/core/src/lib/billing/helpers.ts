/**
 * Billing Helper Functions
 *
 * Utility functions for billing operations including period calculations,
 * percentage calculations, and subscription status checks.
 */

import type { LimitDefinition } from './config-types'
import type { SubscriptionStatus } from './types'

// ===========================================
// PERIOD CALCULATIONS
// ===========================================

/**
 * Generate period key based on limit reset period
 * Used to track usage within specific time windows
 *
 * @param resetPeriod - The reset period for the limit
 * @returns Period key string (e.g., '2024-01' for monthly, '2024-01-15' for daily)
 */
export function getPeriodKey(resetPeriod: LimitDefinition['resetPeriod']): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  switch (resetPeriod) {
    case 'never':
      return 'all_time'
    case 'daily':
      return `${year}-${month}-${day}`
    case 'monthly':
      return `${year}-${month}`
    case 'yearly':
      return `${year}`
    default:
      return 'all_time'
  }
}

/**
 * Calculate next reset date based on period
 *
 * @param resetPeriod - The reset period for the limit
 * @returns Next reset date or null if period is 'never'
 */
export function getNextResetDate(resetPeriod: LimitDefinition['resetPeriod']): Date | null {
  const now = new Date()

  switch (resetPeriod) {
    case 'never':
      return null
    case 'daily': {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      return tomorrow
    }
    case 'monthly': {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return nextMonth
    }
    case 'yearly': {
      const nextYear = new Date(now.getFullYear() + 1, 0, 1)
      return nextYear
    }
    default:
      return null
  }
}

// ===========================================
// USAGE CALCULATIONS
// ===========================================

/**
 * Calculate percentage used
 *
 * @param current - Current usage value
 * @param max - Maximum allowed value (-1 for unlimited)
 * @returns Percentage used (0-100)
 */
export function calculatePercentUsed(current: number, max: number): number {
  if (max === -1) return 0 // Unlimited
  if (max === 0) return 100 // Already at limit
  return Math.min(100, Math.round((current / max) * 100))
}

/**
 * Calculate remaining quota
 *
 * @param current - Current usage value
 * @param max - Maximum allowed value (-1 for unlimited)
 * @returns Remaining quota
 */
export function calculateRemaining(current: number, max: number): number {
  if (max === -1) return Infinity // Unlimited
  return Math.max(0, max - current)
}

// ===========================================
// SUBSCRIPTION STATUS CHECKS
// ===========================================

/**
 * Check if subscription is active (can use features)
 *
 * @param status - Subscription status
 * @returns True if subscription is active
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return ['active', 'trialing', 'past_due'].includes(status)
}

/**
 * Check if subscription is in trial period
 *
 * @param trialEndsAt - Trial end date
 * @returns True if currently in trial
 */
export function isInTrial(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false
  return new Date() < trialEndsAt
}

/**
 * Calculate remaining days in trial
 *
 * @param trialEndsAt - Trial end date
 * @returns Number of days remaining (0 if trial ended)
 */
export function getTrialDaysRemaining(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0
  const now = new Date()
  const diff = trialEndsAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ===========================================
// FEATURE CHECKS
// ===========================================

/**
 * Check if plan has a specific feature
 *
 * @param planFeatures - Array of feature slugs from plan
 * @param featureSlug - Feature to check
 * @returns True if plan has the feature
 */
export function hasFeature(planFeatures: string[], featureSlug: string): boolean {
  // Wildcard means all features
  if (planFeatures.includes('*')) return true
  return planFeatures.includes(featureSlug)
}

// ===========================================
// PRICE CALCULATIONS
// ===========================================

/**
 * Format price in cents to currency string
 *
 * @param cents - Price in cents
 * @param currency - Currency code (ISO 4217)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted price string
 */
export function formatPrice(cents: number, currency: string = 'usd', locale: string = 'en-US'): string {
  const amount = cents / 100
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

/**
 * Calculate yearly savings vs monthly
 *
 * @param priceMonthly - Monthly price in cents
 * @param priceYearly - Yearly price in cents
 * @returns Percentage saved (0-100)
 */
export function calculateYearlySavings(priceMonthly: number, priceYearly: number): number {
  const yearlyEquivalent = priceMonthly * 12
  const savings = yearlyEquivalent - priceYearly
  return Math.round((savings / yearlyEquivalent) * 100)
}
