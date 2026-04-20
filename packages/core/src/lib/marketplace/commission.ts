/**
 * Commission Calculator
 *
 * Calculates platform fees for marketplace payments.
 * Supports percentage, fixed, hybrid, and tiered commission models.
 */

import type { CommissionConfig } from './types'

/**
 * Calculate the application fee (platform commission) for a payment.
 *
 * @param amount - Total payment amount in smallest currency unit
 * @param config - Commission configuration
 * @param monthlyVolume - Monthly volume for tiered pricing (optional)
 * @returns Application fee in smallest currency unit
 *
 * @example
 * // 15% commission on $100.00 (10000 cents)
 * calculateFee(10000, { model: 'percentage', rate: 0.15 })
 * // Returns: 1500
 *
 * @example
 * // $2.00 fixed fee
 * calculateFee(10000, { model: 'fixed', fixedAmount: 200 })
 * // Returns: 200
 *
 * @example
 * // 10% + $1.00 fixed
 * calculateFee(10000, { model: 'hybrid', rate: 0.10, fixedAmount: 100 })
 * // Returns: 1100
 */
export function calculateFee(
  amount: number,
  config: CommissionConfig,
  monthlyVolume?: number
): number {
  let fee: number

  switch (config.model) {
    case 'percentage':
      fee = Math.round(amount * (config.rate ?? 0))
      break

    case 'fixed':
      fee = config.fixedAmount ?? 0
      break

    case 'hybrid':
      fee = Math.round(amount * (config.rate ?? 0)) + (config.fixedAmount ?? 0)
      break

    case 'tiered': {
      const tiers = config.tiers ?? []
      const volume = monthlyVolume ?? 0
      // Find the highest tier the merchant qualifies for
      const applicableTier = tiers
        .filter(t => volume >= t.minVolume)
        .sort((a, b) => b.minVolume - a.minVolume)[0]

      const rate = applicableTier?.rate ?? config.rate ?? 0
      fee = Math.round(amount * rate)
      break
    }

    default:
      fee = Math.round(amount * (config.rate ?? 0))
  }

  // Apply min/max constraints
  if (config.minFee !== undefined && fee < config.minFee) {
    fee = config.minFee
  }
  if (config.maxFee !== undefined && fee > config.maxFee) {
    fee = config.maxFee
  }

  // Fee cannot exceed the payment amount
  if (fee > amount) {
    fee = amount
  }

  // Fee cannot be negative
  if (fee < 0) {
    fee = 0
  }

  return fee
}

/**
 * Get a human-readable description of the commission model.
 *
 * @example
 * describeCommission({ model: 'percentage', rate: 0.15 })
 * // Returns: "15%"
 *
 * describeCommission({ model: 'hybrid', rate: 0.10, fixedAmount: 100 })
 * // Returns: "10% + $1.00"
 */
export function describeCommission(config: CommissionConfig, currency = 'USD'): string {
  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }

  switch (config.model) {
    case 'percentage':
      return `${((config.rate ?? 0) * 100).toFixed(0)}%`

    case 'fixed':
      return formatAmount(config.fixedAmount ?? 0)

    case 'hybrid':
      return `${((config.rate ?? 0) * 100).toFixed(0)}% + ${formatAmount(config.fixedAmount ?? 0)}`

    case 'tiered': {
      const tiers = config.tiers ?? []
      return tiers
        .map(t => `${(t.rate * 100).toFixed(0)}% (>${formatAmount(t.minVolume)}/mo)`)
        .join(', ')
    }

    default:
      return `${((config.rate ?? 0) * 100).toFixed(0)}%`
  }
}
