/**
 * The platform's commission on a payment, in integer minor units (cents).
 *
 * Rounding: the percentage part rounds half up to a whole cent (1.5 cents is 2, 1.4 cents is 1), with integer
 * arithmetic, so no binary fraction can move a result by a cent. Then, in this order: the fixed part is added, the
 * minimum and the maximum apply, and the commission never exceeds the amount. `sellerCents` is what is left, so the
 * two always add up to the amount.
 */

export interface CommissionConfig {
  /** Percentage in basis points: 1000 is 10%. An integer from 0 to 10000. */
  percentBps: number
  fixedCents?: number
  minCents?: number
  maxCents?: number
}

export interface CommissionResult {
  commissionCents: number
  sellerCents: number
}

/** The largest amount accepted: `amount * 10000` stays a safe integer. */
export const MAX_AMOUNT_CENTS = 100_000_000_000

function assertCents(name: string, value: number, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`)
  }
}

export function assertCommissionConfig(config: CommissionConfig): void {
  assertCents('percentBps', config.percentBps, { max: 10_000 })
  assertCents('fixedCents', config.fixedCents ?? 0, { max: MAX_AMOUNT_CENTS })
  assertCents('minCents', config.minCents ?? 0, { max: MAX_AMOUNT_CENTS })
  assertCents('maxCents', config.maxCents ?? 0, { max: MAX_AMOUNT_CENTS })
  if (config.minCents !== undefined && config.maxCents !== undefined && config.minCents > config.maxCents) {
    throw new RangeError('minCents cannot exceed maxCents')
  }
}

export function calculateCommission(amountCents: number, config: CommissionConfig): CommissionResult {
  assertCents('amountCents', amountCents, { min: 1, max: MAX_AMOUNT_CENTS })
  assertCommissionConfig(config)

  const percentCents = Math.floor((amountCents * config.percentBps + 5_000) / 10_000)
  let commissionCents = percentCents + (config.fixedCents ?? 0)
  if (config.minCents !== undefined) commissionCents = Math.max(commissionCents, config.minCents)
  if (config.maxCents !== undefined) commissionCents = Math.min(commissionCents, config.maxCents)
  commissionCents = Math.min(commissionCents, amountCents)

  return { commissionCents, sellerCents: amountCents - commissionCents }
}
