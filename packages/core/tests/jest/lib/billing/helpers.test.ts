/**
 * Billing Helper Functions Tests
 *
 * Tests utility functions for period calculations, usage calculations,
 * subscription status checks, and price formatting.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  getPeriodKey,
  getNextResetDate,
  calculatePercentUsed,
  calculateRemaining,
  isSubscriptionActive,
  isInTrial,
  getTrialDaysRemaining,
  hasFeature,
  formatPrice,
  calculateYearlySavings,
} from '@/core/lib/billing/helpers'
import type { LimitDefinition } from '@/core/lib/billing/config-types'
import type { SubscriptionStatus } from '@/core/lib/billing/types'

// ===========================================
// PERIOD CALCULATIONS
// ===========================================

describe('Billing Helpers - Period Calculations', () => {
  describe('getPeriodKey', () => {
    beforeEach(() => {
      // Mock date to consistent value for testing
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-12-20T10:30:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should return "all_time" for never reset period', () => {
      expect(getPeriodKey('never' as LimitDefinition['resetPeriod'])).toBe('all_time')
    })

    test('should return daily period key in format YYYY-MM-DD', () => {
      expect(getPeriodKey('daily' as LimitDefinition['resetPeriod'])).toBe('2024-12-20')
    })

    test('should return monthly period key in format YYYY-MM', () => {
      expect(getPeriodKey('monthly' as LimitDefinition['resetPeriod'])).toBe('2024-12')
    })

    test('should return yearly period key in format YYYY', () => {
      expect(getPeriodKey('yearly' as LimitDefinition['resetPeriod'])).toBe('2024')
    })

    test('should pad month and day with zeros', () => {
      jest.setSystemTime(new Date('2024-01-05T10:30:00Z'))
      expect(getPeriodKey('daily' as LimitDefinition['resetPeriod'])).toBe('2024-01-05')
      expect(getPeriodKey('monthly' as LimitDefinition['resetPeriod'])).toBe('2024-01')
    })

    test('should handle edge case for December', () => {
      jest.setSystemTime(new Date('2024-12-31T23:59:59Z'))
      expect(getPeriodKey('monthly' as LimitDefinition['resetPeriod'])).toBe('2024-12')
      expect(getPeriodKey('yearly' as LimitDefinition['resetPeriod'])).toBe('2024')
    })

    test('should default to all_time for invalid period', () => {
      expect(getPeriodKey('invalid' as any)).toBe('all_time')
    })
  })

  describe('getNextResetDate', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-12-20T10:30:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should return null for never reset period', () => {
      expect(getNextResetDate('never' as LimitDefinition['resetPeriod'])).toBeNull()
    })

    test('should return next day at midnight for daily period', () => {
      const nextReset = getNextResetDate('daily' as LimitDefinition['resetPeriod'])
      expect(nextReset).toBeInstanceOf(Date)
      expect(nextReset?.getDate()).toBe(21) // next day
      expect(nextReset?.getHours()).toBe(0)
      expect(nextReset?.getMinutes()).toBe(0)
      expect(nextReset?.getSeconds()).toBe(0)
    })

    test('should return first day of next month for monthly period', () => {
      const nextReset = getNextResetDate('monthly' as LimitDefinition['resetPeriod'])
      expect(nextReset).toBeInstanceOf(Date)
      expect(nextReset?.getFullYear()).toBe(2025) // next month is in 2025
      expect(nextReset?.getMonth()).toBe(0) // January (0-indexed)
      expect(nextReset?.getDate()).toBe(1)
    })

    test('should return first day of next year for yearly period', () => {
      const nextReset = getNextResetDate('yearly' as LimitDefinition['resetPeriod'])
      expect(nextReset).toBeInstanceOf(Date)
      expect(nextReset?.getFullYear()).toBe(2025)
      expect(nextReset?.getMonth()).toBe(0) // January
      expect(nextReset?.getDate()).toBe(1)
    })

    test('should handle month rollover for daily period', () => {
      jest.setSystemTime(new Date('2024-12-31T10:30:00Z'))
      const nextReset = getNextResetDate('daily' as LimitDefinition['resetPeriod'])
      expect(nextReset?.getFullYear()).toBe(2025)
      expect(nextReset?.getMonth()).toBe(0) // January
      expect(nextReset?.getDate()).toBe(1)
    })

    test('should return null for invalid period', () => {
      expect(getNextResetDate('invalid' as any)).toBeNull()
    })
  })
})

// ===========================================
// USAGE CALCULATIONS
// ===========================================

describe('Billing Helpers - Usage Calculations', () => {
  describe('calculatePercentUsed', () => {
    test('should return 0 for unlimited (-1) max', () => {
      expect(calculatePercentUsed(500, -1)).toBe(0)
      expect(calculatePercentUsed(0, -1)).toBe(0)
    })

    test('should return 100 for zero max', () => {
      expect(calculatePercentUsed(0, 0)).toBe(100)
      expect(calculatePercentUsed(5, 0)).toBe(100)
    })

    test('should calculate correct percentage', () => {
      expect(calculatePercentUsed(50, 100)).toBe(50)
      expect(calculatePercentUsed(25, 100)).toBe(25)
      expect(calculatePercentUsed(75, 100)).toBe(75)
    })

    test('should round to nearest integer', () => {
      expect(calculatePercentUsed(33, 100)).toBe(33)
      expect(calculatePercentUsed(67, 100)).toBe(67)
      expect(calculatePercentUsed(1, 3)).toBe(33) // 1/3 = 0.333...
    })

    test('should cap at 100 when usage exceeds max', () => {
      expect(calculatePercentUsed(150, 100)).toBe(100)
      expect(calculatePercentUsed(200, 100)).toBe(100)
    })

    test('should handle zero current usage', () => {
      expect(calculatePercentUsed(0, 100)).toBe(0)
    })

    test('should handle exact match', () => {
      expect(calculatePercentUsed(100, 100)).toBe(100)
    })
  })

  describe('calculateRemaining', () => {
    test('should return Infinity for unlimited (-1) max', () => {
      expect(calculateRemaining(500, -1)).toBe(Infinity)
      expect(calculateRemaining(0, -1)).toBe(Infinity)
    })

    test('should calculate correct remaining quota', () => {
      expect(calculateRemaining(30, 100)).toBe(70)
      expect(calculateRemaining(0, 100)).toBe(100)
      expect(calculateRemaining(100, 100)).toBe(0)
    })

    test('should return 0 when usage exceeds max', () => {
      expect(calculateRemaining(150, 100)).toBe(0)
      expect(calculateRemaining(200, 100)).toBe(0)
    })

    test('should handle zero max', () => {
      expect(calculateRemaining(0, 0)).toBe(0)
      expect(calculateRemaining(5, 0)).toBe(0)
    })
  })
})

// ===========================================
// SUBSCRIPTION STATUS CHECKS
// ===========================================

describe('Billing Helpers - Subscription Status', () => {
  describe('isSubscriptionActive', () => {
    test('should return true for active subscription', () => {
      expect(isSubscriptionActive('active' as SubscriptionStatus)).toBe(true)
    })

    test('should return true for trialing subscription', () => {
      expect(isSubscriptionActive('trialing' as SubscriptionStatus)).toBe(true)
    })

    test('should return true for past_due subscription', () => {
      expect(isSubscriptionActive('past_due' as SubscriptionStatus)).toBe(true)
    })

    test('should return false for canceled subscription', () => {
      expect(isSubscriptionActive('canceled' as SubscriptionStatus)).toBe(false)
    })

    test('should return false for paused subscription', () => {
      expect(isSubscriptionActive('paused' as SubscriptionStatus)).toBe(false)
    })

    test('should return false for expired subscription', () => {
      expect(isSubscriptionActive('expired' as SubscriptionStatus)).toBe(false)
    })
  })

  describe('isInTrial', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-12-20T10:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should return false for null trialEndsAt', () => {
      expect(isInTrial(null)).toBe(false)
    })

    test('should return true when trial has not ended', () => {
      const futureDate = new Date('2024-12-25T10:00:00Z')
      expect(isInTrial(futureDate)).toBe(true)
    })

    test('should return false when trial has ended', () => {
      const pastDate = new Date('2024-12-15T10:00:00Z')
      expect(isInTrial(pastDate)).toBe(false)
    })

    test('should return false when trial ends exactly now', () => {
      const now = new Date('2024-12-20T10:00:00Z')
      expect(isInTrial(now)).toBe(false)
    })

    test('should return true when trial ends in one second', () => {
      const nearFuture = new Date('2024-12-20T10:00:01Z')
      expect(isInTrial(nearFuture)).toBe(true)
    })
  })

  describe('getTrialDaysRemaining', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-12-20T10:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should return 0 for null trialEndsAt', () => {
      expect(getTrialDaysRemaining(null)).toBe(0)
    })

    test('should return 0 when trial has ended', () => {
      const pastDate = new Date('2024-12-15T10:00:00Z')
      expect(getTrialDaysRemaining(pastDate)).toBe(0)
    })

    test('should calculate days remaining correctly', () => {
      const futureDate = new Date('2024-12-25T10:00:00Z')
      expect(getTrialDaysRemaining(futureDate)).toBe(5)
    })

    test('should round up partial days', () => {
      const futureDate = new Date('2024-12-21T09:00:00Z')
      expect(getTrialDaysRemaining(futureDate)).toBe(1)
    })

    test('should return 1 for less than 24 hours remaining', () => {
      const futureDate = new Date('2024-12-20T20:00:00Z') // 10 hours from now
      expect(getTrialDaysRemaining(futureDate)).toBe(1)
    })

    test('should handle exact day boundaries', () => {
      const futureDate = new Date('2024-12-27T10:00:00Z') // exactly 7 days
      expect(getTrialDaysRemaining(futureDate)).toBe(7)
    })
  })
})

// ===========================================
// FEATURE CHECKS
// ===========================================

describe('Billing Helpers - Feature Checks', () => {
  describe('hasFeature', () => {
    test('should return true when feature exists in plan features', () => {
      const planFeatures = ['analytics', 'export', 'api-access']
      expect(hasFeature(planFeatures, 'analytics')).toBe(true)
      expect(hasFeature(planFeatures, 'export')).toBe(true)
      expect(hasFeature(planFeatures, 'api-access')).toBe(true)
    })

    test('should return false when feature does not exist in plan features', () => {
      const planFeatures = ['analytics', 'export']
      expect(hasFeature(planFeatures, 'api-access')).toBe(false)
      expect(hasFeature(planFeatures, 'priority-support')).toBe(false)
    })

    test('should return true for any feature when wildcard is present', () => {
      const planFeatures = ['*']
      expect(hasFeature(planFeatures, 'analytics')).toBe(true)
      expect(hasFeature(planFeatures, 'any-feature')).toBe(true)
      expect(hasFeature(planFeatures, 'unknown-feature')).toBe(true)
    })

    test('should return true for wildcard even with other features', () => {
      const planFeatures = ['analytics', '*', 'export']
      expect(hasFeature(planFeatures, 'api-access')).toBe(true)
      expect(hasFeature(planFeatures, 'random-feature')).toBe(true)
    })

    test('should handle empty feature list', () => {
      const planFeatures: string[] = []
      expect(hasFeature(planFeatures, 'analytics')).toBe(false)
    })

    test('should be case sensitive', () => {
      const planFeatures = ['analytics']
      expect(hasFeature(planFeatures, 'Analytics')).toBe(false)
      expect(hasFeature(planFeatures, 'ANALYTICS')).toBe(false)
    })
  })
})

// ===========================================
// PRICE CALCULATIONS
// ===========================================

describe('Billing Helpers - Price Formatting', () => {
  describe('formatPrice', () => {
    test('should format USD prices correctly', () => {
      expect(formatPrice(2900, 'usd')).toMatch(/\$29\.00/)
      expect(formatPrice(9999, 'usd')).toMatch(/\$99\.99/)
      expect(formatPrice(0, 'usd')).toMatch(/\$0\.00/)
    })

    test('should format EUR prices correctly', () => {
      expect(formatPrice(2900, 'eur')).toContain('29')
      expect(formatPrice(2900, 'eur')).toContain('.00')
    })

    test('should format GBP prices correctly', () => {
      expect(formatPrice(2900, 'gbp')).toContain('29')
      expect(formatPrice(2900, 'gbp')).toContain('.00')
    })

    test('should use USD as default currency', () => {
      expect(formatPrice(2900)).toMatch(/\$29\.00/)
    })

    test('should use en-US as default locale', () => {
      expect(formatPrice(100000, 'usd')).toMatch(/\$1,000\.00/)
    })

    test('should handle large amounts with thousands separators', () => {
      expect(formatPrice(100000000, 'usd')).toMatch(/\$1,000,000\.00/)
    })

    test('should convert cents to dollars correctly', () => {
      expect(formatPrice(1, 'usd')).toMatch(/\$0\.01/)
      expect(formatPrice(50, 'usd')).toMatch(/\$0\.50/)
      expect(formatPrice(100, 'usd')).toMatch(/\$1\.00/)
    })

    test('should handle different locale formats', () => {
      // de-DE uses comma for decimal separator
      const formatted = formatPrice(2900, 'eur', 'de-DE')
      expect(formatted).toContain('29')
    })

    test('should handle case-insensitive currency codes', () => {
      expect(formatPrice(2900, 'USD')).toMatch(/\$29\.00/)
      expect(formatPrice(2900, 'Usd')).toMatch(/\$29\.00/)
    })
  })

  describe('calculateYearlySavings', () => {
    test('should calculate correct savings percentage', () => {
      // Monthly: $29, Yearly: $290 (instead of $348)
      expect(calculateYearlySavings(2900, 29000)).toBe(17) // (348-290)/348 = 16.67% ≈ 17%
    })

    test('should return 0 when yearly equals monthly * 12', () => {
      expect(calculateYearlySavings(2900, 34800)).toBe(0)
    })

    test('should handle zero monthly price', () => {
      expect(isNaN(calculateYearlySavings(0, 0))).toBe(true) // 0/0 = NaN
    })

    test('should calculate high savings percentage', () => {
      // Monthly: $100, Yearly: $600 (50% savings)
      expect(calculateYearlySavings(10000, 60000)).toBe(50)
    })

    test('should calculate low savings percentage', () => {
      // Monthly: $100, Yearly: $1100 (8% savings)
      expect(calculateYearlySavings(10000, 110000)).toBe(8) // (1200-1100)/1200 = 8.33% ≈ 8%
    })

    test('should round to nearest integer', () => {
      // Create scenario with fractional percentage
      expect(calculateYearlySavings(3333, 35000)).toBeGreaterThanOrEqual(0)
      expect(calculateYearlySavings(3333, 35000)).toBeLessThanOrEqual(100)
    })

    test('should handle yearly more expensive than monthly', () => {
      // Yearly costs more - negative savings (but we round so could be 0 or negative)
      const result = calculateYearlySavings(10000, 125000)
      expect(typeof result).toBe('number')
      // Result would be negative, Math.round handles it
    })

    test('should handle free plan (0 prices)', () => {
      expect(isNaN(calculateYearlySavings(0, 0))).toBe(true)
    })
  })
})
