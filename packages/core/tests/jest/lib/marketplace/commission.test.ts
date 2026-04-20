/**
 * Commission Calculator Tests
 */

import { describe, test, expect } from '@jest/globals'
import { calculateFee, describeCommission } from '@/core/lib/marketplace/commission'
import type { CommissionConfig } from '@/core/lib/marketplace/types'

describe('Commission Calculator', () => {
  describe('calculateFee', () => {
    describe('percentage model', () => {
      test('should calculate percentage fee correctly', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0.15 }
        expect(calculateFee(10000, config)).toBe(1500) // 15% of $100.00
      })

      test('should round to nearest integer', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0.15 }
        expect(calculateFee(9999, config)).toBe(1500) // 0.15 * 9999 = 1499.85 -> 1500
      })

      test('should handle zero amount', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0.15 }
        expect(calculateFee(0, config)).toBe(0)
      })

      test('should handle zero rate', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0 }
        expect(calculateFee(10000, config)).toBe(0)
      })
    })

    describe('fixed model', () => {
      test('should return fixed fee regardless of amount', () => {
        const config: CommissionConfig = { model: 'fixed', fixedAmount: 200 }
        expect(calculateFee(10000, config)).toBe(200)
        expect(calculateFee(50000, config)).toBe(200)
        expect(calculateFee(100, config)).toBe(100) // Capped at amount
      })
    })

    describe('hybrid model', () => {
      test('should combine percentage and fixed fees', () => {
        const config: CommissionConfig = { model: 'hybrid', rate: 0.10, fixedAmount: 100 }
        expect(calculateFee(10000, config)).toBe(1100) // 10% + $1.00
      })
    })

    describe('tiered model', () => {
      test('should use correct tier based on volume', () => {
        const config: CommissionConfig = {
          model: 'tiered',
          rate: 0.15, // default
          tiers: [
            { minVolume: 0, rate: 0.15 },
            { minVolume: 500000, rate: 0.12 },
            { minVolume: 2000000, rate: 0.10 },
            { minVolume: 5000000, rate: 0.08 },
          ],
        }

        // Low volume: 15%
        expect(calculateFee(10000, config, 100000)).toBe(1500)
        // Medium volume: 12%
        expect(calculateFee(10000, config, 600000)).toBe(1200)
        // High volume: 10%
        expect(calculateFee(10000, config, 3000000)).toBe(1000)
        // Very high volume: 8%
        expect(calculateFee(10000, config, 5000000)).toBe(800)
      })

      test('should use default rate when no volume provided', () => {
        const config: CommissionConfig = {
          model: 'tiered',
          rate: 0.15,
          tiers: [{ minVolume: 500000, rate: 0.10 }],
        }
        expect(calculateFee(10000, config)).toBe(1500)
      })
    })

    describe('constraints', () => {
      test('should enforce minimum fee', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0.01, minFee: 100 }
        expect(calculateFee(1000, config)).toBe(100) // 1% of $10 = $0.10, but min is $1.00
      })

      test('should enforce maximum fee', () => {
        const config: CommissionConfig = { model: 'percentage', rate: 0.50, maxFee: 5000 }
        expect(calculateFee(100000, config)).toBe(5000) // 50% of $1000 = $500, but max is $50
      })

      test('should not exceed payment amount', () => {
        const config: CommissionConfig = { model: 'fixed', fixedAmount: 500 }
        expect(calculateFee(200, config)).toBe(200) // $5 fee on $2 payment, capped at $2
      })

      test('should not return negative fees', () => {
        const config: CommissionConfig = { model: 'percentage', rate: -0.10 }
        expect(calculateFee(10000, config)).toBe(0)
      })
    })
  })

  describe('describeCommission', () => {
    test('should describe percentage model', () => {
      expect(describeCommission({ model: 'percentage', rate: 0.15 })).toBe('15%')
    })

    test('should describe fixed model', () => {
      expect(describeCommission({ model: 'fixed', fixedAmount: 200 })).toBe('$2.00')
    })

    test('should describe hybrid model', () => {
      expect(describeCommission({ model: 'hybrid', rate: 0.10, fixedAmount: 100 })).toBe('10% + $1.00')
    })

    test('should describe tiered model', () => {
      const result = describeCommission({
        model: 'tiered',
        tiers: [
          { minVolume: 0, rate: 0.15 },
          { minVolume: 500000, rate: 0.10 },
        ],
      })
      expect(result).toContain('15%')
      expect(result).toContain('10%')
    })
  })
})
